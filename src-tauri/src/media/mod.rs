//! Un média précis, pour la visionneuse : fiche détaillée (VIEW-10, VIEW-23), ouverture dans
//! l'Explorateur (VIEW-13) ou dans l'application par défaut (VIEW-24), fichier original
//! servi par le protocole `media://` (voir `protocol.rs`).

pub mod protocol;

use std::path::{Path, PathBuf};

use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;
use tauri::State;

use crate::AppState;
use crate::tags::{TagInfo, tags_of_media};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaDetail {
    pub id: i64,
    pub path: String,
    /// Date de création du fichier, ms depuis 1970 (VIEW-10).
    pub file_created_at: Option<i64>,
    pub imported_at: i64,
    pub tags: Vec<TagInfo>,
}

pub fn detail(db: &Connection, id: i64) -> rusqlite::Result<Option<MediaDetail>> {
    let row = db
        .prepare_cached("SELECT path, file_created_at, imported_at FROM media WHERE id = ?1")?
        .query_row([id], |r| Ok((r.get::<_, String>(0)?, r.get(1)?, r.get(2)?)))
        .optional()?;
    let Some((path, file_created_at, imported_at)) = row else { return Ok(None) };
    Ok(Some(MediaDetail { id, path, file_created_at, imported_at, tags: tags_of_media(db, &[id])? }))
}

/// Chemin du fichier d'un média ; erreur claire s'il a disparu du disque.
fn existing_path(state: &AppState, id: i64) -> Result<PathBuf, String> {
    let path: Option<String> = state
        .db
        .lock()
        .unwrap()
        .query_row("SELECT path FROM media WHERE id = ?1", [id], |r| r.get(0))
        .optional()
        .map_err(|e| e.to_string())?;
    let path = PathBuf::from(path.ok_or("Média introuvable dans la bibliothèque.")?);
    if !path.exists() {
        return Err(format!("Fichier introuvable : {}", path.display()));
    }
    Ok(path)
}

#[tauri::command]
pub async fn media_detail(state: State<'_, AppState>, id: i64) -> Result<Option<MediaDetail>, String> {
    detail(&state.db.lock().unwrap(), id).map_err(|e| e.to_string())
}

/// Explorateur Windows ouvert sur le dossier, fichier sélectionné : `explorer /select,"<chemin>"`.
/// Le chemin entre guillemets doit suivre la virgule tel quel : `raw_arg` évite l'échappement
/// automatique de Rust, que l'Explorateur ne comprend pas.
#[cfg(windows)]
fn reveal(path: &Path) -> std::io::Result<()> {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("explorer.exe").raw_arg(format!("/select,\"{}\"", path.display())).spawn().map(|_| ())
}

/// Hors Windows : ouvre simplement le dossier.
#[cfg(not(windows))]
fn reveal(path: &Path) -> std::io::Result<()> {
    opener::open(path.parent().unwrap_or(path)).map_err(std::io::Error::other)
}

/// Ouvre l'Explorateur Windows sur le dossier du média, fichier sélectionné (VIEW-13).
#[tauri::command]
pub async fn reveal_media(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let path = existing_path(&state, id)?;
    reveal(&path).map_err(|e| e.to_string())
}

/// Ouvre le média comme un double-clic dans l'Explorateur (VIEW-24).
#[tauri::command]
pub async fn open_media(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let path = existing_path(&state, id)?;
    opener::open(&path).map_err(|e| e.to_string())
}
