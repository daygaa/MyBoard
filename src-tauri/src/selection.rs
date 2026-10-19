//! Sélection multiple (SEL-03, SEL-07, SEL-08) : tous les résultats d'une vue, ce que contient une
//! sélection (favoris, dossiers, tags) et l'ajout / le retrait de tags sur toute la sélection.
//!
//! La sélection peut compter des dizaines de milliers de médias : leurs identifiants sont passés à
//! SQLite en un seul texte JSON (`json_each`), au lieu d'un paramètre par média (limité à 32 766).

use rusqlite::{Connection, params};
use serde::Serialize;
use tauri::State;

use crate::library::ListQuery;
use crate::tags::{NewTag, TAG_COLUMNS, TagInfo, get_or_create, tag_from_row};
use crate::{AppState, db};

/// Médias de la sélection, pour une requête : `media_id IN (SELECTION)` avec `?1` = liste JSON.
const SELECTION: &str = "SELECT value FROM json_each(?1)";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderCount {
    pub id: i64,
    pub count: i64,
}

/// Ce que contient la sélection : nombre de favoris, et de médias dans chaque dossier (libellés
/// « Ajouter N aux favoris », dossiers cochés, SEL-08).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionInfo {
    pub favorites: i64,
    pub folders: Vec<FolderCount>,
}

fn json(ids: &[i64]) -> String {
    serde_json::to_string(ids).unwrap_or_else(|_| "[]".into())
}

fn info(db: &Connection, ids: &str) -> rusqlite::Result<SelectionInfo> {
    let favorites = db.query_row(&format!("SELECT COUNT(*) FROM favorites WHERE media_id IN ({SELECTION})"), [ids], |r| r.get(0))?;
    let mut stmt = db.prepare(&format!("SELECT folder_id, COUNT(*) FROM folder_media WHERE media_id IN ({SELECTION}) GROUP BY folder_id"))?;
    let folders = stmt.query_map([ids], |r| Ok(FolderCount { id: r.get(0)?, count: r.get(1)? }))?.collect::<rusqlite::Result<_>>()?;
    Ok(SelectionInfo { favorites, folders })
}

/// Tags présents sur au moins un média de la sélection (champ « Retirer des tags », SEL-07), avec
/// leur nombre total de médias, les plus utilisés d'abord.
fn tags(db: &Connection, ids: &str) -> rusqlite::Result<Vec<TagInfo>> {
    let mut stmt = db.prepare(&format!(
        "SELECT {TAG_COLUMNS} FROM tags
         WHERE id IN (SELECT DISTINCT tag_id FROM media_tags WHERE media_id IN ({SELECTION}))
         ORDER BY media_count DESC, name"
    ))?;
    let rows = stmt.query_map([ids], tag_from_row)?;
    rows.collect()
}

/// Ajoute et retire des tags sur tous les médias de la sélection, en une transaction (D-005) ; un
/// tag ajouté qui n'existe pas encore est créé. Les compteurs suivent par les déclencheurs.
fn edit_tags(conn: &mut Connection, ids: &str, add: &[NewTag], remove: &[i64]) -> anyhow::Result<()> {
    let tx = conn.transaction()?;
    let now = db::now_ms();
    for tag in add {
        let Some(tag_id) = get_or_create(&tx, tag, now)? else { continue };
        // Médias supprimés depuis leur sélection : ignorés.
        tx.prepare_cached(&format!("INSERT OR IGNORE INTO media_tags (media_id, tag_id) SELECT id, ?2 FROM media WHERE id IN ({SELECTION})"))?
            .execute(params![ids, tag_id])?;
    }
    for tag_id in remove {
        tx.prepare_cached(&format!("DELETE FROM media_tags WHERE tag_id = ?2 AND media_id IN ({SELECTION})"))?
            .execute(params![ids, tag_id])?;
    }
    tx.commit()?;
    Ok(())
}

// --- Commandes appelées par l'interface ---

/// « Sélectionner tous les résultats » (SEL-03) : tous les médias de la vue, de la recherche et des
/// types cochés, toutes pages confondues.
#[tauri::command]
pub async fn result_ids(state: State<'_, AppState>, query: ListQuery) -> Result<Vec<u32>, String> {
    state.search.all_ids(&query).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn selection_info(state: State<'_, AppState>, ids: Vec<i64>) -> Result<SelectionInfo, String> {
    info(&state.db.lock().unwrap(), &json(&ids)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn selection_tags(state: State<'_, AppState>, ids: Vec<i64>) -> Result<Vec<TagInfo>, String> {
    tags(&state.db.lock().unwrap(), &json(&ids)).map_err(|e| e.to_string())
}

/// Barre du bas de la sélection (SEL-07) : « Appliquer ».
#[tauri::command]
pub async fn edit_selection_tags(state: State<'_, AppState>, ids: Vec<i64>, add: Vec<NewTag>, remove: Vec<i64>) -> Result<(), String> {
    edit_tags(&mut state.db.lock().unwrap(), &json(&ids), &add, &remove).map_err(|e| format!("{e:#}"))
}
