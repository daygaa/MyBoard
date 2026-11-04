//! Import d'une liste de tags partagée (TAGM-10, TAGM-18 ; nouveau format, lots R8-1 et R8-2) : tags (catégorie par sa
//! clé, état masqué, description), groupes de synonymes (`import_groups.rs`) et règles de parents, chacun selon sa case
//! (retour T3, point TAGM-18.4). L'aperçu fait l'import dans une transaction annulée : ses nombres et ses lignes sont
//! exacts. « Annuler » après l'import remet tout comme avant, réunions de groupes comprises (GEN-21).

use std::collections::HashSet;

use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::import_groups::{self, GroupLine, JoinedGroup, Outcome};
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

/// Cases de la pop-in d'import : groupes, règles de parents, fusion des tags déjà présents.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportOptions {
    pub groups: bool,
    pub parents: bool,
    pub merge_existing: bool,
}

/// Ligne « Règles de parents » de l'aperçu (retour T3, point TAGM-18.9).
#[derive(Debug, Serialize)]
pub struct RuleLine {
    pub child: String,
    pub parent: String,
    pub enabled: bool,
    /// Un de ses tags est fusionné : la règle ne pose rien tant qu'il l'est (retour T3, point TAGM-18.11).
    pub aside: bool,
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
    /// Noms déjà dans leur groupe, fusionnés par l'import ; groupes de la base réunis (pour « Annuler »).
    pub fused: Vec<i64>,
    pub joined: Vec<JoinedGroup>,
    /// Groupes créés ou modifiés, une ligne chacun pour l'aperçu.
    pub groups: usize,
    pub group_lines: Vec<GroupLine>,
    /// Noms ignorés (tag introuvable).
    pub skipped_names: usize,
    pub parents: Vec<i64>,
    /// Règles refusées : tag absent ou boucle (une règle déjà là est simplement passée).
    pub skipped_parents: usize,
    pub rule_lines: Vec<RuleLine>,
    /// Médias qui ont reçu un parent par les règles importées.
    pub tagged: usize,
}

fn run(db: &Connection, list: &SharedList, options: &ImportOptions, now: i64) -> anyhow::Result<ImportReport> {
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
    if options.groups {
        let created: HashSet<i64> = report.tags.iter().copied().collect();
        let mut out = Outcome::default();
        for item in &list.groups {
            import_groups::import(db, item, &created, options.merge_existing, now, &mut out)?;
        }
        report.groups = out.lines.len();
        (report.names, report.fused, report.joined, report.group_lines, report.skipped_names) = (out.names, out.fused, out.joined, out.lines, out.skipped);
    }
    let rules = if options.parents { list.parents.as_slice() } else { &[] };
    for rule in rules {
        let (Some(child), Some(parent)) = (as_is(db, &rule.child)?, as_is(db, &rule.parent)?) else {
            report.skipped_parents += 1;
            continue;
        };
        // Déjà là, telle quelle : rien à faire, ce n'est pas un refus (réimporter sa propre liste ne signale rien).
        let present: bool = db.query_row("SELECT EXISTS (SELECT 1 FROM tag_parents WHERE child_id = ?1 AND parent_id = ?2)", params![child, parent], |r| r.get(0))?;
        if present {
            continue;
        }
        if parents::check(db, child, parent)?.error.is_some() {
            report.skipped_parents += 1;
            continue;
        }
        // Allumée : posée aussi sur les médias qui ont déjà l'enfant (comme avant) ; éteinte : rien n'est posé.
        let on = rule.enabled;
        report.tagged += parents::create(db, child, parent, on, now)?;
        let id = db.query_row("SELECT id FROM tag_parents WHERE child_id = ?1 AND parent_id = ?2", params![child, parent], |r| r.get(0))?;
        if !on {
            parents::set_enabled(db, id, false)?;
        }
        report.parents.push(id);
        let aside = db.query_row("SELECT EXISTS (SELECT 1 FROM tag_group_names WHERE merged = 1 AND tag_id IN (?1, ?2))", params![child, parent], |r| r.get(0))?;
        report.rule_lines.push(RuleLine { child: tag_name(db, child)?, parent: tag_name(db, parent)?, enabled: on, aside });
    }
    Ok(report)
}

/// Tag d'une règle du code, tel quel, même s'il est fusionné ici (pas son tag principal, comme à la saisie) : la
/// règle arrive alors mise de côté, comme chez celui qui a exporté ; réimporter son propre code ne crée rien
/// (cas C-09 du test complet, choix A du 04/11, retour T3, point TAGM-18.11).
fn as_is(db: &Connection, raw: &str) -> rusqlite::Result<Option<i64>> {
    let Some(name) = normalize(raw) else { return Ok(None) };
    crate::groups::tag_named(db, &name)
}

fn tag_name(db: &Connection, tag: i64) -> rusqlite::Result<String> {
    db.query_row("SELECT name FROM tags WHERE id = ?1", [tag], |r| r.get(0))
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
pub async fn preview_tag_import(state: State<'_, AppState>, list: SharedList, options: ImportOptions) -> Result<ImportReport, String> {
    with_tx(&state, false, |db, now| run(db, &list, &options, now))
}

#[tauri::command]
pub async fn import_tags(state: State<'_, AppState>, list: SharedList, options: ImportOptions) -> Result<ImportReport, String> {
    with_tx(&state, true, |db, now| run(db, &list, &options, now))
}

/// « Annuler » après l'import : les règles créées sont supprimées (les parents qu'elles ont posés sont retirés), puis les
/// groupes remis comme avant (import_groups.rs) et les tags créés supprimés.
#[tauri::command]
pub async fn undo_tag_import(state: State<'_, AppState>, tags: Vec<i64>, names: Vec<i64>, fused: Vec<i64>, joined: Vec<JoinedGroup>, parents: Vec<i64>) -> Result<(), String> {
    with_tx(&state, true, |db, now| {
        for id in parents {
            parents::delete(db, id, true)?;
        }
        import_groups::undo(db, &names, &fused, &joined, now)?;
        for id in tags {
            db.execute("DELETE FROM tags WHERE id = ?1", [id])?;
        }
        Ok(())
    })
}
