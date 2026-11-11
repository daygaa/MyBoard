//! Conversion d'une vidéo illisible depuis la visionneuse (VIEW-25 ; réponses du 09/11 et du 11/11) : la copie est écrite
//! à côté de l'original et la fiche (tags, favoris, dossiers, note) passe à la copie, comme IMP-60 ; l'original reste
//! sur le disque, sauf avec « Supprimer l'original » (confirmé deux fois ; effacé une fois la fiche changée, jamais s'il
//! est encore le fichier d'un média). Le résultat doit être lu par MyBoard (`playable`). Une conversion à la fois ;
//! avancement et fin envoyés à la fenêtre ; « Annuler » coupe ffmpeg.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use anyhow::{Context, bail};
use rusqlite::{Connection, params};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use super::plan::{VideoRequest, VideoTarget};
use super::video::{self, Done, Hooks};
use crate::library::MediaItem;
use crate::{AppState, db};

static RUNNING: AtomicBool = AtomicBool::new(false);
static CANCEL: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress {
    id: i64,
    fraction: f32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Finished {
    id: i64,
    /// Fiche à jour (nouveau fichier) ; absente : annulée ou échouée.
    item: Option<MediaItem>,
    error: Option<String>,
    cancelled: bool,
    /// Sous-titres en images laissés : le format choisi ne les accepte pas (IMP-73).
    lost_subtitles: bool,
}

/// Lance la conversion ; `quality` : cran 0 (Minimale) à 4 (Maximale : aucune compression voulue, nom sans « _c »).
#[tauri::command]
pub fn convert_video(app: AppHandle, id: i64, target: VideoTarget, quality: u8, delete_original: bool) -> Result<(), String> {
    if RUNNING.swap(true, Ordering::SeqCst) {
        return Err("Une conversion est déjà en cours.".into());
    }
    CANCEL.store(false, Ordering::SeqCst);
    let spawned = std::thread::Builder::new().name("conversion-video".into()).spawn(move || {
        let done = match convert(&app, id, target, quality, delete_original) {
            Ok(Some((item, lost_subtitles))) => Finished { id, item, error: None, cancelled: false, lost_subtitles },
            Ok(None) => Finished { id, item: None, error: None, cancelled: true, lost_subtitles: false },
            Err(e) => Finished { id, item: None, error: Some(format!("{e:#}")), cancelled: false, lost_subtitles: false },
        };
        RUNNING.store(false, Ordering::SeqCst);
        let _ = app.emit("video-converted", done);
        let _ = app.emit("library-changed", ());
    });
    if let Err(e) = spawned {
        RUNNING.store(false, Ordering::SeqCst);
        return Err(e.to_string());
    }
    Ok(())
}

/// Bouton « Annuler » pendant la conversion.
#[tauri::command]
pub fn cancel_video_conversion() {
    CANCEL.store(true, Ordering::SeqCst);
}

/// `None` : annulée.
fn convert(app: &AppHandle, id: i64, target: VideoTarget, quality: u8, delete_original: bool) -> anyhow::Result<Option<(Option<MediaItem>, bool)>> {
    let state = app.state::<AppState>();
    let conn = db::open(&state.paths.db)?;
    let (path, hash): (String, String) = conn
        .query_row("SELECT path, hash FROM media WHERE id = ?1 AND kind = 'video'", [id], |r| Ok((r.get(0)?, r.get(1)?)))
        .context("vidéo introuvable dans la bibliothèque")?;
    let path = PathBuf::from(path);
    let meta = std::fs::metadata(&path).context("fichier introuvable sur le disque")?;
    let report = |fraction: Option<f32>| {
        if let Some(fraction) = fraction {
            let _ = app.emit("video-conversion-progress", Progress { id, fraction });
        }
    };
    let hooks = Hooks { cancel: &CANCEL, progress: &report, gate: None };
    let request = VideoRequest { quality: (quality < 4).then_some(quality), convert: Some(target), playable: true };
    let (new_path, new_hash, size, ext, lost) = match video::process(&conn, &path, &meta, request, &hooks)? {
        Done::Cancelled => return Ok(None),
        Done::Kept(_) => bail!("rien à convertir : cette vidéo est déjà dans ce format"),
        Done::Written { path, hash, size, ext, lost_subtitles, .. } => (path, hash, size, ext, lost_subtitles),
    };
    let placed = take_place(&conn, id, &new_path, &new_hash, &hash, size, &ext);
    if placed.is_err() {
        let _ = std::fs::remove_file(&new_path);
    }
    // Enregistrée en base (ou effacée) : elle sort du journal des écritures (IMP-42).
    super::journal::remove(&[PathBuf::from(&new_path)]);
    placed?;
    if delete_original && !used(&conn, &path)? {
        std::fs::remove_file(&path).with_context(|| format!("la vidéo est convertie, mais l'original n'a pas pu être effacé ({})", path.display()))?;
    }
    state.thumbs.wake();
    let item = crate::library::media_rows(&conn, &[u32::try_from(id)?])?.into_iter().next();
    Ok(Some((item, lost)))
}

/// La fiche passe au nouveau fichier (une transaction) ; il retient l'empreinte de l'original (son réimport compte
/// comme doublon) et la table des versions le note (IMP-68). Miniature, dimensions et durée refaites ensuite.
fn take_place(conn: &Connection, id: i64, path: &str, hash: &str, original: &str, size: i64, ext: &str) -> anyhow::Result<()> {
    let file_name = Path::new(path).file_name().and_then(|n| n.to_str()).unwrap_or(path).to_owned();
    let modified = std::fs::metadata(path)?.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_millis() as i64);
    conn.execute_batch("BEGIN IMMEDIATE")?;
    let written = (|| -> anyhow::Result<()> {
        conn.execute(
            "UPDATE media SET path = ?1, file_name = ?2, name_key = ?3, hash = ?4, original_hash = ?5, size = ?6, ext = ?7,
                 file_modified_at = ?8, thumb_status = 0
             WHERE id = ?9",
            params![path, file_name, crate::db::name_key::name_key(&file_name), hash, original, size, ext, modified, id],
        )?;
        super::versions::remember(conn, hash, original)?;
        Ok(())
    })();
    match written {
        Ok(()) => conn.execute_batch("COMMIT")?,
        Err(e) => {
            let _ = conn.execute_batch("ROLLBACK");
            return Err(e);
        }
    }
    Ok(())
}

fn used(conn: &Connection, path: &Path) -> rusqlite::Result<bool> {
    conn.prepare_cached("SELECT 1 FROM media WHERE path = ?1")?.exists([path.to_string_lossy()])
}
