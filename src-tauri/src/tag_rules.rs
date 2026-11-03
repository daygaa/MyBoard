//! Commandes de la page « Synonymes et parents » et des colonnes du tableau du gestionnaire de tags
//! (TAGM-15, TAGM-16, refonte TAGM-20) : groupes de synonymes et règles de parents. Chaque commande est une
//! transaction (D-005).

use rusqlite::{Connection, TransactionBehavior};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::group_list::{self, GroupRow, Preview};
use crate::{group_create, groups};
use crate::parents::{self, DeleteCheck, RuleCheck};
use crate::rule_preview::{self, RuleChange};
use crate::tag_delete::RuleName;
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
    /// Noms de l'enfant et du parent, lus avec la règle : la ligne n'attend pas la relecture de la liste des tags (un
    /// parent tout juste créé s'affichait « ? » un instant, retour T3, point TAGM-16.7).
    pub child_name: String,
    pub parent_name: String,
    /// Règle déplacée par une fusion (lot R5) : le tag d'origine de l'enfant ou du parent (repère « = »).
    pub child_from: Option<String>,
    pub parent_from: Option<String>,
    /// Règle mise de côté : le tag fusionné qu'elle cite et son principal.
    pub aside: Option<Aside>,
}

#[derive(Debug, Serialize)]
pub struct Aside {
    pub name: String,
    pub principal: String,
}

#[derive(Debug, Serialize)]
pub struct TagRules {
    pub groups: Vec<GroupRow>,
    pub parents: Vec<ParentRow>,
}

fn list(db: &Connection) -> rusqlite::Result<TagRules> {
    // Une note passée au principal par une fusion compte encore pour la règle (lot R5).
    let mut stmt = db.prepare(
        "SELECT p.id, p.child_id, p.parent_id, p.enabled,
                (SELECT COUNT(*) FROM tag_parent_media m WHERE m.rule_id = p.id AND (m.tag_id = p.parent_id OR m.moved_from = p.parent_id)),
                p.created_at, c.name, t.name, cf.name, pf.name, a.name, ap.name
         FROM tag_parents p JOIN tags c ON c.id = p.child_id JOIN tags t ON t.id = p.parent_id
         LEFT JOIN tags cf ON cf.id = p.child_from LEFT JOIN tags pf ON pf.id = p.parent_from
         LEFT JOIN tag_group_names n ON n.merged = 1 AND n.id = (SELECT id FROM tag_group_names WHERE merged = 1 AND tag_id IN (p.child_id, p.parent_id) LIMIT 1)
         LEFT JOIN tags a ON a.id = n.tag_id LEFT JOIN tag_groups g ON g.id = n.group_id LEFT JOIN tags ap ON ap.id = g.principal_id",
    )?;
    let parents = stmt
        .query_map([], |r| {
            let aside = match (r.get::<_, Option<String>>(10)?, r.get::<_, Option<String>>(11)?) {
                (Some(name), Some(principal)) => Some(Aside { name, principal }),
                _ => None,
            };
            Ok(ParentRow {
                id: r.get(0)?,
                child_id: r.get(1)?,
                parent_id: r.get(2)?,
                enabled: r.get(3)?,
                media: r.get(4)?,
                created_at: r.get(5)?,
                child_name: r.get(6)?,
                parent_name: r.get(7)?,
                child_from: r.get(8)?,
                parent_from: r.get(9)?,
                aside,
            })
        })?
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

/// Noms des règles restées sur le principal à une défusion (elles feraient une boucle) : badge (réponse 5d du lot R5).
fn names(db: &Connection, rules: Vec<i64>) -> anyhow::Result<Vec<RuleName>> {
    let mut stmt = db.prepare("SELECT c.name, t.name FROM tag_parents p JOIN tags c ON c.id = p.child_id JOIN tags t ON t.id = p.parent_id WHERE p.id = ?1")?;
    Ok(rules.into_iter().map(|id| stmt.query_row([id], |r| Ok(RuleName { child: r.get(0)?, parent: r.get(1)? }))).collect::<rusqlite::Result<_>>()?)
}

// --- Groupes de synonymes

/// Aperçu du formulaire de création : groupe obtenu, groupes réunis, état d'office de l'interrupteur ; `promote` : le
/// tag choisi devient le principal de son groupe (tags cochés, point TAGM-11.4).
#[tauri::command]
pub async fn group_preview(state: State<'_, AppState>, principal: String, names: Vec<String>, promote: bool) -> Result<Preview, String> {
    read(&state, |db| group_list::preview(db, &principal, &names, promote))
}

/// Crée ou complète le groupe de `principal` ; `merge` : l'interrupteur « Fusionner » du formulaire ; `extend` : les
/// règles cochées « Étendre » dans la pop-in (D11.3) ; `promote` : `principal` devient d'abord le principal de son
/// groupe.
#[tauri::command]
pub async fn create_group(state: State<'_, AppState>, principal: i64, names: Vec<String>, merge: bool, new_tags: Vec<NewTag>, extend: Vec<i64>, promote: bool) -> Result<i64, String> {
    write(&state, |db, now| {
        if promote {
            group_create::promote(db, principal)?;
        }
        group_create::create(db, principal, &names, merge, &new_tags, &extend, now)
    })
}

/// Les quatre commandes suivantes renvoient les règles restées sur le principal (défusion).
#[tauri::command]
pub async fn set_name_merged(state: State<'_, AppState>, id: i64, merged: bool, extend: Vec<i64>) -> Result<Vec<RuleName>, String> {
    write(&state, |db, _| names(db, groups::set_merged(db, id, merged, &extend)?))
}

#[tauri::command]
pub async fn set_group_merged(state: State<'_, AppState>, id: i64, merged: bool, extend: Vec<i64>) -> Result<Vec<RuleName>, String> {
    write(&state, |db, _| names(db, groups::set_group_merged(db, id, merged, &extend)?))
}

#[tauri::command]
pub async fn remove_group_name(state: State<'_, AppState>, id: i64) -> Result<Vec<RuleName>, String> {
    write(&state, |db, _| names(db, groups::remove_name(db, id)?))
}

#[tauri::command]
pub async fn delete_group(state: State<'_, AppState>, id: i64) -> Result<Vec<RuleName>, String> {
    write(&state, |db, _| names(db, groups::delete_group(db, id)?))
}

/// Action dont la pop-in montre ce qu'elle change aux règles de parents (réponses 3 et 5b du lot R5).
#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Planned {
    /// Interrupteur de fusion d'un nom.
    Name { id: i64 },
    /// Interrupteur du groupe (tout fusionner).
    Group { id: i64 },
    /// Création : `merge`, l'interrupteur « Fusionner » ; `promote`, changement de principal d'abord (tags cochés).
    Create {
        principal: i64,
        names: Vec<String>,
        #[serde(rename = "newTags")]
        new_tags: Vec<NewTag>,
        merge: bool,
        promote: bool,
    },
    /// Changement de principal (étoile).
    Principal { group: i64, name: i64 },
    /// « Créer des synonymes pour tous » des tags proches (lot R6-2).
    Batch { items: Vec<BatchItem> },
}

