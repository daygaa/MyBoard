//! Favoris (FAV-01) : système dédié, une seule source de vérité (table `favorites`), jamais un tag.
//! La date d'ajout sert au tri « Ajout aux favoris » (FAV-05).

use rusqlite::params;
use tauri::State;

use crate::{AppState, db};

/// Ajoute (`on`) ou retire des médias des favoris, en une transaction (plusieurs à la fois pour la
/// sélection multiple, SEL-03).
#[tauri::command]
pub async fn set_favorite(state: State<'_, AppState>, ids: Vec<i64>, on: bool) -> Result<(), String> {
    let mut conn = state.db.lock().unwrap();
    (|| -> rusqlite::Result<()> {
        let tx = conn.transaction()?;
        {
            let now = db::now_ms();
            let mut add = tx.prepare_cached("INSERT OR IGNORE INTO favorites (media_id, added_at) VALUES (?1, ?2)")?;
            let mut remove = tx.prepare_cached("DELETE FROM favorites WHERE media_id = ?1")?;
            for id in &ids {
                if on {
                    add.execute(params![id, now])?;
                } else {
                    remove.execute([id])?;
                }
            }
        }
        tx.commit()
    })()
    .map_err(|e| e.to_string())
}
