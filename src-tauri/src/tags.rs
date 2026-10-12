//! Tags et catégories : autocomplétion, tags d'une page, ajout / retrait sur un média.
//!
//! Les compteurs (`tags.media_count`, `media.tag_count`) sont tenus par les déclencheurs SQL
//! (D-005) : ce module n'y touche jamais. Un tag est lié à l'identifiant du média, jamais à
//! son nom de fichier (LIB-04).

use rusqlite::{Connection, OptionalExtension, params, params_from_iter};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{AppState, db};

/// Suggestions d'autocomplétion au plus (D-016).
const SUGGESTIONS: u32 = 10;
/// Catégorie d'un tag créé sans précision (import de JSON sans catégories…).
pub const DEFAULT_CATEGORY: &str = "general";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: i64,
    pub key: String,
    pub name: String,
    pub color: String,
    pub sort_order: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagInfo {
    pub id: i64,
    pub name: String,
    pub category_id: i64,
    /// Nombre total de médias de la bibliothèque qui portent ce tag (SRCH-10).
    pub media_count: i64,
}

/// Tag à créer s'il n'existe pas encore (visionneuse, tags par défaut de l'import).
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTag {
    pub name: String,
    /// Ignorée si le tag existe déjà : il garde sa catégorie (IMP-31).
    pub category_id: Option<i64>,
}

/// Nom de tag normalisé : minuscules, espaces → « _ » (SRCH-05, D-016).
/// Un « - » au début (exclusion) et un « * » à la fin (joker) sont réservés à la recherche.
pub fn normalize(raw: &str) -> Option<String> {
    let name = raw.split_whitespace().collect::<Vec<_>>().join("_").to_lowercase();
    let name = name.trim_start_matches('-').trim_end_matches('*');
    (!name.is_empty()).then(|| name.to_string())
}

fn tag_from_row(r: &rusqlite::Row) -> rusqlite::Result<TagInfo> {
    Ok(TagInfo { id: r.get(0)?, name: r.get(1)?, category_id: r.get(2)?, media_count: r.get(3)? })
}

pub fn categories(db: &Connection) -> rusqlite::Result<Vec<Category>> {
    let mut stmt = db.prepare_cached("SELECT id, key, name, color, sort_order FROM tag_categories ORDER BY sort_order")?;
    let rows = stmt.query_map([], |r| {
        Ok(Category { id: r.get(0)?, key: r.get(1)?, name: r.get(2)?, color: r.get(3)?, sort_order: r.get(4)? })
    })?;
    rows.collect()
}

/// Autocomplétion (SRCH-06, D-016) : d'abord les tags qui COMMENCENT par le texte, puis ceux
/// qui le CONTIENNENT ; les plus utilisés en premier. Les tags masqués ne sont pas proposés (TAGM-05).
pub fn autocomplete(db: &Connection, text: &str) -> rusqlite::Result<Vec<TagInfo>> {
    let Some(prefix) = normalize(text) else { return Ok(Vec::new()) };
    // Bornes [prefix, prefix + U+10FFFF) : la recherche utilise l'index unique sur `name`.
    let upper = format!("{prefix}\u{10FFFF}");
    let mut found: Vec<TagInfo> = db
        .prepare_cached(
            "SELECT id, name, category_id, media_count FROM tags
             WHERE name >= ?1 AND name < ?2 AND hidden = 0
             ORDER BY media_count DESC, name LIMIT ?3",
        )?
        .query_map(params![prefix, upper, SUGGESTIONS], tag_from_row)?
        .collect::<Result<_, _>>()?;
    let missing = SUGGESTIONS as usize - found.len().min(SUGGESTIONS as usize);
    if missing > 0 {
        let more = db
            .prepare_cached(
                "SELECT id, name, category_id, media_count FROM tags
                 WHERE instr(name, ?1) > 1 AND hidden = 0
                 ORDER BY media_count DESC, name LIMIT ?2",
            )?
            .query_map(params![prefix, missing as i64], tag_from_row)?
            .collect::<Result<Vec<_>, _>>()?;
        found.extend(more);
    }
    Ok(found)
}

