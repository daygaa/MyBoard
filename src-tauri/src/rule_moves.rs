//! Règles de parents et fusion des synonymes (retour T3, point TAGM-16.4 ; refonte, décisions D11 à D11.3 ; lot R5,
//! D-047). Pendant la fusion d'un tag dans le principal, aucun média ne peut avoir ce tag : une règle qui le cite est
//! soit **déplacée** (réécrite avec le principal, elle note d'où elle vient et revient à la défusion), soit **mise de
//! côté** (laissée telle quelle : elle ne pose rien tant que le tag est fusionné, puis remarche). Une règle dont le tag
//! est l'enfant n'est déplacée que si elle est étendue à tout le groupe (D11.3 ; la case viendra au lot R5-2).
//! L'aperçu des pop-ins joue l'action dans une transaction annulée et compare les règles avant et après.

use std::collections::HashMap;

use rusqlite::{Connection, params};
use serde::Serialize;

use crate::parents::reaches;

fn exists(db: &Connection, child: i64, parent: i64) -> rusqlite::Result<bool> {
    db.query_row("SELECT EXISTS(SELECT 1 FROM tag_parents WHERE child_id = ?1 AND parent_id = ?2)", params![child, parent], |r| r.get(0))
}

fn in_group(db: &Connection, group: i64, tag: i64) -> rusqlite::Result<bool> {
    db.query_row(
        "SELECT EXISTS(SELECT 1 FROM tag_groups WHERE id = ?1 AND principal_id = ?2)
             OR EXISTS(SELECT 1 FROM tag_group_names WHERE group_id = ?1 AND tag_id = ?2)",
        params![group, tag],
        |r| r.get(0),
    )
}

/// Pourquoi une règle d'un tag fusionné ne peut pas être déplacée : `None` si elle peut l'être.
enum Blocked {
    /// Les deux tags seraient du groupe (« kitty » → « chat » donnerait « chat » → « chat »).
    Internal,
    /// La règle réécrite existe déjà.
    Duplicate,
    Loop,
}

fn blocked(db: &Connection, group: i64, child: i64, parent: i64) -> rusqlite::Result<Option<Blocked>> {
    Ok(if in_group(db, group, child)? && in_group(db, group, parent)? {
        Some(Blocked::Internal)
    } else if exists(db, child, parent)? {
        Some(Blocked::Duplicate)
    } else if reaches(db, parent, child)? {
        Some(Blocked::Loop)
    } else {
        None
    })
}

