//! Rotation de ± 90° d'une image ou d'une vidéo (VIEW-60 ; réponses Q21, Q24 A et Q25 A du 14/11).
//! - JPEG, TIFF, DNG, RAW à structure TIFF (CR2, NEF, NRW, ARW, PEF), MP4, MOV, 3GP : rotation écrite dans le fichier,
//!   sans perte (étiquette d'orientation, matrice d'affichage : `orientation.rs`, `mp4.rs` ; réponse Q61 A). Le fichier
//!   change d'empreinte : sa fiche est mise à jour (exception voulue à « l'original n'est jamais modifié »), l'empreinte
//!   d'avant est gardée (doublons, réponse Q64 A) et ses miniatures, tournées, sont rangées sous la nouvelle.
//! - Autres formats, ou fichier impossible à écrire (lecture seule, ouvert ailleurs, structure inconnue) : rotation
//!   d'affichage seulement, gardée dans la base (`media.rotation`, schéma 23), appliquée par l'interface.

mod mp4;
mod orientation;

use std::path::Path;
use std::sync::Mutex;

use rusqlite::{ErrorCode, OptionalExtension, params};
use tauri::State;

use super::{OpenFailure, existing_path};
use crate::AppState;
use crate::import::versions;
use crate::library::{MediaItem, media_rows};

/// Une rotation à la fois : des appuis rapides sur R s'enchaînent dans l'ordre, chacun sur le fichier déjà tourné.
static ONE_AT_A_TIME: Mutex<()> = Mutex::new(());

/// Façon d'écrire la rotation dans le fichier, selon son extension ; `None` : affichage seulement.
fn writer(ext: &str) -> Option<fn(&Path, bool) -> anyhow::Result<()>> {
    match ext {
        "jpg" | "jpeg" | "jpe" | "jfif" => Some(orientation::turn_jpeg),
        // RAW essayés (réponse Q61 A) : leur décodeur lit l'étiquette du premier répertoire. Pas ORF, RW2, CR3, RAF
        // (autre structure) ; les autres RAW à structure TIFF, sans fichier d'essai, restent en rotation d'affichage.
        "tif" | "tiff" | "dng" | "cr2" | "nef" | "nrw" | "arw" | "pef" => Some(orientation::turn_tiff),
        "mp4" | "m4v" | "mov" | "3gp" => Some(mp4::turn_mp4),
        _ => None,
    }
}

fn failure(e: impl std::fmt::Display) -> OpenFailure {
    OpenFailure::new(None, e.to_string())
}

/// Tourne le média d'un quart de tour ; renvoie sa fiche à jour (empreinte, dimensions, rotation d'affichage).
#[tauri::command]
pub async fn rotate_media(state: State<'_, AppState>, id: i64, clockwise: bool) -> Result<MediaItem, OpenFailure> {
    let _turn = ONE_AT_A_TIME.lock().unwrap_or_else(|e| e.into_inner());
    let path = existing_path(&state, id)?;
    let row: Option<(String, String, String, Option<String>)> = state
        .db
        .lock()
        .unwrap()
        .query_row("SELECT kind, ext, hash, original_hash FROM media WHERE id = ?1", [id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))
        .optional()
        .map_err(failure)?;
    let (kind, ext, hash, original) = row.ok_or_else(|| failure("Média introuvable dans la bibliothèque."))?;
    if kind != "image" && kind != "video" {
        return Err(failure("Seules les images et les vidéos peuvent être tournées."));
    }
    let written = match writer(&ext.to_lowercase()) {
        Some(write) => match write(&path, clockwise) {
            Ok(()) => true,
            Err(e) => {
                eprintln!("[rotation] {} : {e:#} ; rotation d'affichage seulement", path.display());
                false
            }
        },
        None => false,
    };
    if written {
        after_write(&state, id, &path, (&hash, original.as_deref()), clockwise, writer(&ext.to_lowercase()))?;
    } else {
        let quarter = if clockwise { 1 } else { 3 };
        state
            .db
            .lock()
            .unwrap()
            .execute("UPDATE media SET rotation = (rotation + ?1) % 4 WHERE id = ?2", params![quarter, id])
            .map_err(failure)?;
    }
    let items = media_rows(&state.db.lock().unwrap(), &[u32::try_from(id).map_err(failure)?]).map_err(failure)?;
    items.into_iter().next().ok_or_else(|| failure("Média introuvable dans la bibliothèque."))
}

/// Fichier tourné : nouvelle empreinte, poids, date de modification, largeur et hauteur échangées ; miniatures tournées.
/// Un autre média ayant déjà exactement ce contenu (copie déjà tournée) : le fichier est remis comme avant.
fn after_write(
    state: &AppState,
    id: i64,
    path: &Path,
    (old, original): (&str, Option<&str>),
    clockwise: bool,
    write: Option<fn(&Path, bool) -> anyhow::Result<()>>,
) -> Result<(), OpenFailure> {
    let hash = versions::hash_file_parallel(path)?;
    let meta = std::fs::metadata(path)?;
    let modified = meta.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_millis() as i64);
    let saved = {
        let mut db = state.db.lock().unwrap();
        let tx = db.transaction().map_err(failure)?;
        let updated = tx.execute(
            "UPDATE media SET hash = ?1, size = ?2, file_modified_at = ?3, width = height, height = width WHERE id = ?4",
            params![hash, meta.len() as i64, modified, id],
        );
        match updated {
            Err(rusqlite::Error::SqliteFailure(e, _)) if e.code == ErrorCode::ConstraintViolation => Ok(false),
            Err(e) => Err(failure(e)),
            Ok(_) => {
                // Version écrite par MyBoard (IMP-68) : la nouvelle empreinte reste reliée à son original.
                if let Some(original) = original {
                    versions::remember(&tx, &hash, original).map_err(failure)?;
                }
                // Empreinte d'avant gardée : la même photo non tournée, importée d'ailleurs, est un doublon (Q64 A).
                versions::remember_turned(&tx, old, id).map_err(failure)?;
                tx.commit().map_err(failure)?;
                Ok(true)
            }
        }
    }?;
    if !saved {
        if let Some(write) = write {
            let _ = write(path, !clockwise);
        }
        return Err(failure("Un autre média de la bibliothèque a déjà exactement ce contenu : rotation annulée."));
    }
    if !state.thumbs.copy_turned(old, &hash, clockwise).unwrap_or(false) {
        let _ = state.db.lock().unwrap().execute("UPDATE media SET thumb_status = ?1 WHERE id = ?2", params![crate::thumbs::status::TODO, id]);
        state.thumbs.wake();
    }
    Ok(())
}
