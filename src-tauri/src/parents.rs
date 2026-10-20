//! Règles de parents (TAGM-16) : « enfant → parent », poser l'enfant pose le parent. Rétroactives :
//! une règle créée (ou recochée) s'applique aux médias qui ont déjà l'enfant. Chaque règle note les
//! médias qui ont reçu le parent par elle (GEN-21) : la décocher le leur retire, la recocher le leur
//! remet, la corbeille le retire puis oublie la règle. Les opérations se font dans la transaction de
//! l'appelant ; les compteurs suivent par les déclencheurs (D-005).

use std::collections::HashSet;

use rusqlite::{Connection, OptionalExtension, params};
use serde::Serialize;

use crate::tagging::{Tagger, remove_cascade, restore_justified};

/// Vérification avant de créer une règle : refus expliqué, ou nombre de médias qui recevront le
/// parent (confirmation, Q5-A).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleCheck {
    pub error: Option<String>,
    pub media: i64,
}

/// Ce que ferait la réactivation d'une règle : médias où le parent sera remis, et médias qui ont
/// reçu l'enfant pendant qu'elle ne s'appliquait pas (ajout proposé).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnableCheck {
    pub restore: i64,
    pub skipped: i64,
}

fn name(db: &Connection, id: i64) -> rusqlite::Result<String> {
    db.query_row("SELECT name FROM tags WHERE id = ?1", [id], |r| r.get(0)).map(|n: String| n.replace('_', " "))
}

/// Vrai si `to` est un parent de `from`, directement ou en chaîne (règles cochées ou non : une règle
/// décochée peut être recochée).
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

/// Crée la règle et l'applique aux médias qui ont déjà l'enfant ; renvoie le nombre de médias qui ont
/// reçu le parent.
pub fn create(db: &Connection, child: i64, parent: i64, now: i64) -> anyhow::Result<usize> {
    if let Some(error) = check(db, child, parent)?.error {
        anyhow::bail!(error);
    }
    db.execute("INSERT INTO tag_parents (child_id, parent_id, created_at) VALUES (?1, ?2, ?3)", params![child, parent, now])?;
    let rule = db.last_insert_rowid();
    apply_to(db, rule, parent, &missing_parent(db, child, parent)?)
}

fn apply_to(db: &Connection, rule: i64, parent: i64, media: &[i64]) -> anyhow::Result<usize> {
    let tagger = Tagger::load(db)?;
    let mut added = 0;
    for &m in media {
        added += tagger.apply_rule(db, rule, parent, m)? as usize;
    }
    Ok(added)
}

