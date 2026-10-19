//! Favoris (FAV-01) : système dédié, une seule source de vérité (table `favorites`), jamais un tag.
//! La date d'ajout sert au tri « Ajout aux favoris » (FAV-05).

use rusqlite::params;
use tauri::State;

use crate::{AppState, db};

/// Ajoute (`on`) ou retire des médias des favoris, en une transaction (plusieurs à la fois pour la
/// sélection multiple, SEL-03). Renvoie le nombre de médias réellement ajoutés ou retirés (badge de
/// SEL-08 : ceux qui l'étaient déjà ne comptent pas).
#[tauri::command]
pub async fn set_favorite(state: State<'_, AppState>, ids: Vec<i64>, on: bool) -> Result<usize, String> {
    let mut conn = state.db.lock().unwrap();
    (|| -> rusqlite::Result<usize> {
        let tx = conn.transaction()?;
        let mut changed = 0;
        {
            let now = db::now_ms();
            let mut add = tx.prepare_cached("INSERT OR IGNORE INTO favorites (media_id, added_at) SELECT id, ?2 FROM media WHERE id = ?1")?;
            let mut remove = tx.prepare_cached("DELETE FROM favorites WHERE media_id = ?1")?;
            for id in &ids {
                changed += if on { add.execute(params![id, now])? } else { remove.execute([id])? };
            }
        }
        tx.commit()?;
        Ok(changed)
    })()
    .map_err(|e| e.to_string())
}