/// Fusion de `tag` (nom `name` du groupe `group`) dans le principal `p`, avant que ses médias passent au principal :
/// les règles dont il est le parent sont déplacées (« chaton » → « kitty » devient « chaton » → « chat »), celles dont
/// il est l'enfant seulement si `extend` le dit ; les autres restent, mises de côté. Les notes des règles sur ses
/// médias suivent le principal là où il vient de la fusion ; là où le média l'avait déjà, elles restent sur le tag
/// (une règle ne retire jamais un tag qui était là avant, Q.2).
pub fn follow_merge(db: &Connection, name: i64, tag: i64, p: i64, group: i64, extend: &dyn Fn(i64) -> bool) -> rusqlite::Result<()> {
    let rules = db
        .prepare("SELECT id, child_id, parent_id FROM tag_parents WHERE child_id = ?1 OR parent_id = ?1")?
        .query_map([tag], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?, r.get::<_, i64>(2)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    for (id, child, parent) in rules {
        if child == tag && !extend(id) {
            continue;
        }
        let (c, par) = (if child == tag { p } else { child }, if parent == tag { p } else { parent });
        if blocked(db, group, c, par)?.is_some() {
            continue;
        }
        if child == tag {
            db.execute("UPDATE tag_parents SET child_id = ?2, child_from = ?3 WHERE id = ?1", params![id, p, tag])?;
        } else {
            db.execute("UPDATE tag_parents SET parent_id = ?2, parent_from = ?3 WHERE id = ?1", params![id, p, tag])?;
        }
    }
    db.execute(
        "UPDATE OR IGNORE tag_parent_media SET tag_id = ?2, moved_from = ?1
          WHERE tag_id = ?1 AND media_id IN (SELECT media_id FROM tag_group_media WHERE name_id = ?3 AND had_principal = 0)",
        params![tag, p, name],
    )?;
    Ok(())
}

/// Défusion de `tag` (principal `p`), avant que ses médias le retrouvent : les règles venues de lui reviennent, sauf
/// celles qui feraient alors un doublon ou une boucle avec une règle créée pendant la fusion : elles restent sur le
/// principal, ordinaires, et sont renvoyées (badge, réponse 5d du lot R5). Les notes reviennent sur le tag, comme
/// celles d'une règle revenue qui a posé le principal pendant la fusion (le média, noté sous le tag, le retrouve :
/// réponse 1).
pub fn follow_unmerge(db: &Connection, tag: i64, p: i64) -> rusqlite::Result<Vec<i64>> {
    let rules = db
        .prepare("SELECT id, child_id, parent_id, child_from IS ?1 FROM tag_parents WHERE child_from = ?1 OR parent_from = ?1")?
        .query_map([tag], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?, r.get::<_, i64>(2)?, r.get::<_, bool>(3)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let mut stayed = Vec::new();
    for (id, child, parent, child_side) in rules {
        let (c, par) = if child_side { (tag, parent) } else { (child, tag) };
        if exists(db, c, par)? || reaches(db, par, c)? {
            db.execute("UPDATE tag_parents SET child_from = NULLIF(child_from, ?2), parent_from = NULLIF(parent_from, ?2) WHERE id = ?1", params![id, tag])?;
            stayed.push(id);
        } else if child_side {
            db.execute("UPDATE tag_parents SET child_id = ?2, child_from = NULL WHERE id = ?1", params![id, tag])?;
        } else {
            db.execute("UPDATE tag_parents SET parent_id = ?2, parent_from = NULL WHERE id = ?1", params![id, tag])?;
        }
    }
    db.execute(
        "UPDATE OR IGNORE tag_parent_media SET tag_id = ?1, moved_from = NULL
          WHERE moved_from = ?1 OR (tag_id = ?2 AND rule_id IN (SELECT id FROM tag_parents WHERE parent_id = ?1))",
        params![tag, p],
    )?;
    db.execute("UPDATE tag_parent_media SET moved_from = NULL WHERE moved_from = ?1", [tag])?;
    Ok(stayed)
}

/// Tag fusionné qui va être supprimé (fusion de l'onglet « Tags » sans « Garder les anciens noms », revue au lot R6) :
/// ses règles restantes passent pour de bon au principal, comme avant le lot R5, sauf celles qui deviendraient
/// inutiles (règle déjà présente, tag parent de lui-même) ou feraient une boucle : elles partent avec lui.
pub fn adopt(db: &Connection, tag: i64, p: i64) -> rusqlite::Result<()> {
    let rules = db
        .prepare("SELECT id, child_id, parent_id FROM tag_parents WHERE child_id = ?1 OR parent_id = ?1")?
        .query_map([tag], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?, r.get::<_, i64>(2)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    for (id, child, parent) in rules {
        let (c, par) = (if child == tag { p } else { child }, if parent == tag { p } else { parent });
        if c != par && !exists(db, c, par)? && !reaches(db, par, c)? {
            db.execute("UPDATE tag_parents SET child_id = ?2, parent_id = ?3 WHERE id = ?1", params![id, c, par])?;
        }
    }
    Ok(())
}

// --- Aperçu des pop-ins (fusion, changement de principal)

/// Une règle et son état : tags, et le tag fusionné qu'elle cite (mise de côté) avec son principal et son groupe.
struct State {
    child: i64,
    parent: i64,
    aside: Option<(i64, i64, i64)>,
}

fn snapshot(db: &Connection) -> rusqlite::Result<HashMap<i64, State>> {
    db.prepare(
        "SELECT p.id, p.child_id, p.parent_id, n.tag_id, g.principal_id, g.id
           FROM tag_parents p
           LEFT JOIN tag_group_names n ON n.merged = 1 AND n.tag_id IN (p.child_id, p.parent_id)
           LEFT JOIN tag_groups g ON g.id = n.group_id",
    )?
    .query_map([], |r| {
        let aside = match (r.get::<_, Option<i64>>(3)?, r.get::<_, Option<i64>>(4)?, r.get::<_, Option<i64>>(5)?) {
            (Some(t), Some(p), Some(g)) => Some((t, p, g)),
            _ => None,
        };
        Ok((r.get(0)?, State { child: r.get(1)?, parent: r.get(2)?, aside }))
    })?
    .collect()
}

/// Ce que l'action change à une règle (lignes « Règles de parents » des pop-ins, réponse 3 du lot R5).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleChange {
    /// « moved » (réécrite), « aside » (mise de côté), « back » (plus mise de côté).
    pub kind: &'static str,
    pub child: String,
    pub parent: String,
    /// Réécrite : la nouvelle règle ; mise de côté parce qu'elle existe déjà : cette règle.
    pub new_child: Option<String>,
    pub new_parent: Option<String>,
    /// Mise de côté : « duplicate », « loop », ou rien.
    pub reason: Option<&'static str>,
}

/// Joue `action` dans une transaction annulée et renvoie ce qu'elle change aux règles.
pub fn preview(db: &mut Connection, action: impl FnOnce(&Connection) -> anyhow::Result<()>) -> anyhow::Result<Vec<RuleChange>> {
    let tx = db.transaction()?;
    let before = snapshot(&tx)?;
    action(&tx)?;
    let after = snapshot(&tx)?;
    let name = |id: i64| tx.query_row("SELECT name FROM tags WHERE id = ?1", [id], |r| r.get::<_, String>(0));
    let mut changes = Vec::new();
    let mut ids: Vec<&i64> = after.keys().collect();
    ids.sort();
    for &id in ids {
        let (Some(old), new) = (before.get(&id), &after[&id]) else { continue };
        let line = |kind, new_pair: Option<(i64, i64)>, reason| -> rusqlite::Result<RuleChange> {
            Ok(RuleChange {
                kind,
                child: name(old.child)?,
                parent: name(old.parent)?,
                new_child: new_pair.map(|(c, _)| name(c)).transpose()?,
                new_parent: new_pair.map(|(_, p)| name(p)).transpose()?,
                reason,
            })
        };
        if (old.child, old.parent) != (new.child, new.parent) {
            changes.push(line("moved", Some((new.child, new.parent)), None)?);
        } else if let (None, Some((tag, p, group))) = (&old.aside, new.aside) {
            // Côté parent : le doublon ou la boucle est expliqué ; une règle interne au groupe, ou dont le tag
            // fusionné est l'enfant, se comprend seule.
            let (c, par) = (if new.child == tag { p } else { new.child }, if new.parent == tag { p } else { new.parent });
            let reason = if new.child == tag { None } else {
                match blocked(&tx, group, c, par)? {
                    Some(Blocked::Duplicate) => Some("duplicate"),
                    Some(Blocked::Loop) => Some("loop"),
                    _ => None,
                }
            };
            changes.push(line("aside", (reason == Some("duplicate")).then_some((c, par)), reason)?);
        } else if old.aside.is_some() && new.aside.is_none() {
            changes.push(line("back", None, None)?);
        }
    }
    changes.sort_by_key(|c| ["moved", "aside", "back"].iter().position(|k| *k == c.kind));
    Ok(changes)
}
