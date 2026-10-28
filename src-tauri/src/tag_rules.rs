//! Commandes de la page « Synonymes et parents » et des colonnes du tableau du gestionnaire de tags
//! (TAGM-15, TAGM-16, refonte TAGM-20) : groupes de synonymes et règles de parents. Chaque commande est une
//! transaction (D-005).

use rusqlite::{Connection, TransactionBehavior, params};
use serde::Serialize;
use tauri::State;

use crate::group_list::{self, GroupRow, Preview};
use crate::{group_create, groups};
use crate::parents::{self, DeleteCheck, RuleCheck};
use crate::tagging::resolve_or_create;
use crate::tags::NewTag;
use crate::{AppState, db};

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
    pub groups: Vec<GroupRow>,
    pub parents: Vec<ParentRow>,
}

fn list(db: &Connection) -> rusqlite::Result<TagRules> {
    let mut stmt = db.prepare(
        "SELECT p.id, p.child_id, p.parent_id, p.enabled,
                (SELECT COUNT(*) FROM tag_parent_media m WHERE m.rule_id = p.id AND m.tag_id = p.parent_id), p.created_at
         FROM tag_parents p",
    )?;
    let parents = stmt
        .query_map([], |r| Ok(ParentRow { id: r.get(0)?, child_id: r.get(1)?, parent_id: r.get(2)?, enabled: r.get(3)?, media: r.get(4)?, created_at: r.get(5)? }))?
        .collect::<rusqlite::Result<_>>()?;
    Ok(TagRules { groups: group_list::list(db)?, parents })
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

// --- Groupes de synonymes

/// Aperçu du formulaire de création : groupe obtenu, groupes réunis, état d'office de l'interrupteur.
#[tauri::command]
pub async fn group_preview(state: State<'_, AppState>, principal: String, names: Vec<String>) -> Result<Preview, String> {
    read(&state, |db| group_list::preview(db, &principal, &names))
}

/// Crée ou complète le groupe de `principal` ; `merge` : l'interrupteur « Fusionner » du formulaire.
#[tauri::command]
pub async fn create_group(state: State<'_, AppState>, principal: i64, names: Vec<String>, merge: bool) -> Result<i64, String> {
    write(&state, |db, now| group_create::create(db, principal, &names, merge, now))
}

#[tauri::command]
pub async fn set_name_merged(state: State<'_, AppState>, id: i64, merged: bool) -> Result<(), String> {
    write(&state, |db, _| groups::set_merged(db, id, merged))
}

#[tauri::command]
pub async fn set_group_merged(state: State<'_, AppState>, id: i64, merged: bool) -> Result<(), String> {
    write(&state, |db, _| groups::set_group_merged(db, id, merged))
}

#[tauri::command]
pub async fn remove_group_name(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    write(&state, |db, _| groups::remove_name(db, id))
}

#[tauri::command]
pub async fn delete_group(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    write(&state, |db, _| groups::delete_group(db, id))
}

/// Médias qui passeront à `name` s'il devient le principal (confirmation, D3.1).
#[tauri::command]
pub async fn principal_check(state: State<'_, AppState>, group: i64, name: i64) -> Result<i64, String> {
    read(&state, |db| group_list::principal_check(db, group, name))
}

#[tauri::command]
pub async fn set_group_principal(state: State<'_, AppState>, group: i64, name: i64) -> Result<(), String> {
    write(&state, |db, _| groups::set_principal(db, group, name))
}

// --- Règles de parents

#[tauri::command]
pub async fn parent_check(state: State<'_, AppState>, child: i64, parent: i64) -> Result<RuleCheck, String> {
    read(&state, |db| parents::check(db, child, parent))
}

/// `apply` : la case « Ajouter aux médias qui ont déjà l'enfant ». Renvoie le nombre de médias qui ont reçu
/// le parent.
#[tauri::command]
pub async fn create_parent(state: State<'_, AppState>, child: i64, parent: i64, apply: bool) -> Result<usize, String> {
    write(&state, |db, now| parents::create(db, child, parent, apply, now))
}

#[tauri::command]
pub async fn set_parent_enabled(state: State<'_, AppState>, id: i64, enabled: bool) -> Result<(), String> {
    write(&state, |db, _| Ok(parents::set_enabled(db, id, enabled)?))
}

/// Confirmation de suppression : médias où le parent a été posé, chaînes qui passent par la règle.
#[tauri::command]
pub async fn parent_delete_check(state: State<'_, AppState>, id: i64) -> Result<DeleteCheck, String> {
    read(&state, |db| parents::delete_check(db, id))
}

/// `remove` : la case de retrait du parent (et de la suite de la chaîne).
#[tauri::command]
pub async fn delete_parent(state: State<'_, AppState>, id: i64, remove: bool) -> Result<(), String> {
    write(&state, |db, _| parents::delete(db, id, remove))
}

/// Tag tapé dans un champ de l'onglet qui n'existe pas encore : créé (sans média) avec la catégorie choisie
/// dans la pop-in « Créer un nouveau tag ». Un nom fusionné donne son principal.
#[tauri::command]
pub async fn create_tag(state: State<'_, AppState>, name: String, category_id: i64) -> Result<i64, String> {
    write(&state, |db, now| {
        let target = resolve_or_create(db, &NewTag { name, category_id: Some(category_id) }, now)?;
        target.map(|t| t.tag_id).ok_or_else(|| anyhow::anyhow!("nom de tag vide"))
    })
}

/// Ce qui disparaîtra avec ce tag (pop-in « Supprimer le tag… ») : ses noms fusionnés (s'il est le principal
/// d'un groupe) et ses règles de parents.
#[derive(Debug, Serialize)]
pub struct TagLinks {
    pub aliases: i64,
    pub parents: i64,
}

#[tauri::command]
pub async fn tag_links(state: State<'_, AppState>, id: i64) -> Result<TagLinks, String> {
    read(&state, |db| {
        Ok(TagLinks {
            aliases: db.query_row(
                "SELECT COUNT(*) FROM tag_group_names n JOIN tag_groups g ON g.id = n.group_id WHERE g.principal_id = ?1 AND n.tag_id IS NULL",
                [id],
                |r| r.get(0),
            )?,
            parents: db.query_row("SELECT COUNT(*) FROM tag_parents WHERE child_id = ?1 OR parent_id = ?1", params![id], |r| r.get(0))?,
        })
    })
}
