//! Gestionnaire de tags (TAGM-04, TAGM-05, TAGM-08, TAGM-10 à TAGM-14) et menus des tags (CTX-04,
//! CTX-12) : liste de tous les tags, renommer (fusion si le nom existe), fusionner, changer de
//! catégorie, masquer, supprimer, description, import d'une liste, groupes de tags proches ignorés.
//!
//! Chaque opération multiple est une transaction ; les compteurs (`tags.media_count`,
//! `media.tag_count`) et l'index de recherche suivent par les déclencheurs de la base (D-005, D-027).

use rusqlite::{Connection, OptionalExtension, params, params_from_iter};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::tags::{DEFAULT_CATEGORY, normalize};
use crate::{AppState, db};

/// Un tag tel que le montre le gestionnaire.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedTag {
    pub id: i64,
    pub name: String,
    pub category_id: i64,
    pub media_count: i64,
    pub hidden: bool,
    /// Date de création (TAGM-12), en ms depuis 1970.
    pub created_at: i64,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagManagerData {
    pub tags: Vec<ManagedTag>,
    /// Médias qui portent au moins un tag (en-tête du gestionnaire).
    pub tagged_media: i64,
    /// Groupes de tags proches ignorés (TAGM-13) : identifiants triés, « 12,40,77 ».
    pub ignored: Vec<String>,
}

/// Résultat d'un renommage : fait, ou nom déjà porté par un autre tag (fusion proposée, CTX-04).
#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Renamed {
    Done,
    Empty,
    #[serde(rename_all = "camelCase")]
    Exists { id: i64, name: String, media_count: i64 },
}

/// Tag d'une liste importée (TAGM-10) : catégorie par sa clé (« general »…), les identifiants
/// changeant d'une bibliothèque à l'autre.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedTag {
    pub name: String,
    pub category: String,
    #[serde(default)]
    pub hidden: bool,
}

fn marks(n: usize) -> String {
    vec!["?"; n].join(",")
}