/// Tag existant portant exactement ce nom (après normalisation).
pub fn find(db: &Connection, name: &str) -> rusqlite::Result<Option<TagInfo>> {
    let Some(name) = normalize(name) else { return Ok(None) };
    db.prepare_cached("SELECT id, name, category_id, media_count FROM tags WHERE name = ?1")?
        .query_row([name], tag_from_row)
        .optional()
}

/// Tags présents sur ces médias, chacun avec son nombre TOTAL de médias (SRCH-10).
pub fn tags_of_media(db: &Connection, ids: &[i64]) -> rusqlite::Result<Vec<TagInfo>> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let sql = format!(
        "SELECT id, name, category_id, media_count FROM tags
         WHERE id IN (SELECT DISTINCT tag_id FROM media_tags WHERE media_id IN ({}))
         ORDER BY media_count DESC, name",
        vec!["?"; ids.len()].join(",")
    );
    let mut stmt = db.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(ids), tag_from_row)?;
    rows.collect()
}

/// Identifiant du tag, créé s'il n'existe pas. À appeler dans une transaction ouverte par
/// l'appelant (D-005). Renvoie `None` si le nom est vide après normalisation.
pub fn get_or_create(tx: &Connection, tag: &NewTag, now: i64) -> anyhow::Result<Option<i64>> {
    let Some(name) = normalize(&tag.name) else { return Ok(None) };
    let existing: Option<i64> = tx
        .prepare_cached("SELECT id FROM tags WHERE name = ?1")?
        .query_row([&name], |r| r.get(0))
        .optional()?;
    if let Some(id) = existing {
        return Ok(Some(id));
    }
    let category = match tag.category_id {
        Some(id) => id,
        None => tx.query_row("SELECT id FROM tag_categories WHERE key = ?1", [DEFAULT_CATEGORY], |r| r.get(0))?,
    };
    tx.prepare_cached("INSERT INTO tags (name, category_id, created_at) VALUES (?1, ?2, ?3)")?
        .execute(params![name, category, now])?;
    Ok(Some(tx.last_insert_rowid()))
}

/// Lie un tag à un média ; sans effet s'il l'est déjà (idempotent).
pub fn attach(tx: &Connection, media_id: i64, tag_id: i64) -> rusqlite::Result<()> {
    tx.prepare_cached("INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?1, ?2)")?
        .execute(params![media_id, tag_id])?;
    Ok(())
}

// --- Commandes appelées par l'interface ---

#[tauri::command]
pub async fn tag_categories(state: State<'_, AppState>) -> Result<Vec<Category>, String> {
    categories(&state.db.lock().unwrap()).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn autocomplete_tags(state: State<'_, AppState>, text: String) -> Result<Vec<TagInfo>, String> {
    autocomplete(&state.db.lock().unwrap(), &text).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn find_tag(state: State<'_, AppState>, name: String) -> Result<Option<TagInfo>, String> {
    find(&state.db.lock().unwrap(), &name).map_err(|e| e.to_string())
}

/// Barre latérale : tags des médias de la page affichée (SRCH-10).
#[tauri::command]
pub async fn page_tags(state: State<'_, AppState>, ids: Vec<i64>) -> Result<Vec<TagInfo>, String> {
    tags_of_media(&state.db.lock().unwrap(), &ids).map_err(|e| e.to_string())
}

/// Ajoute un tag à un média (VIEW-22) ; le crée s'il n'existe pas (TAGM-07).
#[tauri::command]
pub async fn add_media_tag(state: State<'_, AppState>, media_id: i64, tag: NewTag) -> Result<(), String> {
    let mut conn = state.db.lock().unwrap();
    (|| -> anyhow::Result<()> {
        let tx = conn.transaction()?;
        let tag_id = get_or_create(&tx, &tag, db::now_ms())?.ok_or_else(|| anyhow::anyhow!("nom de tag vide"))?;
        attach(&tx, media_id, tag_id)?;
        tx.commit()?;
        Ok(())
    })()
    .map_err(|e| format!("{e:#}"))
}

/// Retire un tag d'un média (VIEW-23) ; le compteur baisse aussitôt (SRCH-14).
#[tauri::command]
pub async fn remove_media_tag(state: State<'_, AppState>, media_id: i64, tag_id: i64) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    db.execute("DELETE FROM media_tags WHERE media_id = ?1 AND tag_id = ?2", params![media_id, tag_id])
        .map(|_| ())
        .map_err(|e| e.to_string())
}
