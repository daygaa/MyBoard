//! Import d'une liste de tags partagée (TAGM-10, TAGM-18) : tags (catégorie par sa clé, état masqué,
//! description), synonymes et règles de parents. L'aperçu fait l'import dans une transaction annulée :
//! ses nombres sont exacts. « Annuler » après l'import retire ce qui a été créé (GEN-21).

use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::tagging::resolve;
use crate::tags::{DEFAULT_CATEGORY, normalize};
use crate::{AppState, aliases, db, parents};

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

#[derive(Debug, Deserialize)]
pub struct ImportedAlias {
    pub alias: String,
    pub tag: String,
    pub enabled: bool,
}

/// Règle d'une liste importée. `auto` : ancien interrupteur « Auto », lu jusqu'au nouveau code de partage
/// (lot R8) : allumée seulement si cochée et « Auto » allumé (même conversion que le schéma v8).
#[derive(Debug, Deserialize)]
pub struct ImportedRule {
    pub child: String,
    pub parent: String,
    pub enabled: bool,
    #[serde(default = "yes")]
    pub auto: bool,
}

fn yes() -> bool {
    true
}

#[derive(Debug, Deserialize)]
pub struct SharedList {
    pub tags: Vec<ImportedTag>,
    #[serde(default)]
    pub aliases: Vec<ImportedAlias>,
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
    pub aliases: Vec<i64>,
    /// Synonymes ignorés : nom déjà pris (tag ou synonyme), ou tag principal absent.
    pub skipped_aliases: usize,
    pub parents: Vec<i64>,
    /// Règles ignorées : déjà présentes, tag absent, ou boucle.
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
    for item in &list.aliases {
        let Some(alias) = normalize(&item.alias) else { continue };
        let taken: bool = db.query_row(
            "SELECT EXISTS(SELECT 1 FROM tags WHERE name = ?1) OR EXISTS(SELECT 1 FROM tag_aliases WHERE alias = ?1)",
            [&alias],
            |r| r.get(0),
        )?;
        // Un nom déjà utilisé ici n'est jamais fusionné par un import : seulement à la main.
        let Some(target) = resolve(db, &item.tag)?.filter(|_| !taken) else {
            report.skipped_aliases += 1;
            continue;
        };
        db.execute(
            "INSERT INTO tag_aliases (alias, tag_id, enabled, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![alias, target.tag_id, item.enabled, now],
        )?;
        report.aliases.push(db.last_insert_rowid());
    }
    for rule in &list.parents {
        let (Some(child), Some(parent)) = (resolve(db, &rule.child)?, resolve(db, &rule.parent)?) else {
            report.skipped_parents += 1;
            continue;
        };
        if parents::check(db, child.tag_id, parent.tag_id)?.error.is_some() {
            report.skipped_parents += 1;
            continue;
        }
        // Allumée : posée aussi sur les médias qui ont déjà l'enfant (comme avant) ; éteinte : rien n'est posé.
        let on = rule.enabled && rule.auto;
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
/// puis les synonymes et les tags créés.
#[tauri::command]
pub async fn undo_tag_import(state: State<'_, AppState>, tags: Vec<i64>, aliases: Vec<i64>, parents: Vec<i64>) -> Result<(), String> {
    with_tx(&state, true, |db, _| {
        for id in parents {
            parents::delete(db, id, true)?;
        }
        for id in aliases {
            aliases::delete(db, id)?;
        }
        for id in tags {
            db.execute("DELETE FROM tags WHERE id = ?1", [id])?;
        }
        Ok(())
    })
}
