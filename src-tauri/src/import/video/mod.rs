//! Compression (IMP-69) et conversion (IMP-22) des vidéos par ffmpeg, écrites à côté de l'original comme les images
//! (IMP-27) : « video_c.mp4 » (compressée), « video.mp4 » (convertie), « video (1).mp4 » si le nom est pris (IMP-65).
//! Résolution et images par seconde gardées (IMP-25) ; une version compressée est gardée si elle est au moins 5 % plus
//! légère, une version convertie toujours (IMP-70, 11/11 ; réglage à venir SET-18) ; progression du fichier (IMP-41) ; « Arrêter » coupe ffmpeg
//! aussitôt. La carte graphique échoue (format de pixels, taille…) : nouvel essai au processeur.

pub mod control;
mod encoders;
mod probe;
mod streams;

use std::fs::{self, Metadata};
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};

use anyhow::{Context, bail};
use rusqlite::Connection;

use super::compress::{self, Squeeze};
use super::plan::VideoRequest;
use streams::{Family, Job};

/// Liens avec le déroulement de l'import : arrêt (« Terminer ici », « Annuler l'import », « Annuler » de la
/// visionneuse), barre de progression du fichier (0 à 1), pause (IMP-42 ; aucune dans la visionneuse).
pub struct Hooks<'a> {
    pub cancel: &'a AtomicBool,
    pub progress: &'a dyn Fn(Option<f32>),
    pub gate: Option<&'a super::pause::Gate>,
}

pub enum Done {
    /// Nouvelle version placée à côté de l'original : chemin, empreinte, poids, extension, ce qui a été fait.
    Written { path: String, hash: String, size: i64, ext: String, squeeze: Squeeze, lost_subtitles: bool },
    /// Rien d'écrit : rien à faire (`None`), pas au moins 5 % de gain, ancien format jamais compressé.
    Kept(Option<Squeeze>),
    Cancelled,
}

pub fn process(conn: &Connection, path: &Path, meta: &Metadata, request: VideoRequest, hooks: &Hooks) -> anyhow::Result<Done> {
    let ff = crate::ffmpeg::shared().context("ffmpeg introuvable : vidéo ni compressée ni convertie")?;
    let probe = probe::probe(&ff.ffprobe, path)?;
    let ext = path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    let job = match streams::plan(&probe, &ext, request) {
        Ok(job) => job,
        Err(kept) => return Ok(Done::Kept(kept)),
    };
    let (suffix, squeeze, codec) = match &job {
        Job::Encode { compressed, converted, codec, .. } => (*compressed, if *converted { Squeeze::Converted } else { Squeeze::Compressed }, Some(*codec)),
        Job::Remux { .. } => (false, Squeeze::Converted, None),
    };
    let out = job.out();
    let target = compress::free_name(path, &out.ext, suffix)?;
    let tmp = compress::tmp_of(&target);
    let _ = fs::remove_file(&tmp);
    // Noté AVANT l'écriture (journal, IMP-42) ; retiré ici si rien n'est gardé, sinon par l'appelant une fois la
    // version enregistrée en base.
    super::journal::add(&target);
    let done = (|| -> anyhow::Result<Done> {
        let encoder = codec.map(|c| encoders::choose(&ff.ffmpeg, c));
        let playable = request.playable;
        let lost_subtitles = streams::stream_args(&probe, &job, encoder, playable).1;
        let mut result = run(&ff.ffmpeg, path, &probe, &job, encoder, playable, &tmp, hooks);
        if let (Err(e), Some(codec), Some(used)) = (&result, codec, encoder)
            && used != codec.cpu()
            && !hooks.cancel.load(Ordering::SeqCst)
        {
            eprintln!("[import] {used} a échoué ({e:#}) : nouvel essai avec {}", codec.cpu());
            result = run(&ff.ffmpeg, path, &probe, &job, Some(codec.cpu()), playable, &tmp, hooks);
        }
        (hooks.progress)(None);
        if let Err(e) = result {
            let _ = fs::remove_file(&tmp);
            return if hooks.cancel.load(Ordering::SeqCst) { Ok(Done::Cancelled) } else { Err(e) };
        }
        let size = fs::metadata(&tmp)?.len();
        if matches!(job, Job::Encode { converted: false, .. }) && size * 100 > meta.len() * 95 {
            let _ = fs::remove_file(&tmp);
            return Ok(Done::Kept(Some(Squeeze::NotSmaller)));
        }
        let hash = super::versions::hash_file(&tmp)?;
        // Contenu déjà connu (cas rare) : rien n'est gardé, l'original est importé tel quel.
        if super::index::find_hash(conn, &hash)?.is_some() {
            let _ = fs::remove_file(&tmp);
            return Ok(Done::Kept(None));
        }
        compress::place(&tmp, &target, meta)?;
        let path = target.to_str().context("nom de fichier illisible")?.to_owned();
        Ok(Done::Written { path, hash, size: size as i64, ext: out.ext.clone(), squeeze, lost_subtitles })
    })();
    if !matches!(done, Ok(Done::Written { .. })) {
        super::journal::remove(&[target]);
    }
    done
}