#[derive(Debug, Deserialize)]
pub struct BatchItem {
    principal: i64,
    names: Vec<String>,
    merge: bool,
}

/// Joue l'action sans rien garder (transaction annulée) et renvoie ce qu'elle change aux règles.
#[tauri::command]
pub async fn rules_preview(state: State<'_, AppState>, planned: Planned) -> Result<Vec<RuleChange>, String> {
    let mut conn = state.db.lock().unwrap();
    let now = db::now_ms();
    // Une fusion est jouée sans rien étendre : les cases « Étendre » disent ce qu'elles ajouteraient.
    let extendable = !matches!(planned, Planned::Principal { .. });
    // Changement de principal préalable : ses règles sont listées, mais seules les fusions de la création ont des cases.
    let setup = |db: &Connection| match &planned {
        Planned::Create { principal, promote: true, .. } => group_create::promote(db, *principal),
        _ => Ok(()),
    };
    rule_preview::preview(&mut conn, extendable, setup, |db| match &planned {
        Planned::Name { id } => groups::merge(db, *id, &[]),
        Planned::Group { id } => groups::set_group_merged(db, *id, true, &[]).map(|_| ()),
        Planned::Create { principal, names, new_tags, merge, .. } => group_create::create(db, *principal, names, *merge, new_tags, &[], now).map(|_| ()),
        Planned::Principal { group, name } => groups::set_principal(db, *group, *name),
        Planned::Batch { items } => items.iter().try_for_each(|i| group_create::create(db, i.principal, &i.names, i.merge, &[], &[], now).map(|_| ())),
    })
    .map_err(|e| format!("{e:#}"))
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
pub async fn parent_check(state: State<'_, AppState>, child: i64, parent: Option<i64>) -> Result<RuleCheck, String> {
    read(&state, |db| match parent {
        Some(parent) => parents::check(db, child, parent),
        // Parent pas encore créé (il le sera avec la règle) : aucune boucle possible, tous les médias de l'enfant.
        None => Ok(RuleCheck { error: None, media: db.query_row("SELECT COUNT(*) FROM media_tags WHERE tag_id = ?1", [child], |r| r.get(0))? }),
    })
}

/// `apply` : la case « Ajouter aux médias qui ont déjà l'enfant ». Renvoie le nombre de médias qui ont reçu
/// le parent. `new_parent` : parent tapé qui n'est pas encore un tag, créé ici avec la règle (retour T3, point
/// TAGM-15.24 : rien n'est créé si la règle ne l'est pas).
#[tauri::command]
pub async fn create_parent(state: State<'_, AppState>, child: i64, parent: Option<i64>, new_parent: Option<NewTag>, apply: bool) -> Result<usize, String> {
    write(&state, |db, now| {
        let parent = match (parent, new_parent) {
            (Some(parent), _) => parent,
            (None, Some(tag)) => resolve_or_create(db, &tag, now)?.ok_or_else(|| anyhow::anyhow!("nom de tag vide"))?.tag_id,
            (None, None) => anyhow::bail!("parent manquant"),
        };
        parents::create(db, child, parent, apply, now)
    })
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
