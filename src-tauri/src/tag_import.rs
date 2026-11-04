//! Import d'une liste de tags partagée (TAGM-10, TAGM-18 ; nouveau format, lot R8-1) : tags (catégorie par sa clé,
//! état masqué, description), groupes de synonymes et règles de parents. L'aperçu fait l'import dans une transaction
//! annulée : ses nombres sont exacts. « Annuler » après l'import retire ce qui a été créé (GEN-21).

use std::collections::HashSet;

use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::groups::{self, add_linked, group_of_tag, principal, tag_named};
use crate::tagging::resolve;
use crate::tags::{DEFAULT_CATEGORY, normalize};
use crate::{AppState, db, parents};

/// Tag d'une liste importée : catégorie par sa clé (« general »…), les identifiants changeant d'une
/// bibliothèque à l'autre.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedTag {
    pub name: String,
    pub category: String,
    #[serde(default)]
    pub hidden: bool,
    #[serde(default)]
    pub description: Option<String>,
}

/// Nom d'un groupe importé, avec son état de fusion dans la bibliothèque d'origine.
#[derive(Debug, Deserialize)]
pub struct ImportedName {
    pub name: String,
    pub merged: bool,
}

/// Groupe de synonymes d'une liste importée : son tag principal et ses autres noms.
#[derive(Debug, Deserialize)]
pub struct ImportedGroup {
    pub principal: String,
    pub names: Vec<ImportedName>,
}

#[derive(Debug, Deserialize)]
pub struct ImportedRule {
    pub child: String,
    pub parent: String,
    pub enabled: bool,
}

#[derive(Debug, Deserialize)]
pub struct SharedList {
    pub tags: Vec<ImportedTag>,
    #[serde(default)]
    pub groups: Vec<ImportedGroup>,
    #[serde(default)]
    pub parents: Vec<ImportedRule>,
}

/// Ce que l'import a créé (ou créerait, pour l'aperçu).
#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportReport {
    pub tags: Vec<i64>,
    /// Noms déjà présents (tags ou synonymes actifs) : inchangés.
    pub present: Vec<String>,
    /// Noms ajoutés à des groupes de synonymes.
    pub names: Vec<i64>,
    /// Groupes créés ou complétés.
    pub groups: usize,
    /// Noms ignorés : déjà dans un autre groupe (la réunion de groupes à l'import viendra au lot R8-2).
    pub skipped_names: usize,
    pub parents: Vec<i64>,
    /// Règles refusées : tag absent ou boucle (une règle déjà là est simplement passée).
    pub skipped_parents: usize,
    /// Médias qui ont reçu un parent par les règles importées.
    pub tagged: usize,
}

