//! Un média précis, pour la visionneuse : fiche détaillée (VIEW-10, VIEW-23), notes (VIEW-19),
//! ouverture dans l'Explorateur (VIEW-13) ou dans l'application par défaut (VIEW-24), copie du
//! fichier dans le presse-papiers (VIEW-35), avec le code d'erreur Windows en cas d'échec
//! (VIEW-28). Fichier original servi par le protocole `media://` (voir `protocol.rs`). L'image
//! elle-même (copie, fond d'écran, capture d'une vidéo) : `picture.rs`.

mod clipboard;
pub mod picture;
pub mod protocol;

use std::path::{Path, PathBuf};

use rusqlite::{Connection, OptionalExtension, params};
use serde::Serialize;
use tauri::State;

use crate::AppState;
use crate::tags::{TagInfo, tags_of_media};

/// Codes d'erreur Windows utilisés par MyBoard lui-même.
const ERROR_FILE_NOT_FOUND: i32 = 2;
const ERROR_PATH_NOT_FOUND: i32 = 3;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaDetail {
    pub id: i64,
    pub path: String,
    /// Date de création du fichier, ms depuis 1970 (VIEW-10).
    pub file_created_at: Option<i64>,
    pub imported_at: i64,
    pub tags: Vec<TagInfo>,
    /// Note libre (VIEW-19).
    pub notes: Option<String>,
}

/// Échec d'une ouverture externe (VIEW-28) : code d'erreur Windows quand il est connu, et
/// message (celui de Windows, dans la langue du système, ou celui de MyBoard).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenFailure {
    pub code: Option<i32>,
    pub message: String,
}

impl OpenFailure {
    fn new(code: Option<i32>, message: impl Into<String>) -> Self {
        Self { code, message: message.into() }
    }
}

impl From<std::io::Error> for OpenFailure {
    fn from(e: std::io::Error) -> Self {
        // « Le fichier spécifié est introuvable. (os error 2) » : le code est donné à part.
        let text = e.to_string();
        let message = text.split(" (os error").next().unwrap_or(&text).trim().to_string();
        Self::new(e.raw_os_error(), message)
    }
}

pub fn detail(db: &Connection, id: i64) -> rusqlite::Result<Option<MediaDetail>> {
    let row = db
        .prepare_cached("SELECT path, file_created_at, imported_at, notes FROM media WHERE id = ?1")?
        .query_row([id], |r| Ok((r.get::<_, String>(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))
        .optional()?;
    let Some((path, file_created_at, imported_at, notes)) = row else { return Ok(None) };
    Ok(Some(MediaDetail { id, path, file_created_at, imported_at, tags: tags_of_media(db, &[id])?, notes }))
}

/// Chemin du fichier d'un média ; erreur claire s'il a disparu du disque.
fn existing_path(state: &AppState, id: i64) -> Result<PathBuf, OpenFailure> {
    let path: Option<String> = state
        .db
        .lock()
        .unwrap()
        .query_row("SELECT path FROM media WHERE id = ?1", [id], |r| r.get(0))
        .optional()
        .map_err(|e| OpenFailure::new(None, e.to_string()))?;
    let path = PathBuf::from(path.ok_or_else(|| OpenFailure::new(None, "Média introuvable dans la bibliothèque."))?);
    if !path.try_exists()? {
        // Dossier entier absent (disque débranché, dossier renommé…) ou fichier seul absent.
        let folder_missing = path.parent().is_some_and(|dir| !dir.exists());
        return Err(if folder_missing {
            OpenFailure::new(Some(ERROR_PATH_NOT_FOUND), format!("Dossier introuvable : {}", path.display()))
        } else {
            OpenFailure::new(Some(ERROR_FILE_NOT_FOUND), format!("Fichier introuvable : {}", path.display()))
        });
    }
    Ok(path)
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

fn from_opener(e: opener::OpenError) -> OpenFailure {
    match e {
        opener::OpenError::Io(io) => io.into(),
        other => OpenFailure::new(None, other.to_string()),
    }
}

#[tauri::command]
pub async fn media_detail(state: State<'_, AppState>, id: i64) -> Result<Option<MediaDetail>, String> {
    detail(&state.db.lock().unwrap(), id).map_err(|e| e.to_string())
}

/// Ouvre l'Explorateur Windows sur le dossier du média, fichier sélectionné (VIEW-13).
#[tauri::command]
pub async fn reveal_media(state: State<'_, AppState>, id: i64) -> Result<(), OpenFailure> {
    let path = existing_path(&state, id)?;
    Ok(reveal(&path)?)
}

/// Ouvre le média comme un double-clic dans l'Explorateur (VIEW-24).
#[tauri::command]
pub async fn open_media(state: State<'_, AppState>, id: i64) -> Result<(), OpenFailure> {
    let path = existing_path(&state, id)?;
    opener::open(&path).map_err(from_opener)
}

/// Copie le fichier du média dans le presse-papiers, comme Ctrl + C dans l'Explorateur (VIEW-35).
#[tauri::command]
pub async fn copy_media(state: State<'_, AppState>, id: i64) -> Result<(), OpenFailure> {
    let path = existing_path(&state, id)?;
    clipboard::copy_file(&path)
}

/// Enregistre la note d'un média (VIEW-19) ; une note vide est effacée.
#[tauri::command]
pub async fn set_media_notes(state: State<'_, AppState>, id: i64, notes: String) -> Result<(), String> {
    let notes = Some(notes).filter(|n| !n.trim().is_empty());
    let db = state.db.lock().unwrap();
    db.execute("UPDATE media SET notes = ?1 WHERE id = ?2", params![notes, id])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Ouvre un lien d'une note dans le navigateur par défaut (VIEW-19). Seuls les liens web sont
/// acceptés : une note ne doit jamais pouvoir lancer un programme.
#[tauri::command]
pub async fn open_url(url: String) -> Result<(), OpenFailure> {
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://")) {
        return Err(OpenFailure::new(None, "Seuls les liens web (http, https) peuvent être ouverts."));
    }
    opener::open(&url).map_err(from_opener)
}
