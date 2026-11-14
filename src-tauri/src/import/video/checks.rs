//! Lecture anticipée des vidéos de la liste avant l'import (IMP-85 ; réponses Q8 A et Q12 A du 13/11) : savoir, avant le
//! clic sur « Importer », lesquelles « Compresser les vidéos » laisserait telles quelles (ancien format, conteneur non pris
//! en charge), pour les citer dans la pop-in. Seulement quand « Compresser les vidéos » est cochée ; une vidéo à la fois,
//! en arrière-plan (ffprobe, priorité basse, ne lit que le début du fichier) ; une vidéo retirée de la liste (croix,
//! « Tout vider », nouveau choix) est sautée ; l'import réutilise ces lectures au lieu de relire chaque vidéo. MyBoard
//! fermé : le fil s'arrête avec lui (un ffprobe déjà lancé finit sa lecture, quelques dixièmes de seconde).

use std::collections::{BTreeSet, HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Condvar, Mutex, OnceLock};

use serde::Serialize;
use tauri::{AppHandle, Manager};

use super::probe::{self, Probe};
use super::streams;
use crate::AppState;
use crate::formats::Kind;
use crate::import::Phase;
use crate::import::plan::{Process, Target, VideoRequest, VideoTarget};

/// Lecture d'une vidéo ; `probe` vide : illisible par ffprobe.
struct Read {
    size: u64,
    probe: Option<Arc<Probe>>,
}

struct Checks {
    /// « Compresser les vidéos » cochée.
    wanted: AtomicBool,
    /// Liste changée ou case cochée : le fil refait sa liste de vidéos à lire.
    dirty: Mutex<bool>,
    wake: Condvar,
    done: Mutex<HashMap<PathBuf, Read>>,
}

fn checks() -> &'static Checks {
    static CHECKS: OnceLock<Checks> = OnceLock::new();
    CHECKS.get_or_init(|| Checks { wanted: AtomicBool::new(false), dirty: Mutex::new(false), wake: Condvar::new(), done: Mutex::new(HashMap::new()) })
}

/// La liste a changé (parcours terminé, fichier retiré, « Tout vider ») : le fil refait sa liste.
pub fn changed() {
    let c = checks();
    *c.dirty.lock().unwrap() = true;
    c.wake.notify_all();
}

/// Lecture faite à l'avance pour ce fichier, s'il n'a pas changé de poids depuis.
pub fn cached(path: &Path, size: u64) -> Option<Arc<Probe>> {
    checks().done.lock().unwrap().get(path).filter(|r| r.size == size).and_then(|r| r.probe.clone())
}

/// « Compresser les vidéos » cochée ou décochée (et à l'arrivée sur la page Importer).
#[tauri::command]
pub fn set_video_checks(app: AppHandle, on: bool) {
    static STARTED: OnceLock<()> = OnceLock::new();
    STARTED.get_or_init(|| {
        let app = app.clone();
        let _ = std::thread::Builder::new().name("lecture-videos".into()).spawn(move || worker(&app));
    });
    checks().wanted.store(on, Ordering::SeqCst);
    changed();
}

fn worker(app: &AppHandle) {
    let c = checks();
    loop {
        {
            let mut dirty = c.dirty.lock().unwrap();
            while !(*dirty && c.wanted.load(Ordering::SeqCst)) {
                dirty = c.wake.wait(dirty).unwrap();
            }
            *dirty = false;
        }
        let todo: Vec<(PathBuf, u64)> = {
            let state = app.state::<AppState>();
            let inner = state.import.inner.lock().unwrap();
            if inner.snapshot.phase != Phase::Ready {
                continue;
            }
            let listed: HashSet<&Path> = inner.files.iter().map(|f| f.path.as_path()).collect();
            let mut done = c.done.lock().unwrap();
            done.retain(|p, _| listed.contains(p.as_path()));
            inner
                .files
                .iter()
                .filter(|f| f.kind == Kind::Video && done.get(&f.path).is_none_or(|r| r.size != f.size))
                .map(|f| (f.path.clone(), f.size))
                .collect()
        };
        let Some(ff) = crate::ffmpeg::shared() else { continue };
        for (path, size) in todo {
            // Liste changée (vidéo retirée…) ou case décochée : on s'arrête, la liste sera refaite.
            if *c.dirty.lock().unwrap() || !c.wanted.load(Ordering::SeqCst) {
                break;
            }
            let probe = probe::probe(&ff.ffprobe, &path).ok().map(Arc::new);
            c.done.lock().unwrap().insert(path, Read { size, probe });
        }
    }
}

/// Fichiers de la liste que la compression laisserait tels quels (pop-in d'IMP-85).
#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Uncompressible {
    /// Extensions des images (« heif », « dng »…), sans doublon.
    pub images: Vec<String>,
    pub videos: Vec<String>,
    /// Vidéos pas encore lues : la pop-in attend (« Vérification des vidéos… »).
    pub videos_left: usize,
    pub videos_total: usize,
}

