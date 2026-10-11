//! Miniatures via ffmpeg : vidéos, et images que Rust ne sait pas lire (AVIF, HEIC…).

use std::io::Read;
use std::path::Path;
use std::process::{Command, Output, Stdio};
use std::time::{Duration, Instant};

use anyhow::{Context, bail};
use serde_json::Value;

use super::image::{PREVIEW_SIZE, THUMB_SIZE, Thumb, decode, preview_of, thumbs_of};
use crate::ffmpeg::{self, Ffmpeg};

/// Au-delà, le fichier est considéré comme bloquant (fichier corrompu, disque lent…).
const TIMEOUT: Duration = Duration::from_secs(30);

pub struct VideoThumb {
    pub thumb: Thumb,
    pub duration_ms: Option<i64>,
}

/// Infos lues par ffprobe : dimensions affichées (rotation appliquée) et durée.
struct Probe {
    width: Option<u32>,
    height: Option<u32>,
    duration_ms: Option<i64>,
}

/// Miniatures d'une vidéo : image prise à 10 % de la durée (la première image est souvent
/// noire), avec repli sur le début si la vidéo est trop courte.
pub fn video_thumb(ff: &Ffmpeg, path: &Path) -> anyhow::Result<VideoThumb> {
    let probe = probe(ff, path)?;
    let frame = decode(&video_frame(ff, path, &probe, THUMB_SIZE * 3 / 2)?)?;
    let (frame_w, frame_h) = (frame.width(), frame.height());
    let mut thumb = thumbs_of(frame)?;
    // Dimensions de la vidéo elle-même, pas de l'image réduite.
    thumb.width = probe.width.unwrap_or(frame_w);
    thumb.height = probe.height.unwrap_or(frame_h);
    Ok(VideoThumb { thumb, duration_ms: probe.duration_ms })
}

/// Grand aperçu 640 px d'une vidéo (LIB-09).
pub fn video_preview(ff: &Ffmpeg, path: &Path) -> anyhow::Result<Vec<u8>> {
    let probe = probe(ff, path)?;
    preview_of(decode(&video_frame(ff, path, &probe, PREVIEW_SIZE * 3 / 2)?)?)
}

/// Miniatures d'une image que le décodeur Rust ne gère pas (AVIF, HEIC…).
pub fn image_thumb(ff: &Ffmpeg, path: &Path) -> anyhow::Result<Thumb> {
    let probe = probe(ff, path)?;
    let frame = decode(&frame_png(ff, path, 0.0, THUMB_SIZE * 3 / 2)?)?;
    let (frame_w, frame_h) = (frame.width(), frame.height());
    let mut thumb = thumbs_of(frame)?;
    thumb.width = probe.width.unwrap_or(frame_w);
    thumb.height = probe.height.unwrap_or(frame_h);
    Ok(thumb)
}

/// Grand aperçu d'une image passée par ffmpeg.
pub fn image_preview(ff: &Ffmpeg, path: &Path) -> anyhow::Result<Vec<u8>> {
    preview_of(decode(&frame_png(ff, path, 0.0, PREVIEW_SIZE * 3 / 2)?)?)
}

/// Image de la vidéo à 10 % de la durée (ou au début si elle est trop courte).
fn video_frame(ff: &Ffmpeg, path: &Path, probe: &Probe, short_side: u32) -> anyhow::Result<Vec<u8>> {
    let seek = probe
        .duration_ms
        .map(|ms| (ms as f64 / 1000.0 * 0.10).min(ms as f64 / 1000.0 - 0.5).max(0.0))
        .unwrap_or(0.0);
    match frame_png(ff, path, seek, short_side) {
        Ok(png) => Ok(png),
        Err(_) if seek > 0.0 => frame_png(ff, path, 0.0, short_side),
        Err(e) => Err(e),
    }
}