fn list(db: &Connection) -> rusqlite::Result<TagManagerData> {
    let mut stmt = db.prepare("SELECT id, name, category_id, media_count, hidden, created_at, description FROM tags")?;
    let tags = stmt
        .query_map([], |r| {
            Ok(ManagedTag {
                id: r.get(0)?,
                name: r.get(1)?,
                category_id: r.get(2)?,
                media_count: r.get(3)?,
                hidden: r.get(4)?,
                created_at: r.get(5)?,
                description: r.get(6)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    let tagged_media = db.query_row("SELECT COUNT(*) FROM media WHERE tag_count > 0 AND pending_delete = 0", [], |r| r.get(0))?;
    let mut stmt = db.prepare("SELECT tag_ids FROM tag_similar_ignored")?;
    let ignored = stmt.query_map([], |r| r.get(0))?.collect::<rusqlite::Result<_>>()?;
    Ok(TagManagerData { tags, tagged_media, ignored })
}

fn rename(db: &Connection, id: i64, raw: &str) -> rusqlite::Result<Renamed> {
    let Some(name) = normalize(raw) else { return Ok(Renamed::Empty) };
    let other: Option<(i64, String, i64)> = db
        .query_row("SELECT id, name, media_count FROM tags WHERE name = ?1 AND id != ?2", params![name, id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
        .optional()?;
    if let Some((id, name, media_count)) = other {
        return Ok(Renamed::Exists { id, name, media_count });
    }
    db.execute("UPDATE tags SET name = ?1 WHERE id = ?2", params![name, id])?;
    Ok(Renamed::Done)
}

/// Fusionne `sources` dans `target` : leurs médias passent au tag gardé, puis elles sont supprimées.
/// Le tag gardé conserve sa catégorie et son état ; sans description, il prend celle d'une source.
fn merge(conn: &mut Connection, sources: &[i64], target: i64) -> rusqlite::Result<()> {
    let sources: Vec<i64> = sources.iter().copied().filter(|&id| id != target).collect();
    if sources.is_empty() {
        return Ok(());
    }
    let tx = conn.transaction()?;
    let m = marks(sources.len());
    let mut params: Vec<i64> = vec![target];
    params.extend(&sources);
    tx.execute(&format!("INSERT OR IGNORE INTO media_tags (media_id, tag_id) SELECT media_id, ?1 FROM media_tags WHERE tag_id IN ({m})"), params_from_iter(&params))?;
    tx.execute(
        &format!("UPDATE tags SET description = (SELECT description FROM tags WHERE id IN ({m}) AND description IS NOT NULL LIMIT 1) WHERE id = ? AND description IS NULL"),
        params_from_iter(sources.iter().chain([&target])),
    )?;
    tx.execute(&format!("DELETE FROM tags WHERE id IN ({m})"), params_from_iter(&sources))?;
    tx.commit()
}

/// Crée les tags importés qui n'existent pas encore (sans média) ; renvoie leurs identifiants, pour
/// pouvoir annuler l'import (TAGM-10).
fn import(conn: &mut Connection, list: &[ImportedTag]) -> rusqlite::Result<Vec<i64>> {
    let tx = conn.transaction()?;
    let default: i64 = tx.query_row("SELECT id FROM tag_categories WHERE key = ?1", [DEFAULT_CATEGORY], |r| r.get(0))?;
    let now = db::now_ms();
    let mut created = Vec::new();
    for tag in list {
        let Some(name) = normalize(&tag.name) else { continue };
        let category: i64 = tx
            .query_row("SELECT id FROM tag_categories WHERE key = ?1", [&tag.category], |r| r.get(0))
            .optional()?
            .unwrap_or(default);
        let inserted = tx.execute(
            "INSERT OR IGNORE INTO tags (name, category_id, hidden, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![name, category, tag.hidden, now],
        )?;
        if inserted > 0 {
            created.push(tx.last_insert_rowid());
        }
    }
    tx.commit()?;
    Ok(created)
}

/// Même mise à jour pour plusieurs tags, en une transaction.
fn update_many(conn: &mut Connection, sql: &str, value: &dyn rusqlite::ToSql, ids: &[i64]) -> rusqlite::Result<usize> {
    let tx = conn.transaction()?;
    let mut changed = 0;
    {
        let mut stmt = tx.prepare(sql)?;
        for id in ids {
            changed += stmt.execute(params![value, id])?;
        }
    }
    tx.commit()?;
    Ok(changed)
}

// --- Commandes appelées par l'interface ---

fn err(e: rusqlite::Error) -> String {
    e.to_string()
}

#[tauri::command]
pub async fn list_managed_tags(state: State<'_, AppState>) -> Result<TagManagerData, String> {
    list(&state.db.lock().unwrap()).map_err(err)
}

#[tauri::command]
pub async fn rename_tag(state: State<'_, AppState>, id: i64, name: String) -> Result<Renamed, String> {
    rename(&state.db.lock().unwrap(), id, &name).map_err(err)
}

#[tauri::command]
pub async fn merge_tags(state: State<'_, AppState>, sources: Vec<i64>, target: i64) -> Result<(), String> {
    merge(&mut state.db.lock().unwrap(), &sources, target).map_err(err)
}

#[tauri::command]
pub async fn set_tags_category(state: State<'_, AppState>, ids: Vec<i64>, category_id: i64) -> Result<usize, String> {
    update_many(&mut state.db.lock().unwrap(), "UPDATE tags SET category_id = ?1 WHERE id = ?2", &category_id, &ids).map_err(err)
}

#[tauri::command]
pub async fn set_tags_hidden(state: State<'_, AppState>, ids: Vec<i64>, hidden: bool) -> Result<usize, String> {
    update_many(&mut state.db.lock().unwrap(), "UPDATE tags SET hidden = ?1 WHERE id = ?2", &hidden, &ids).map_err(err)
}

/// Supprime des tags (retirés de leurs médias) ; renvoie le nombre supprimé.
#[tauri::command]
pub async fn delete_tags(state: State<'_, AppState>, ids: Vec<i64>) -> Result<usize, String> {
    if ids.is_empty() {
        return Ok(0);
    }
    let mut conn = state.db.lock().unwrap();
    (|| -> rusqlite::Result<usize> {
        let tx = conn.transaction()?;
        let deleted = tx.execute(&format!("DELETE FROM tags WHERE id IN ({})", marks(ids.len())), params_from_iter(&ids))?;
        tx.commit()?;
        Ok(deleted)
    })()
    .map_err(err)
}

/// Description d'un tag (TAGM-14) ; texte vide = aucune.
#[tauri::command]
pub async fn set_tag_description(state: State<'_, AppState>, id: i64, text: String) -> Result<(), String> {
    let text = text.trim();
    let value = (!text.is_empty()).then_some(text);
    state.db.lock().unwrap().execute("UPDATE tags SET description = ?1 WHERE id = ?2", params![value, id]).map(|_| ()).map_err(err)
}

#[tauri::command]
pub async fn import_tags(state: State<'_, AppState>, tags: Vec<ImportedTag>) -> Result<Vec<i64>, String> {
    import(&mut state.db.lock().unwrap(), &tags).map_err(err)
}

/// « Ignorer » un groupe de tags proches (TAGM-13) : il n'est plus proposé.
#[tauri::command]
pub async fn ignore_similar(state: State<'_, AppState>, ids: Vec<i64>) -> Result<(), String> {
    let mut ids = ids;
    ids.sort_unstable();
    let key = ids.iter().map(i64::to_string).collect::<Vec<_>>().join(",");
    state.db.lock().unwrap().execute("INSERT OR IGNORE INTO tag_similar_ignored (tag_ids) VALUES (?1)", [key]).map(|_| ()).map_err(err)
}