/// Images et vidéos de la liste que « Compresser les images » / « Compresser les vidéos » laisseraient telles quelles
/// (réponse Q6 A du 13/11 : celles que « Convertir … en » convertit déjà ne comptent pas). Un fichier déjà dans la
/// bibliothèque au même endroit ne compte que si la pop-in « Compresser aussi » a reçu « Oui » (IMP-60).
#[tauri::command]
pub async fn uncompressible_files(
    app: AppHandle,
    compress_quality: Option<u8>,
    convert_to: Option<Target>,
    video_quality: Option<u8>,
    convert_videos_to: Option<VideoTarget>,
    process_existing: bool,
) -> Result<Uncompressible, String> {
    tauri::async_runtime::spawn_blocking(move || -> anyhow::Result<Uncompressible> {
        let state = app.state::<AppState>();
        let video = VideoRequest { quality: video_quality, convert: convert_videos_to, fallback: None, playable: false };
        let process = Process { quality: compress_quality, convert: convert_to, fallback: None, existing: process_existing, video };
        let videos_asked = video_quality.is_some() && convert_videos_to.is_none() && crate::ffmpeg::shared().is_some();
        let inner = state.import.inner.lock().unwrap();
        let images: Vec<(PathBuf, String)> =
            inner.files.iter().filter(|f| f.kind == Kind::Image && process.uncompressible_image(&f.ext)).map(|f| (f.path.clone(), f.ext.clone())).collect();
        let videos: Vec<(PathBuf, String, u64)> = if videos_asked {
            inner.files.iter().filter(|f| f.kind == Kind::Video).map(|f| (f.path.clone(), f.ext.clone(), f.size)).collect()
        } else {
            Vec::new()
        };
        drop(inner);
        let conn = crate::db::open(&state.paths.db)?;
        let mut known = conn.prepare("SELECT 1 FROM media WHERE path = ?1")?;
        let mut counted = |path: &Path| -> anyhow::Result<bool> { Ok(process_existing || !known.exists([path.to_string_lossy()])?) };
        let mut out = Uncompressible { videos_total: videos.len(), ..Default::default() };
        let mut image_exts = BTreeSet::new();
        for (path, ext) in images {
            if counted(&path)? {
                image_exts.insert(ext);
            }
        }
        let mut video_exts = BTreeSet::new();
        for (path, ext, size) in videos {
            match cached(&path, size) {
                Some(probe) => {
                    if streams::uncompressible(&probe, &ext) == Some(true) && counted(&path)? {
                        video_exts.insert(ext);
                    }
                }
                // Illisible : rien à compresser ; pas encore lue : la pop-in attend.
                None if checks().done.lock().unwrap().get(&path).is_some_and(|r| r.size == size) => {}
                None => out.videos_left += 1,
            }
        }
        out.images = image_exts.into_iter().collect();
        out.videos = video_exts.into_iter().collect();
        Ok(out)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| format!("{e:#}"))
}

/// Au moins un fichier de la liste sera compressé ou converti (IMP-86, réponse Q17 B du 14/11) : sinon les deux
/// confirmations de « Supprimer les originaux » ne s'affichent pas (aucun original ne serait effacé). Mêmes règles que
/// l'import : réponses de la pop-in d'IMP-85 comprises ; fichier déjà dans la bibliothèque au même endroit compté
/// seulement avec « Compresser aussi » (IMP-60). Vidéo pas encore lue : comptée, par prudence. Les doublons ne sont connus
/// que pendant l'import : « Annuler l'import » se rallume à la fin si aucun fichier n'a été effacé (`run.rs`).
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn will_process(
    app: AppHandle,
    compress_quality: Option<u8>,
    convert_to: Option<Target>,
    video_quality: Option<u8>,
    convert_videos_to: Option<VideoTarget>,
    process_existing: bool,
    convert_uncompressible: Option<Target>,
    convert_uncompressible_videos: Option<VideoTarget>,
) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || -> anyhow::Result<bool> {
        let state = app.state::<AppState>();
        let video = VideoRequest { quality: video_quality, convert: convert_videos_to, fallback: convert_uncompressible_videos, playable: false };
        let process = Process { quality: compress_quality, convert: convert_to, fallback: convert_uncompressible, existing: process_existing, video };
        let files: Vec<(PathBuf, Kind, String, u64)> = {
            let inner = state.import.inner.lock().unwrap();
            inner
                .files
                .iter()
                .filter(|f| process.action(f.kind, &f.ext).is_some())
                .map(|f| (f.path.clone(), f.kind, f.ext.clone(), f.size))
                .collect()
        };
        let conn = crate::db::open(&state.paths.db)?;
        let mut known = conn.prepare("SELECT 1 FROM media WHERE path = ?1")?;
        for (path, kind, ext, size) in files {
            if !process_existing && known.exists([path.to_string_lossy()])? {
                continue;
            }
            let processed = kind != Kind::Video
                || convert_videos_to.is_some()
                || match cached(&path, size) {
                    Some(probe) => match streams::uncompressible(&probe, &ext) {
                        Some(false) => true,
                        Some(true) => convert_uncompressible_videos.is_some(),
                        None => false,
                    },
                    // Illisible par ffprobe : laissée telle quelle ; pas encore lue : comptée.
                    None => !checks().done.lock().unwrap().get(&path).is_some_and(|r| r.size == size),
                };
            if processed {
                return Ok(true);
            }
        }
        Ok(false)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| format!("{e:#}"))
}