fn run(db: &Connection, list: &SharedList, now: i64) -> anyhow::Result<ImportReport> {
    let mut report = ImportReport::default();
    let default: i64 = db.query_row("SELECT id FROM tag_categories WHERE key = ?1", [DEFAULT_CATEGORY], |r| r.get(0))?;
    for tag in &list.tags {
        let Some(name) = normalize(&tag.name) else { continue };
        if resolve(db, &name)?.is_some() {
            report.present.push(name);
            continue;
        }
        let category: i64 = db.query_row("SELECT id FROM tag_categories WHERE key = ?1", [&tag.category], |r| r.get(0)).optional()?.unwrap_or(default);
        let description = tag.description.as_deref().map(str::trim).filter(|d| !d.is_empty());
        db.execute(
            "INSERT INTO tags (name, category_id, hidden, created_at, description) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![name, category, tag.hidden, now, description],
        )?;
        report.tags.push(db.last_insert_rowid());
    }
    // Groupes de synonymes : chaque nom est un tag de la liste (créé plus haut s'il manquait). Le principal doit être
    // libre ou déjà principal de son groupe ; un nom déjà dans un autre groupe est ignoré. Un nom fusionné dans la
    // liste l'est aussi ici s'il vient d'être créé (sans média) ; un tag déjà présent est seulement relié (la case
    // « Fusionner les tags pré-existants » viendra au lot R8-2).
    let created: HashSet<i64> = report.tags.iter().copied().collect();
    for item in &list.groups {
        let Some(p) = normalize(&item.principal).map(|n| tag_named(db, &n)).transpose()?.flatten() else {
            report.skipped_names += item.names.len();
            continue;
        };
        let group = match group_of_tag(db, p)? {
            Some(g) if principal(db, g)? == p => g,
            Some(_) => {
                report.skipped_names += item.names.len();
                continue;
            }
            None => {
                db.execute("INSERT INTO tag_groups (principal_id, created_at) VALUES (?1, ?2)", params![p, now])?;
                db.last_insert_rowid()
            }
        };
        let mut added = 0;
        for n in &item.names {
            let Some(t) = normalize(&n.name).map(|name| tag_named(db, &name)).transpose()?.flatten() else {
                report.skipped_names += 1;
                continue;
            };
            match group_of_tag(db, t)? {
                _ if t == p => continue,
                Some(k) if k == group => continue,
                Some(_) => {
                    report.skipped_names += 1;
                    continue;
                }
                None => {}
            }
            let id = add_linked(db, group, t, now)?;
            if n.merged && created.contains(&t) {
                groups::merge(db, id, &[])?;
            }
            report.names.push(id);
            added += 1;
        }
        if added > 0 {
            report.groups += 1;
        }
        // Groupe créé pour rien : il ne reste pas vide.
        db.execute("DELETE FROM tag_groups WHERE id = ?1 AND NOT EXISTS (SELECT 1 FROM tag_group_names WHERE group_id = ?1)", [group])?;
    }
    for rule in &list.parents {
        let (Some(child), Some(parent)) = (resolve(db, &rule.child)?, resolve(db, &rule.parent)?) else {
            report.skipped_parents += 1;
            continue;
        };
        // Déjà là, telle quelle : rien à faire, ce n'est pas un refus (réimporter sa propre liste ne signale rien).
        let present: bool = db.query_row("SELECT EXISTS (SELECT 1 FROM tag_parents WHERE child_id = ?1 AND parent_id = ?2)", params![child.tag_id, parent.tag_id], |r| r.get(0))?;
        if present {
            continue;
        }
        if parents::check(db, child.tag_id, parent.tag_id)?.error.is_some() {
            report.skipped_parents += 1;
            continue;
        }
        // Allumée : posée aussi sur les médias qui ont déjà l'enfant (comme avant) ; éteinte : rien n'est posé.
        let on = rule.enabled;
        report.tagged += parents::create(db, child.tag_id, parent.tag_id, on, now)?;
        let id = db.query_row("SELECT id FROM tag_parents WHERE child_id = ?1 AND parent_id = ?2", params![child.tag_id, parent.tag_id], |r| r.get(0))?;
        if !on {
            parents::set_enabled(db, id, false)?;
        }
        report.parents.push(id);
    }
    Ok(report)
}

fn with_tx<T>(state: &State<'_, AppState>, commit: bool, f: impl FnOnce(&Connection, i64) -> anyhow::Result<T>) -> Result<T, String> {
    let mut conn = state.db.lock().unwrap();
    (|| -> anyhow::Result<T> {
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let out = f(&tx, db::now_ms())?;
        if commit {
            tx.commit()?;
        }
        Ok(out)
    })()
    .map_err(|e| format!("{e:#}"))
}

/// Aperçu exact : l'import est fait puis annulé.
#[tauri::command]
pub async fn preview_tag_import(state: State<'_, AppState>, list: SharedList) -> Result<ImportReport, String> {
    with_tx(&state, false, |db, now| run(db, &list, now))
}

#[tauri::command]
pub async fn import_tags(state: State<'_, AppState>, list: SharedList) -> Result<ImportReport, String> {
    with_tx(&state, true, |db, now| run(db, &list, now))
}

/// « Annuler » après l'import : les règles créées sont supprimées (les parents qu'elles ont posés sont retirés),
/// puis les noms ajoutés aux groupes et les tags créés.
#[tauri::command]
pub async fn undo_tag_import(state: State<'_, AppState>, tags: Vec<i64>, names: Vec<i64>, parents: Vec<i64>) -> Result<(), String> {
    with_tx(&state, true, |db, _| {
        for id in parents {
            parents::delete(db, id, true)?;
        }
        for id in names {
            groups::remove_name(db, id)?;
        }
        for id in tags {
            db.execute("DELETE FROM tags WHERE id = ?1", [id])?;
        }
        Ok(())
    })
}