fn probe(ff: &Ffmpeg, path: &Path) -> anyhow::Result<Probe> {
    let mut cmd = ffmpeg::command(&ff.ffprobe);
    cmd.args(["-v", "error", "-select_streams", "v:0", "-show_streams", "-show_format"])
        .args(["-of", "json"])
        .arg(path);
    let output = run(cmd)?;
    let json: Value = serde_json::from_slice(&output.stdout).context("réponse de ffprobe illisible")?;
    let stream = &json["streams"][0];
    let mut width = stream["width"].as_u64().map(|v| v as u32);
    let mut height = stream["height"].as_u64().map(|v| v as u32);
    if rotation(stream).rem_euclid(180) == 90 {
        std::mem::swap(&mut width, &mut height); // vidéo de téléphone tournée
    }
    let seconds = json["format"]["duration"]
        .as_str()
        .or_else(|| stream["duration"].as_str())
        .and_then(|s| s.parse::<f64>().ok());
    let duration_ms = seconds.filter(|s| s.is_finite() && *s > 0.0).map(|s| (s * 1000.0).round() as i64);
    Ok(Probe { width, height, duration_ms })
}

/// Rotation en degrés : métadonnée « side data » (récent) ou ancienne étiquette `rotate`.
fn rotation(stream: &Value) -> i64 {
    let from_side_data = stream["side_data_list"]
        .as_array()
        .into_iter()
        .flatten()
        .find_map(|d| d["rotation"].as_f64().map(|r| r.round() as i64));
    from_side_data
        .or_else(|| stream["tags"]["rotate"].as_str().and_then(|r| r.parse().ok()))
        .unwrap_or(0)
}

/// Une image de la vidéo, en PNG, côté court ramené à `short_side` px (recadrée ensuite en Rust).
fn frame_png(ff: &Ffmpeg, path: &Path, seek_seconds: f64, short_side: u32) -> anyhow::Result<Vec<u8>> {
    let mut cmd = ffmpeg::command(&ff.ffmpeg);
    cmd.args(["-hide_banner", "-loglevel", "error", "-nostdin", "-threads", "2"]);
    if seek_seconds > 0.0 {
        cmd.args(["-ss", &format!("{seek_seconds:.3}")]);
    }
    cmd.arg("-i")
        .arg(path)
        .args(["-map", "0:v:0", "-frames:v", "1", "-an", "-sn", "-dn"])
        .args(["-vf", &format!("scale={short_side}:{short_side}:force_original_aspect_ratio=increase")])
        .args(["-f", "image2pipe", "-c:v", "png", "-"]);
    let output = run(cmd)?;
    if output.stdout.is_empty() {
        bail!("ffmpeg n'a produit aucune image");
    }
    Ok(output.stdout)
}

/// Lance la commande, lit ses sorties et l'arrête si elle dépasse le délai.
fn run(mut cmd: Command) -> anyhow::Result<Output> {
    let mut child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("lancement de ffmpeg")?;
    // Les sorties sont lues dans des fils séparés : sinon un tampon plein bloquerait ffmpeg.
    let mut stdout = child.stdout.take().context("sortie de ffmpeg")?;
    let mut stderr = child.stderr.take().context("sortie d'erreur de ffmpeg")?;
    let out_reader = std::thread::spawn(move || {
        let mut buf = Vec::new();
        stdout.read_to_end(&mut buf).map(|_| buf)
    });
    let err_reader = std::thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = stderr.read_to_end(&mut buf);
        buf
    });

    let start = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait()? {
            break status;
        }
        if start.elapsed() > TIMEOUT {
            let _ = child.kill();
            let _ = child.wait();
            bail!("ffmpeg ne répond plus (plus de {} s)", TIMEOUT.as_secs());
        }
        std::thread::sleep(Duration::from_millis(15));
    };
    let stdout = out_reader.join().map_err(|_| anyhow::anyhow!("lecture de ffmpeg"))??;
    let stderr = err_reader.join().unwrap_or_default();
    if !status.success() {
        let message = String::from_utf8_lossy(&stderr);
        let last = message.lines().rev().find(|l| !l.trim().is_empty()).unwrap_or("erreur inconnue");
        bail!("ffmpeg : {}", last.trim());
    }
    Ok(Output { status, stdout, stderr })
}
