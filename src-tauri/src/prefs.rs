//! Réglages gardés dans la bibliothèque elle-même (table `settings` : une clé, un texte) : ils suivent la base et
//! survivent au redémarrage, contrairement aux préférences de l'interface (gardées par la fenêtre, communes à toutes les
//! bibliothèques). Premier usage : cases « Appliquer » décochées de la pop-in de fusion (TAGM-27, réponse Q19 A du 14/11).

use rusqlite::{OptionalExtension, params};
use tauri::State;

use crate::AppState;

/// Valeur d'un réglage de la bibliothèque ; `None` : jamais écrit.
#[tauri::command]
pub async fn library_setting(state: State<'_, AppState>, key: String) -> Result<Option<String>, String> {
    let db = state.db.lock().unwrap();
    db.query_row("SELECT value FROM settings WHERE key = ?1", [&key], |r| r.get(0)).optional().map_err(|e| e.to_string())
}

/// Écrit un réglage de la bibliothèque ; `None` : l'efface.
#[tauri::command]
pub async fn set_library_setting(state: State<'_, AppState>, key: String, value: Option<String>) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    match value {
        Some(value) => db.execute("INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value", params![key, value]),
        None => db.execute("DELETE FROM settings WHERE key = ?1", [&key]),
    }
    .map(|_| ())
    .map_err(|e| e.to_string())
}
