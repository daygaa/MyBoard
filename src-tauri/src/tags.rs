//! Tags et catégories : autocomplétion, tags d'une page, ajout / retrait sur un média. Gestionnaire de
//! tags (renommer, fusionner, masquer…) : `tag_manager.rs` ; synonymes et parents : `tagging.rs`,
//! `groups.rs`, `parents.rs`.
//!
//! Les compteurs (`tags.media_count`, `media.tag_count`) sont tenus par les déclencheurs SQL
//! (D-005) : ce module n'y touche jamais. Un tag est lié à l'identifiant du média, jamais à
//! son nom de fichier (LIB-04).

use std::collections::HashSet;

use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params, params_from_iter};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::tagging::{Tagger, resolve_or_create};
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
    /// Masqué de la recherche (TAGM-05) : gris clair et en dernier dans la visionneuse (CTX-04).
    pub hidden: bool,
    /// Bulle d'aide au survol du tag (TAGM-14).
    pub description: Option<String>,
    /// Suggestion venue d'un nom fusionné (TAGM-15, D-047) : le nom tapé, affiché « nom → principal ».
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alias: Option<String>,
    /// Autres noms reliés de son groupe (suggestions et `find` seulement, `synonyms_of`).
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub synonyms: Vec<Synonym>,
}

/// Autre nom relié du groupe d'un tag (retour T3, points TAGM-15.26 et TAGM-15.27) : zone de l'icône « = » des
/// suggestions, bulle des pastilles de la recherche. Les tags fusionnés n'y sont pas : ils n'ont aucun média.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Synonym {
    pub name: String,
    pub category_id: i64,
    pub media_count: i64,
    pub principal: bool,
}

/// Colonnes d'un tag, dans l'ordre lu par `tag_from_row`.
pub const TAG_COLUMNS: &str = "id, name, category_id, media_count, hidden, description";
/// Les mêmes, préfixées (requêtes avec jointure).
const T_COLUMNS: &str = "t.id, t.name, t.category_id, t.media_count, t.hidden, t.description";
/// Tags fusionnés (`m`) avec le principal de leur groupe (`t`).
const MERGED_JOIN: &str = "tag_group_names n JOIN tags m ON m.id = n.tag_id JOIN tag_groups g ON g.id = n.group_id JOIN tags t ON t.id = g.principal_id AND n.merged = 1";
/// Un tag fusionné n'est pas proposé sous son nom, mais « nom → principal ».
const NOT_MERGED: &str = "id NOT IN (SELECT tag_id FROM tag_group_names WHERE merged = 1)";

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

pub(crate) fn tag_from_row(r: &rusqlite::Row) -> rusqlite::Result<TagInfo> {
    Ok(TagInfo { id: r.get(0)?, name: r.get(1)?, category_id: r.get(2)?, media_count: r.get(3)?, hidden: r.get(4)?, description: r.get(5)?, alias: None, synonyms: Vec::new() })
}

