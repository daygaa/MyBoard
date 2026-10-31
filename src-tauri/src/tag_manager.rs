//! Gestionnaire de tags (TAGM-04, TAGM-05, TAGM-08, TAGM-10 à TAGM-14) et menus des tags (CTX-04,
//! CTX-12) : liste de tous les tags, renommer (fusion si le nom existe), fusionner, changer de
//! catégorie, masquer, supprimer, description, groupes de tags proches ignorés. Import d'une liste :
//! `tag_import.rs`.
//!
//! Chaque opération multiple est une transaction ; les compteurs (`tags.media_count`,
//! `media.tag_count`) et l'index de recherche suivent par les déclencheurs de la base (D-005, D-027).
//! Fusion : `group_create::merge_tag` (groupes de synonymes, règles de parents, TAGM-15 à TAGM-17, D-047).

use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::group_create::merge_tag;
use crate::tag_delete::{self, DeletePreview};
use crate::tags::normalize;
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

/// Résultat d'un renommage : fait, ou nom déjà porté par un autre tag (fusion proposée, CTX-04) ou
/// par un nom fusionné d'un groupe (`alias` : fusion proposée avec son principal, TAGM-15) ; `OwnAlias` :
/// le nom est fusionné dans ce tag lui-même.
#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Renamed {
    Done,
    Empty,
    #[serde(rename_all = "camelCase")]
    Exists { id: i64, name: String, media_count: i64, alias: Option<String> },
    OwnAlias,
}

pub(crate) fn marks(n: usize) -> String {
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
    // Nom d'un tag fusionné : c'est son principal qui compte (le renommage propose de rejoindre son groupe).
    let aliased: Option<(i64, String, i64)> = db
        .query_row(
            "SELECT t.id, t.name, t.media_count FROM tag_group_names n JOIN tags m ON m.id = n.tag_id JOIN tag_groups g ON g.id = n.group_id
               JOIN tags t ON t.id = g.principal_id
              WHERE m.name = ?1 AND n.merged = 1 AND m.id != ?2",
            params![name, id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()?;
    match aliased {
        Some((target, _, _)) if target == id => return Ok(Renamed::OwnAlias),
        Some((target, target_name, media_count)) => return Ok(Renamed::Exists { id: target, name: target_name, media_count, alias: Some(name) }),
        None => {}
    }
    let other: Option<(i64, String, i64)> = db
        .query_row("SELECT id, name, media_count FROM tags WHERE name = ?1 AND id != ?2", params![name, id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
        .optional()?;
    if let Some((id, name, media_count)) = other {
        return Ok(Renamed::Exists { id, name, media_count, alias: None });
    }
    db.execute("UPDATE tags SET name = ?1 WHERE id = ?2", params![name, id])?;
    Ok(Renamed::Done)
}

/// Un groupe à fusionner : ses tags, et celui qui est gardé.
#[derive(Debug, Deserialize)]
pub struct MergeGroup {
    pub sources: Vec<i64>,
    pub target: i64,
}

/// Fusionne chaque groupe dans son tag gardé, tous en une transaction : chaque tag rejoint le groupe de
/// synonymes du tag gardé, fusionné (ses médias passent au tag gardé, avec ses parents) ; sans `keep`, son nom
/// est ensuite oublié (TAGM-17, GEN-21 ; ces pop-ins sont revues au lot R6).
fn merge(conn: &mut Connection, groups: &[MergeGroup], keep: bool) -> anyhow::Result<()> {
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let now = db::now_ms();
    for group in groups {
        for &source in &group.sources {
            merge_tag(&tx, source, group.target, keep, now)?;
        }
    }
    tx.commit()?;
    Ok(())
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
pub async fn merge_tags(state: State<'_, AppState>, sources: Vec<i64>, target: i64, keep_aliases: bool) -> Result<(), String> {
    merge(&mut state.db.lock().unwrap(), &[MergeGroup { sources, target }], keep_aliases).map_err(|e| format!("{e:#}"))
}

/// « Tout fusionner » des tags proches (retour T3, point TAGM-13.3) : tous les groupes d'un coup.
#[tauri::command]
pub async fn merge_tag_groups(state: State<'_, AppState>, groups: Vec<MergeGroup>, keep_aliases: bool) -> Result<(), String> {
    merge(&mut state.db.lock().unwrap(), &groups, keep_aliases).map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn set_tags_category(state: State<'_, AppState>, ids: Vec<i64>, category_id: i64) -> Result<usize, String> {
    update_many(&mut state.db.lock().unwrap(), "UPDATE tags SET category_id = ?1 WHERE id = ?2", &category_id, &ids).map_err(err)
}

#[tauri::command]
pub async fn set_tags_hidden(state: State<'_, AppState>, ids: Vec<i64>, hidden: bool) -> Result<usize, String> {
    update_many(&mut state.db.lock().unwrap(), "UPDATE tags SET hidden = ?1 WHERE id = ?2", &hidden, &ids).map_err(err)
}

/// Supprime des tags (retirés de leurs médias) ; renvoie le nombre supprimé. Groupes de synonymes : `tag_delete.rs`
/// (`with_merged` : case « Supprimer aussi » ; `strip` : case « Supprimer « principal » de ces médias »).
#[tauri::command]
pub async fn delete_tags(state: State<'_, AppState>, ids: Vec<i64>, with_merged: bool, strip: bool) -> Result<usize, String> {
    let mut conn = state.db.lock().unwrap();
    (|| -> anyhow::Result<usize> {
        let tx = conn.transaction()?;
        let deleted = tag_delete::delete(&tx, &ids, with_merged, strip)?;
        tx.commit()?;
        Ok(deleted)
    })()
    .map_err(|e| format!("{e:#}"))
}

/// Pop-in « Supprimer… » : ce qui arrivera aux groupes de synonymes des tags.
#[tauri::command]
pub async fn delete_preview(state: State<'_, AppState>, ids: Vec<i64>) -> Result<DeletePreview, String> {
    tag_delete::preview(&state.db.lock().unwrap(), &ids).map_err(err)
}

/// Description d'un tag (TAGM-14) ; texte vide = aucune.
#[tauri::command]
pub async fn set_tag_description(state: State<'_, AppState>, id: i64, text: String) -> Result<(), String> {
    let text = text.trim();
    let value = (!text.is_empty()).then_some(text);
    state.db.lock().unwrap().execute("UPDATE tags SET description = ?1 WHERE id = ?2", params![value, id]).map(|_| ()).map_err(err)
}

/// « Ignorer » un groupe de tags proches (TAGM-13) : il n'est plus proposé.
#[tauri::command]
pub async fn ignore_similar(state: State<'_, AppState>, ids: Vec<i64>) -> Result<(), String> {
    let mut ids = ids;
    ids.sort_unstable();
    let key = ids.iter().map(i64::to_string).collect::<Vec<_>>().join(",");
    state.db.lock().unwrap().execute("INSERT OR IGNORE INTO tag_similar_ignored (tag_ids) VALUES (?1)", [key]).map(|_| ()).map_err(err)
}