/// Lance ffmpeg vers le fichier provisoire et suit sa progression (toutes les 0,5 s).
#[allow(clippy::too_many_arguments)]
fn run(ffmpeg: &Path, input: &Path, probe: &probe::Probe, job: &Job, encoder: Option<&str>, playable: bool, tmp: &Path, hooks: &Hooks) -> anyhow::Result<()> {
    let out = job.out();
    let mut cmd = crate::ffmpeg::command(ffmpeg);
    cmd.args(["-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1", "-stats_period", "0.5", "-i"]).arg(input);
    cmd.args(streams::stream_args(probe, job, encoder, playable).0);
    cmd.args(["-map_metadata", "0", "-map_chapters", "0", "-max_muxing_queue_size", "4096"]);
    if out.family == Family::Mp4 {
        // « faststart » : la lecture démarre sans attendre la fin du fichier (accepté le 11/11). Informations d'Apple
        // (lieu, appareil) : gardées par `use_metadata_tags`, qui empêche en revanche d'écrire une pochette (essai du
        // 11/11) : seulement pour les vidéos qui en ont (iPhone).
        cmd.args(["-movflags", if probe.named_tags() { "+faststart+use_metadata_tags" } else { "+faststart" }]);
    }
    cmd.args(["-f", out.muxer]).arg(tmp).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd.spawn().context("lancement de ffmpeg")?;
    control::bind(&child);
    let mut stderr = child.stderr.take().context("sortie d'erreur de ffmpeg")?;
    let errors = std::thread::spawn(move || {
        let mut text = String::new();
        let _ = stderr.read_to_string(&mut text);
        text
    });
    let duration = probe.duration();
    let stdout = child.stdout.take().context("sortie de ffmpeg")?;
    for line in BufReader::new(stdout).lines() {
        // Pause (IMP-42) : ffmpeg est figé tel quel, puis repart ; arrêté s'il le faut.
        if let Some(gate) = hooks.gate
            && gate.is_paused()
            && !hooks.cancel.load(Ordering::SeqCst)
        {
            control::suspend(&child, true);
            gate.wait(hooks.cancel);
            control::suspend(&child, false);
        }
        if hooks.cancel.load(Ordering::SeqCst) {
            let _ = child.kill();
            break;
        }
        let Ok(line) = line else { break };
        if let (Some(us), Some(total)) = (line.strip_prefix("out_time_us="), duration)
            && let Ok(us) = us.trim().parse::<f64>()
        {
            (hooks.progress)(Some((us / 1e6 / total).clamp(0.0, 1.0) as f32));
        }
    }
    let status = child.wait()?;
    let errors = errors.join().unwrap_or_default();
    if hooks.cancel.load(Ordering::SeqCst) {
        bail!("import arrêté");
    }
    if !status.success() {
        let tail: Vec<&str> = errors.lines().rev().take(3).collect();
        bail!("ffmpeg ({}) : {}", encoder.unwrap_or("copie"), tail.into_iter().rev().collect::<Vec<_>>().join(" / "));
    }
    Ok(())
}

