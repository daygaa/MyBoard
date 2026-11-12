//! Sélection multiple (SEL-03, SEL-07, SEL-08) : tous les résultats d'une vue, ce que contient une
//! sélection (favoris, dossiers, tags) et l'ajout / le retrait de tags sur toute la sélection.
//!
//! La sélection peut compter des dizaines de milliers de médias : leurs identifiants sont passés à
//! SQLite en un seul texte JSON (`json_each`), au lieu d'un paramètre par média (limité à 32 766).

use rusqlite::{Connection, TransactionBehavior, params};
use serde::Serialize;
use tauri::State;

use crate::library::ListQuery;
use crate::tagging::{Tagger, resolve_or_create};
use crate::tags::{NewTag, TAG_COLUMNS, TagInfo, tag_from_row};
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
/// tag ajouté qui n'existe pas encore est créé, un synonyme donne son tag principal et les parents
/// suivent (TAGM-15, TAGM-16). Les compteurs suivent par les déclencheurs.
fn edit_tags(conn: &mut Connection, ids: &str, add: &[NewTag], remove: &[i64]) -> anyhow::Result<()> {
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now_ms();
    // Médias supprimés depuis leur sélection : ignorés.
    let media = tx
        .prepare(&format!("SELECT id FROM media WHERE id IN ({SELECTION})"))?
        .query_map([ids], |r| r.get::<_, i64>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let tagger = Tagger::load(&tx)?;
    for tag in add {
        let Some(target) = resolve_or_create(&tx, tag, now)? else { continue };
        if target.name_id.is_none() && !tagger.has_rules(target.tag_id) {
            // Ni nom fusionné à noter ni parent à poser : une seule requête, comme avant le lot 5.
            tx.prepare_cached(&format!("INSERT OR IGNORE INTO media_tags (media_id, tag_id) SELECT id, ?2 FROM media WHERE id IN ({SELECTION})"))?
                .execute(params![ids, target.tag_id])?;
            continue;
        }
        for &m in &media {
            tagger.attach(&tx, m, target)?;
        }
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

/// Tags posés sur TOUS les médias de la sélection : le champ « Ajouter des tags » ne les propose pas,
/// les ajouter ne changerait rien (SRCH-29).
#[tauri::command]
pub async fn selection_common_tags(state: State<'_, AppState>, ids: Vec<i64>) -> Result<Vec<String>, String> {
    common_tags(&state.db.lock().unwrap(), &json(&ids)).map_err(|e| e.to_string())
}

fn common_tags(db: &Connection, ids: &str) -> rusqlite::Result<Vec<String>> {
    let mut stmt = db.prepare(&format!(
        "SELECT t.name FROM tags t JOIN (
           SELECT tag_id FROM media_tags WHERE media_id IN ({SELECTION}) GROUP BY tag_id
           HAVING COUNT(*) = (SELECT COUNT(*) FROM media WHERE id IN ({SELECTION}))
         ) c ON c.tag_id = t.id"
    ))?;
    let rows = stmt.query_map([ids], |r| r.get(0))?;
    rows.collect()
}

/// Barre du bas de la sélection (SEL-07) : « Appliquer ».
#[tauri::command]
pub async fn edit_selection_tags(state: State<'_, AppState>, ids: Vec<i64>, add: Vec<NewTag>, remove: Vec<i64>) -> Result<(), String> {
    let _hold = state.tag_jobs.hold(); // après le travail sur les tags en arrière-plan (TAGM-23)
    edit_tags(&mut state.db.lock().unwrap(), &json(&ids), &add, &remove).map_err(|e| format!("{e:#}"))
}