/// Principal d'un nom fusionné, avec ce nom (colonne 6).
fn alias_from_row(r: &rusqlite::Row) -> rusqlite::Result<TagInfo> {
    Ok(TagInfo { alias: Some(r.get(6)?), ..tag_from_row(r)? })
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
/// Les tags fusionnés (TAGM-15, D-047) sont proposés « nom → principal » (le choisir donne le principal), sauf si
/// le principal l'est déjà ; un nom relié est un tag comme un autre, proposé comme tel.
pub fn autocomplete(db: &Connection, text: &str) -> rusqlite::Result<Vec<TagInfo>> {
    let Some(prefix) = normalize(text) else { return Ok(Vec::new()) };
    // Bornes [prefix, prefix + U+10FFFF) : la recherche utilise l'index unique sur `name`.
    let upper = format!("{prefix}\u{10FFFF}");
    let limit = SUGGESTIONS as i64;
    let tags = db
        .prepare_cached(&format!("SELECT {TAG_COLUMNS} FROM tags WHERE name >= ?1 AND name < ?2 AND hidden = 0 AND {NOT_MERGED} ORDER BY media_count DESC, name LIMIT ?3"))?
        .query_map(params![prefix, upper, limit], tag_from_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let aliases = db
        .prepare_cached(&format!(
            "SELECT {T_COLUMNS}, m.name FROM {MERGED_JOIN}
             WHERE m.name >= ?1 AND m.name < ?2 AND t.hidden = 0 ORDER BY t.media_count DESC, m.name LIMIT ?3"
        ))?
        .query_map(params![prefix, upper, limit], alias_from_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let mut found = merged(tags, aliases);
    if found.len() < SUGGESTIONS as usize {
        let tags = db
            .prepare_cached(&format!("SELECT {TAG_COLUMNS} FROM tags WHERE instr(name, ?1) > 1 AND hidden = 0 AND {NOT_MERGED} ORDER BY media_count DESC, name LIMIT ?2"))?
            .query_map(params![prefix, limit], tag_from_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let aliases = db
            .prepare_cached(&format!(
                "SELECT {T_COLUMNS}, m.name FROM {MERGED_JOIN}
                 WHERE instr(m.name, ?1) > 1 AND t.hidden = 0 ORDER BY t.media_count DESC, m.name LIMIT ?2"
            ))?
            .query_map(params![prefix, limit], alias_from_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        found.extend(merged(tags, aliases));
    }
    // Un tag proposé par son nom ne l'est pas aussi par un nom fusionné ; un seul nom fusionné par tag.
    let named: HashSet<i64> = found.iter().filter(|t| t.alias.is_none()).map(|t| t.id).collect();
    let mut aliased = HashSet::new();
    found.retain(|t| t.alias.is_none() || (!named.contains(&t.id) && aliased.insert(t.id)));
    found.truncate(SUGGESTIONS as usize);
    for tag in found.iter_mut().filter(|t| t.alias.is_none()) {
        tag.synonyms = synonyms_of(db, tag.id)?;
    }
    Ok(found)
}

/// Les autres noms reliés du groupe de ce tag, le principal d'abord puis par nom ; vide hors d'un groupe ou pour un
/// tag fusionné.
fn synonyms_of(db: &Connection, id: i64) -> rusqlite::Result<Vec<Synonym>> {
    db.prepare_cached(
        "SELECT t.name, t.category_id, t.media_count, t.id = g.principal_id FROM tag_groups g JOIN tags t
            ON t.id = g.principal_id OR t.id IN (SELECT tag_id FROM tag_group_names WHERE group_id = g.id AND merged = 0)
         WHERE (g.principal_id = ?1 OR g.id = (SELECT group_id FROM tag_group_names WHERE tag_id = ?1 AND merged = 0)) AND t.id != ?1
         ORDER BY t.id = g.principal_id DESC, t.name",
    )?
    .query_map([id], |r| Ok(Synonym { name: r.get(0)?, category_id: r.get(1)?, media_count: r.get(2)?, principal: r.get(3)? }))?
    .collect()
}

/// Tags et noms fusionnés trouvés, les plus utilisés en premier (à égalité, le tag avant le nom fusionné).
fn merged(tags: Vec<TagInfo>, aliases: Vec<TagInfo>) -> Vec<TagInfo> {
    let mut all = tags;
    all.extend(aliases);
    all.sort_by(|a, b| b.media_count.cmp(&a.media_count).then_with(|| a.alias.is_some().cmp(&b.alias.is_some())));
    all
}

/// Tag portant exactement ce nom (après normalisation) ; un tag fusionné donne le principal de son groupe
/// (TAGM-15, D-047 : taper le nom donne le principal, sans pop-in de création), avec ce nom en `alias`. Avec les
/// autres noms reliés du groupe du tag trouvé (bulle des pastilles de la recherche, retour T3, point TAGM-15.27).
pub fn find(db: &Connection, name: &str) -> rusqlite::Result<Option<TagInfo>> {
    let Some(name) = normalize(name) else { return Ok(None) };
    let merged = db.prepare_cached(&format!("SELECT {T_COLUMNS}, m.name FROM {MERGED_JOIN} WHERE m.name = ?1"))?.query_row([&name], alias_from_row).optional()?;
    let found = match merged {
        Some(tag) => Some(tag),
        None => db.prepare_cached(&format!("SELECT {TAG_COLUMNS} FROM tags WHERE name = ?1"))?.query_row([&name], tag_from_row).optional()?,
    };
    let Some(mut tag) = found else { return Ok(None) };
    tag.synonyms = synonyms_of(db, tag.id)?;
    Ok(Some(tag))
}

/// Tags présents sur ces médias, chacun avec son nombre TOTAL de médias (SRCH-10). Les tags masqués
/// (TAGM-05) ne sont pas dans la barre latérale (`with_hidden` faux) mais restent sur les médias.
pub fn tags_of_media(db: &Connection, ids: &[i64], with_hidden: bool) -> rusqlite::Result<Vec<TagInfo>> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let sql = format!(
        "SELECT {TAG_COLUMNS} FROM tags
         WHERE id IN (SELECT DISTINCT tag_id FROM media_tags WHERE media_id IN ({})){}
         ORDER BY media_count DESC, name",
        vec!["?"; ids.len()].join(","),
        if with_hidden { "" } else { " AND hidden = 0" }
    );
    let mut stmt = db.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(ids), tag_from_row)?;
    rows.collect()
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

/// Barre latérale : tags des médias de la page affichée (SRCH-10), sans les tags masqués (TAGM-05).
#[tauri::command]
pub async fn page_tags(state: State<'_, AppState>, ids: Vec<i64>) -> Result<Vec<TagInfo>, String> {
    tags_of_media(&state.db.lock().unwrap(), &ids, false).map_err(|e| e.to_string())
}

/// Ajoute un tag à un média (VIEW-22) ; le crée s'il n'existe pas (TAGM-07). Un nom fusionné donne son
/// principal (TAGM-15) ; les parents suivent (TAGM-16).
#[tauri::command]
pub async fn add_media_tag(state: State<'_, AppState>, media_id: i64, tag: NewTag) -> Result<(), String> {
    let mut conn = state.db.lock().unwrap();
    (|| -> anyhow::Result<()> {
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let target = resolve_or_create(&tx, &tag, db::now_ms())?.ok_or_else(|| anyhow::anyhow!("nom de tag vide"))?;
        Tagger::load(&tx)?.attach(&tx, media_id, target)?;
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
