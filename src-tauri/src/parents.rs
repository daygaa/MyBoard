//! Règles de parents (TAGM-16, refonte TAGM-20, D-047) : « enfant → parent », poser l'enfant pose le parent.
//! Un seul interrupteur : allumée, chaque nouvel ajout de l'enfant pose le parent ; éteinte, elle ne pose plus
//! rien et ne retire rien. À la création, une case pose le parent sur les médias qui ont déjà l'enfant. Chaque
//! règle note les médias qui ont reçu le parent par elle (GEN-21) : à sa suppression, une case le leur retire
//! (avec ce qu'il avait apporté en chaîne), jamais à un média qui l'avait avant. Les opérations se font dans la
//! transaction de l'appelant ; les compteurs suivent par les déclencheurs (D-005).

use std::collections::HashSet;

use rusqlite::{Connection, OptionalExtension, params};
use serde::Serialize;

use crate::tagging::{Tagger, remove_cascade, restore_justified};

/// Vérification avant de créer une règle : refus expliqué, ou nombre de médias qui ont déjà l'enfant sans le
/// parent (case de la confirmation, refonte D10.1).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleCheck {
    pub error: Option<String>,
    pub media: i64,
}

/// Ce que montre la confirmation de suppression (refonte D10.3, D10.4).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCheck {
    /// Médias où la règle a posé le parent (case de retrait).
    pub media: i64,
    /// Chaînes qui passent par la règle ; vide pour une règle seule.
    pub chains: Vec<Chain>,
}

/// Une chaîne, du tag le plus bas au plus haut (noms) ; `at` : place de l'enfant de la règle (son parent suit), ou du
/// tag supprimé (`tag_chains`).
#[derive(Debug, Serialize)]
pub struct Chain {
    pub tags: Vec<String>,
    pub at: usize,
}

/// Chaînes montrées au plus (une règle peut avoir plusieurs parents ou enfants) : elles défilent dans la pop-in.
const MAX_CHAINS: usize = 20;

fn name(db: &Connection, id: i64) -> rusqlite::Result<String> {
    db.query_row("SELECT name FROM tags WHERE id = ?1", [id], |r| r.get(0)).map(|n: String| n.replace('_', " "))
}

/// Vrai si `to` est un parent de `from`, directement ou en chaîne (règles allumées ou non : une règle
/// éteinte peut être rallumée).
pub fn reaches(db: &Connection, from: i64, to: i64) -> rusqlite::Result<bool> {
    let mut seen = HashSet::from([from]);
    let mut todo = vec![from];
    let mut stmt = db.prepare_cached("SELECT parent_id FROM tag_parents WHERE child_id = ?1")?;
    while let Some(tag) = todo.pop() {
        for parent in stmt.query_map([tag], |r| r.get::<_, i64>(0))? {
            let parent = parent?;
            if parent == to {
                return Ok(true);
            }
            if seen.insert(parent) {
                todo.push(parent);
            }
        }
    }
    Ok(false)
}

/// Médias qui portent l'enfant sans le parent.
fn missing_parent(db: &Connection, child: i64, parent: i64) -> rusqlite::Result<Vec<i64>> {
    let mut stmt = db.prepare_cached(
        "SELECT c.media_id FROM media_tags c WHERE c.tag_id = ?1
         AND NOT EXISTS (SELECT 1 FROM media_tags p WHERE p.media_id = c.media_id AND p.tag_id = ?2)",
    )?;
    let rows = stmt.query_map(params![child, parent], |r| r.get(0))?;
    rows.collect()
}

pub fn check(db: &Connection, child: i64, parent: i64) -> rusqlite::Result<RuleCheck> {
    let error = if child == parent {
        Some("Un tag ne peut pas être son propre parent.".to_string())
    } else if db.query_row("SELECT EXISTS(SELECT 1 FROM tag_parents WHERE child_id = ?1 AND parent_id = ?2)", params![child, parent], |r| r.get(0))? {
        Some("Cette règle existe déjà.".to_string())
    } else if reaches(db, parent, child)? {
        Some(format!(
            "Impossible : « {} » est déjà un parent de « {} » (directement ou en chaîne), la règle ferait une boucle.",
            name(db, child)?,
            name(db, parent)?
        ))
    } else {
        None
    };
    let media = if error.is_some() { 0 } else { missing_parent(db, child, parent)?.len() as i64 };
    Ok(RuleCheck { error, media })
}

/// Crée la règle, allumée ; avec `apply`, la pose aussi sur les médias qui ont déjà l'enfant. Renvoie le
/// nombre de médias qui ont reçu le parent.
pub fn create(db: &Connection, child: i64, parent: i64, apply: bool, now: i64) -> anyhow::Result<usize> {
    if let Some(error) = check(db, child, parent)?.error {
        anyhow::bail!(error);
    }
    db.execute("INSERT INTO tag_parents (child_id, parent_id, created_at) VALUES (?1, ?2, ?3)", params![child, parent, now])?;
    let rule = db.last_insert_rowid();
    if !apply {
        return Ok(0);
    }
    let tagger = Tagger::load(db)?;
    let mut added = 0;
    for m in missing_parent(db, child, parent)? {
        added += tagger.apply_rule(db, rule, parent, m)? as usize;
    }
    Ok(added)
}

