//! Commandes de la page « Synonymes et parents » et des colonnes du tableau du gestionnaire de tags
//! (TAGM-15, TAGM-16). Chaque commande est une transaction (D-005).

use rusqlite::{Connection, TransactionBehavior, params};
use serde::Serialize;
use tauri::State;

use crate::aliases::{self, AliasCheck};
use crate::parents::{self, DeleteCheck, RuleCheck};
use crate::tagging::resolve_or_create;
use crate::tags::NewTag;
use crate::{AppState, db};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AliasRow {
    pub id: i64,
    pub alias: String,
    pub tag_id: i64,
    pub enabled: bool,
    /// Médias notés (fusionnés, ou tagués en tapant le synonyme).
    pub media: i64,
    pub created_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParentRow {
    pub id: i64,
    pub child_id: i64,
    pub parent_id: i64,
    /// Interrupteur de la règle (D-047).
    pub enabled: bool,
    /// Médias qui ont reçu le parent par cette règle.
    pub media: i64,
    pub created_at: i64,
}

#[derive(Debug, Serialize)]
pub struct TagRules {
    pub aliases: Vec<AliasRow>,
    pub parents: Vec<ParentRow>,
}

fn list(db: &Connection) -> rusqlite::Result<TagRules> {
    let mut stmt = db.prepare(
        "SELECT a.id, a.alias, a.tag_id, a.enabled, (SELECT COUNT(*) FROM tag_alias_media m WHERE m.alias_id = a.id), a.created_at
         FROM tag_aliases a",
    )?;
    let aliases = stmt
        .query_map([], |r| Ok(AliasRow { id: r.get(0)?, alias: r.get(1)?, tag_id: r.get(2)?, enabled: r.get(3)?, media: r.get(4)?, created_at: r.get(5)? }))?
        .collect::<rusqlite::Result<_>>()?;
    let mut stmt = db.prepare(
        "SELECT p.id, p.child_id, p.parent_id, p.enabled,
                (SELECT COUNT(*) FROM tag_parent_media m WHERE m.rule_id = p.id AND m.tag_id = p.parent_id), p.created_at
         FROM tag_parents p",
    )?;
    let parents = stmt
        .query_map([], |r| {
            Ok(ParentRow { id: r.get(0)?, child_id: r.get(1)?, parent_id: r.get(2)?, enabled: r.get(3)?, media: r.get(4)?, created_at: r.get(5)? })
        })?
        .collect::<rusqlite::Result<_>>()?;
    Ok(TagRules { aliases, parents })
}

/// Lecture seule sur la connexion de l'interface.
fn read<T>(state: &State<'_, AppState>, f: impl FnOnce(&Connection) -> rusqlite::Result<T>) -> Result<T, String> {
    f(&state.db.lock().unwrap()).map_err(|e| e.to_string())
}

/// Modification en une transaction.
fn write<T>(state: &State<'_, AppState>, f: impl FnOnce(&Connection, i64) -> anyhow::Result<T>) -> Result<T, String> {
    let mut conn = state.db.lock().unwrap();
    (|| -> anyhow::Result<T> {
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let out = f(&tx, db::now_ms())?;
        tx.commit()?;
        Ok(out)
    })()
    .map_err(|e| format!("{e:#}"))
}

#[tauri::command]
pub async fn list_tag_rules(state: State<'_, AppState>) -> Result<TagRules, String> {
    read(&state, list)
}

#[tauri::command]
pub async fn alias_check(state: State<'_, AppState>, alias: String, target: i64) -> Result<AliasCheck, String> {
    read(&state, |db| aliases::check(db, &alias, target))
}

#[tauri::command]
pub async fn create_alias(state: State<'_, AppState>, alias: String, target: i64) -> Result<(), String> {
    write(&state, |db, now| aliases::create(db, &alias, target, now))
}

/// Recocher un synonyme : nombre de médias du tag du même nom, qui sera fusionné à nouveau.
#[tauri::command]
pub async fn alias_enable_check(state: State<'_, AppState>, id: i64) -> Result<Option<i64>, String> {
    read(&state, |db| aliases::enable_check(db, id))
}

#[tauri::command]
pub async fn set_alias_enabled(state: State<'_, AppState>, id: i64, enabled: bool) -> Result<(), String> {
    write(&state, |db, now| aliases::set_enabled(db, id, enabled, now))
}

#[tauri::command]
pub async fn delete_alias(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    write(&state, |db, _| aliases::delete(db, id))
}

#[tauri::command]
pub async fn parent_check(state: State<'_, AppState>, child: i64, parent: i64) -> Result<RuleCheck, String> {
    read(&state, |db| parents::check(db, child, parent))
}

/// `apply` : la case « Ajouter aussi aux médias qui ont déjà l'enfant ». Renvoie le nombre de médias qui ont
/// reçu le parent.
#[tauri::command]
pub async fn create_parent(state: State<'_, AppState>, child: i64, parent: i64, apply: bool) -> Result<usize, String> {
    write(&state, |db, now| parents::create(db, child, parent, apply, now))
}

#[tauri::command]
pub async fn set_parent_enabled(state: State<'_, AppState>, id: i64, enabled: bool) -> Result<(), String> {
    write(&state, |db, _| Ok(parents::set_enabled(db, id, enabled)?))
}

/// Confirmation de suppression : médias où le parent a été posé, tags venus en chaîne, chaînes.
#[tauri::command]
pub async fn parent_delete_check(state: State<'_, AppState>, id: i64) -> Result<DeleteCheck, String> {
    read(&state, |db| parents::delete_check(db, id))
}

/// `remove` : la case « Retirer le parent aux médias portant l'enfant ».
#[tauri::command]
pub async fn delete_parent(state: State<'_, AppState>, id: i64, remove: bool) -> Result<(), String> {
    write(&state, |db, _| parents::delete(db, id, remove))
}

/// Tag tapé dans le champ d'une règle qui n'existe pas encore : créé (sans média) avec la catégorie
/// choisie dans la pop-in « Créer un nouveau tag ». Un synonyme donne son tag principal.
#[tauri::command]
pub async fn create_tag(state: State<'_, AppState>, name: String, category_id: i64) -> Result<i64, String> {
    write(&state, |db, now| {
        let target = resolve_or_create(db, &NewTag { name, category_id: Some(category_id) }, now)?;
        target.map(|t| t.tag_id).ok_or_else(|| anyhow::anyhow!("nom de tag vide"))
    })
}

/// Synonymes et règles qui disparaîtront avec ce tag (pop-in « Supprimer le tag… »).
#[derive(Debug, Serialize)]
pub struct TagLinks {
    pub aliases: i64,
    pub parents: i64,
}

#[tauri::command]
pub async fn tag_links(state: State<'_, AppState>, id: i64) -> Result<TagLinks, String> {
    read(&state, |db| {
        Ok(TagLinks {
            aliases: db.query_row("SELECT COUNT(*) FROM tag_aliases WHERE tag_id = ?1", [id], |r| r.get(0))?,
            parents: db.query_row("SELECT COUNT(*) FROM tag_parents WHERE child_id = ?1 OR parent_id = ?1", params![id], |r| r.get(0))?,
        })
    })
}