fn rule_of(db: &Connection, id: i64) -> rusqlite::Result<Option<(i64, i64, bool)>> {
    db.query_row("SELECT child_id, parent_id, enabled FROM tag_parents WHERE id = ?1", [id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
        .optional()
}

/// Médias de la liste de la règle qui portent toujours l'enfant et plus le parent : il leur sera remis.
fn to_restore(db: &Connection, id: i64, child: i64, parent: i64) -> rusqlite::Result<Vec<i64>> {
    let mut stmt = db.prepare_cached(
        "SELECT DISTINCT l.media_id FROM tag_parent_media l
         WHERE l.rule_id = ?1 AND l.tag_id = ?3
           AND EXISTS (SELECT 1 FROM media_tags c WHERE c.media_id = l.media_id AND c.tag_id = ?2)
           AND NOT EXISTS (SELECT 1 FROM media_tags p WHERE p.media_id = l.media_id AND p.tag_id = ?3)",
    )?;
    let rows = stmt.query_map(params![id, child, parent], |r| r.get(0))?;
    rows.collect()
}

/// Médias qui ont reçu l'enfant pendant que la règle ne s'appliquait pas, toujours sans le parent.
fn skipped(db: &Connection, id: i64, child: i64, parent: i64) -> rusqlite::Result<Vec<i64>> {
    let mut stmt = db.prepare_cached(
        "SELECT s.media_id FROM tag_parent_skipped s
         WHERE s.rule_id = ?1
           AND EXISTS (SELECT 1 FROM media_tags c WHERE c.media_id = s.media_id AND c.tag_id = ?2)
           AND NOT EXISTS (SELECT 1 FROM media_tags p WHERE p.media_id = s.media_id AND p.tag_id = ?3)
           AND NOT EXISTS (SELECT 1 FROM tag_parent_media l WHERE l.rule_id = ?1 AND l.media_id = s.media_id AND l.tag_id = ?3)",
    )?;
    let rows = stmt.query_map(params![id, child, parent], |r| r.get(0))?;
    rows.collect()
}

pub fn enable_check(db: &Connection, id: i64) -> rusqlite::Result<EnableCheck> {
    let Some((child, parent, enabled)) = rule_of(db, id)? else { return Ok(EnableCheck { restore: 0, skipped: 0 }) };
    let restore = if enabled { 0 } else { to_restore(db, id, child, parent)?.len() as i64 };
    Ok(EnableCheck { restore, skipped: skipped(db, id, child, parent)?.len() as i64 })
}

/// Case de la règle. Décochée : les tags qu'elle a posés sont retirés (sa liste est gardée).
/// Recochée : ils sont remis ; `add_skipped` ajoute aussi le parent aux médias qui ont reçu l'enfant
/// entre-temps (proposé à l'utilisateur).
pub fn set_enabled(db: &Connection, id: i64, enabled: bool, add_skipped: bool) -> anyhow::Result<()> {
    let Some((child, parent, was)) = rule_of(db, id)? else { return Ok(()) };
    if enabled == was {
        return Ok(());
    }
    db.execute("UPDATE tag_parents SET enabled = ?1 WHERE id = ?2", params![enabled, id])?;
    if !enabled {
        return remove_listed(db, id);
    }
    let mut media = to_restore(db, id, child, parent)?;
    if add_skipped {
        media.extend(skipped(db, id, child, parent)?);
    }
    // La liste est refaite par la réapplication : seuls les tags réellement remis y reviennent.
    db.execute("DELETE FROM tag_parent_media WHERE rule_id = ?1", [id])?;
    db.execute("DELETE FROM tag_parent_skipped WHERE rule_id = ?1", [id])?;
    apply_to(db, id, parent, &media)?;
    Ok(())
}

/// Interrupteur « Auto ». Rallumé, `add_skipped` ajoute le parent aux médias qui ont reçu l'enfant
/// pendant qu'il était éteint.
pub fn set_auto(db: &Connection, id: i64, auto: bool, add_skipped: bool) -> anyhow::Result<()> {
    let Some((child, parent, _)) = rule_of(db, id)? else { return Ok(()) };
    db.execute("UPDATE tag_parents SET auto = ?1 WHERE id = ?2", params![auto, id])?;
    if auto {
        let media = if add_skipped { skipped(db, id, child, parent)? } else { Vec::new() };
        db.execute("DELETE FROM tag_parent_skipped WHERE rule_id = ?1", [id])?;
        apply_to(db, id, parent, &media)?;
    }
    Ok(())
}

/// Corbeille : retire les tags posés par la règle (si elle est cochée), puis l'oublie.
pub fn delete(db: &Connection, id: i64) -> anyhow::Result<()> {
    if let Some((_, _, true)) = rule_of(db, id)? {
        db.execute("UPDATE tag_parents SET enabled = 0 WHERE id = ?1", [id])?;
        remove_listed(db, id)?;
    }
    db.execute("DELETE FROM tag_parents WHERE id = ?1", [id])?;
    Ok(())
}

/// Retire des médias les tags notés sous cette règle (déjà décochée : le déclencheur garde sa liste),
/// avec les parents qu'ils avaient apportés en chaîne, puis remet ceux qu'une autre règle cochée
/// justifie encore.
fn remove_listed(db: &Connection, id: i64) -> anyhow::Result<()> {
    let mut stmt = db.prepare_cached("SELECT media_id, tag_id FROM tag_parent_media WHERE rule_id = ?1")?;
    let pairs = stmt.query_map([id], |r| Ok((r.get(0)?, r.get(1)?)))?.collect::<rusqlite::Result<Vec<(i64, i64)>>>()?;
    let mut removed = pairs.clone();
    for &(media, tag) in &pairs {
        removed.extend(remove_cascade(db, media, tag)?);
    }
    restore_justified(db, &removed)?;
    Ok(())
}

/// Fusion du tag `source` dans `target` (TAGM-04, TAGM-15) : ses règles passent à `target`, sauf
/// celles qui deviendraient inutiles (règle déjà présente, tag parent de lui-même) ou feraient une
/// boucle : elles disparaissent avec `source`.
pub fn move_rules(db: &Connection, source: i64, target: i64) -> rusqlite::Result<()> {
    let mut stmt = db.prepare("SELECT id, child_id, parent_id FROM tag_parents WHERE child_id = ?1 OR parent_id = ?1")?;
    let rules = stmt.query_map([source], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?, r.get::<_, i64>(2)?)))?.collect::<rusqlite::Result<Vec<_>>>()?;
    for (id, child, parent) in rules {
        let (child, parent) = (if child == source { target } else { child }, if parent == source { target } else { parent });
        let exists: bool = db.query_row("SELECT EXISTS(SELECT 1 FROM tag_parents WHERE child_id = ?1 AND parent_id = ?2)", params![child, parent], |r| r.get(0))?;
        if child == parent || exists || reaches(db, parent, child)? {
            continue;
        }
        db.execute("UPDATE tag_parents SET child_id = ?1, parent_id = ?2 WHERE id = ?3", params![child, parent, id])?;
    }
    db.execute("UPDATE OR IGNORE tag_parent_media SET tag_id = ?2 WHERE tag_id = ?1", params![source, target])?;
    Ok(())
}