/// Interrupteur de la règle : rien n'est retiré ni rattrapé (refonte D10, D10.2).
pub fn set_enabled(db: &Connection, id: i64, enabled: bool) -> rusqlite::Result<()> {
    db.execute("UPDATE tag_parents SET enabled = ?1 WHERE id = ?2", params![enabled, id]).map(|_| ())
}

fn rule_of(db: &Connection, id: i64) -> rusqlite::Result<Option<(i64, i64)>> {
    db.query_row("SELECT child_id, parent_id FROM tag_parents WHERE id = ?1", [id], |r| Ok((r.get(0)?, r.get(1)?))).optional()
}

/// Chemins qui partent de `start` vers ses parents (`up`) ou ses enfants, en chaîne, chacun commençant par
/// `start` ; au plus `MAX_CHAINS`. Les boucles sont refusées à la création des règles.
fn paths(db: &Connection, start: i64, up: bool) -> rusqlite::Result<Vec<Vec<i64>>> {
    let sql = if up { "SELECT parent_id FROM tag_parents WHERE child_id = ?1 ORDER BY parent_id" } else { "SELECT child_id FROM tag_parents WHERE parent_id = ?1 ORDER BY child_id" };
    let next = db.prepare_cached(sql)?.query_map([start], |r| r.get::<_, i64>(0))?.collect::<rusqlite::Result<Vec<_>>>()?;
    if next.is_empty() {
        return Ok(vec![vec![start]]);
    }
    let mut out = Vec::new();
    for n in next {
        for path in paths(db, n, up)? {
            out.push([vec![start], path].concat());
            if out.len() >= MAX_CHAINS {
                return Ok(out);
            }
        }
    }
    Ok(out)
}

pub fn delete_check(db: &Connection, id: i64) -> rusqlite::Result<DeleteCheck> {
    let Some((child, parent)) = rule_of(db, id)? else { return Ok(DeleteCheck { media: 0, chains: Vec::new() }) };
    // Une note passée au principal par une fusion compte encore pour la règle (lot R5).
    let media = db.query_row(
        "SELECT COUNT(DISTINCT media_id) FROM tag_parent_media WHERE rule_id = ?1 AND (tag_id = ?2 OR moved_from = ?2)",
        params![id, parent],
        |r| r.get(0),
    )?;
    let mut chains = Vec::new();
    'all: for mut below in paths(db, child, false)? {
        below.reverse();
        let at = below.len() - 1;
        for above in paths(db, parent, true)? {
            let ids = [below.clone(), above].concat();
            if ids.len() > 2 {
                let tags = ids.iter().map(|&t| db.query_row("SELECT name FROM tags WHERE id = ?1", [t], |r| r.get(0))).collect::<rusqlite::Result<Vec<String>>>()?;
                chains.push(Chain { tags, at });
            }
            if chains.len() >= MAX_CHAINS {
                break 'all;
            }
        }
    }
    Ok(DeleteCheck { media, chains })
}

/// Chaînes qui passent par un tag (pop-in de suppression d'un tag, retour T3, point TAGM-16.8) : du plus bas au plus
/// haut, `at` étant la place du tag ; seulement celles où il a au moins une règle.
pub fn tag_chains(db: &Connection, tag: i64) -> rusqlite::Result<Vec<Chain>> {
    let mut chains = Vec::new();
    'all: for mut below in paths(db, tag, false)? {
        below.reverse();
        let at = below.len() - 1;
        for above in paths(db, tag, true)? {
            let ids = [below.clone(), above[1..].to_vec()].concat();
            if ids.len() > 1 {
                let tags = ids.iter().map(|&t| db.query_row("SELECT name FROM tags WHERE id = ?1", [t], |r| r.get(0))).collect::<rusqlite::Result<Vec<String>>>()?;
                chains.push(Chain { tags, at });
            }
            if chains.len() >= MAX_CHAINS {
                break 'all;
            }
        }
    }
    Ok(chains)
}

/// Corbeille : la règle est oubliée ; avec `remove`, les tags qu'elle a posés sont retirés de ces médias, avec
/// ce qu'ils avaient apporté en chaîne, puis ceux qu'une autre règle allumée justifie encore sont remis.
pub fn delete(db: &Connection, id: i64, remove: bool) -> anyhow::Result<()> {
    // Une note restée sur un tag fusionné (le média avait déjà le principal) : rien à retirer pendant la fusion.
    let pairs = if remove {
        db.prepare_cached(
            "SELECT media_id, tag_id FROM tag_parent_media WHERE rule_id = ?1
              AND NOT EXISTS (SELECT 1 FROM tag_group_names n WHERE n.tag_id = tag_parent_media.tag_id AND n.merged = 1)",
        )?
            .query_map([id], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<rusqlite::Result<Vec<(i64, i64)>>>()?
    } else {
        Vec::new()
    };
    db.execute("DELETE FROM tag_parents WHERE id = ?1", [id])?;
    let mut removed = pairs.clone();
    for &(media, tag) in &pairs {
        removed.extend(remove_cascade(db, media, tag)?);
    }
    restore_justified(db, &removed)?;
    Ok(())
}
