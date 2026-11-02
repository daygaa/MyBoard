//! Aperçu des pop-ins de fusion et de changement de principal (lot R5, réponses 3 et 5b) : l'action est jouée dans
//! une transaction annulée, puis les règles de parents sont comparées avant et après. Pour une fusion, les règles qui
//! peuvent s'étendre à tout le groupe reçoivent une case « Étendre » avec le nombre de médias qui recevraient leur
//! parent (refonte, décision D11.3, lot R5-2).

use std::collections::{HashMap, HashSet};

use rusqlite::{Connection, params};
use serde::Serialize;

use crate::rule_moves::{Blocked, blocked};

/// Une règle et son état : tags, allumée, et le tag fusionné qu'elle cite (mise de côté) avec son principal et son
/// groupe.
struct State {
    child: i64,
    parent: i64,
    enabled: bool,
    aside: Option<(i64, i64, i64)>,
}

fn snapshot(db: &Connection) -> rusqlite::Result<HashMap<i64, State>> {
    db.prepare(
        "SELECT p.id, p.child_id, p.parent_id, p.enabled, n.tag_id, g.principal_id, g.id
           FROM tag_parents p
           LEFT JOIN tag_group_names n ON n.merged = 1 AND n.tag_id IN (p.child_id, p.parent_id)
           LEFT JOIN tag_groups g ON g.id = n.group_id",
    )?
    .query_map([], |r| {
        let aside = match (r.get::<_, Option<i64>>(4)?, r.get::<_, Option<i64>>(5)?, r.get::<_, Option<i64>>(6)?) {
            (Some(t), Some(p), Some(g)) => Some((t, p, g)),
            _ => None,
        };
        Ok((r.get(0)?, State { child: r.get(1)?, parent: r.get(2)?, enabled: r.get(3)?, aside }))
    })?
    .collect()
}

/// Tags fusionnés, avec le principal où ils le sont.
fn merged(db: &Connection) -> rusqlite::Result<HashSet<(i64, i64)>> {
    db.prepare("SELECT n.tag_id, g.principal_id FROM tag_group_names n JOIN tag_groups g ON g.id = n.group_id WHERE n.merged = 1")?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect()
}

/// Ce que l'action change à une règle (lignes « Règles de parents » des pop-ins, réponse 3 du lot R5).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleChange {
    pub id: i64,
    /// « moved » (réécrite), « aside » (mise de côté), « back » (plus mise de côté), « principal » (règle du principal
    /// qui peut s'étendre aux médias des tags fusionnés).
    pub kind: &'static str,
    pub child: String,
    pub parent: String,
    /// Réécrite : la nouvelle règle ; mise de côté : la règle réécrite (étendue, ou qui existe déjà).
    pub new_child: Option<String>,
    pub new_parent: Option<String>,
    /// Mise de côté : « duplicate », « loop », ou rien.
    pub reason: Option<&'static str>,
    /// Case « Étendre » : médias qui recevraient le parent ; vide : pas de case.
    pub extend: Option<i64>,
    /// Règle du principal : les tags fusionnés dont les médias la recevraient.
    pub of: Vec<String>,
}

/// Médias qui portent `tag` sans `parent`.
fn missing(db: &Connection, tag: i64, parent: i64) -> rusqlite::Result<i64> {
    db.query_row(
        "SELECT COUNT(*) FROM media_tags m WHERE m.tag_id = ?1 AND NOT EXISTS (SELECT 1 FROM media_tags y WHERE y.media_id = m.media_id AND y.tag_id = ?2)",
        params![tag, parent],
        |r| r.get(0),
    )
}

/// Joue `action` dans une transaction annulée et renvoie ce qu'elle change aux règles ; `extendable` : une fusion
/// (cases « Étendre »), pas un changement de principal.
pub fn preview(db: &mut Connection, extendable: bool, action: impl FnOnce(&Connection) -> anyhow::Result<()>) -> anyhow::Result<Vec<RuleChange>> {
    let tx = db.transaction()?;
    let (before, merged_before) = (snapshot(&tx)?, merged(&tx)?);
    action(&tx)?;
    let after = snapshot(&tx)?;
    let name = |id: i64| tx.query_row("SELECT name FROM tags WHERE id = ?1", [id], |r| r.get::<_, String>(0));
    let mut changes = Vec::new();
    let mut ids: Vec<&i64> = after.keys().collect();
    ids.sort();
    for &id in ids {
        let (Some(old), new) = (before.get(&id), &after[&id]) else { continue };
        let line = |kind, new_pair: Option<(i64, i64)>, reason, extend| -> rusqlite::Result<RuleChange> {
            Ok(RuleChange {
                id,
                kind,
                child: name(old.child)?,
                parent: name(old.parent)?,
                new_child: new_pair.map(|(c, _)| name(c)).transpose()?,
                new_parent: new_pair.map(|(_, p)| name(p)).transpose()?,
                reason,
                extend,
                of: Vec::new(),
            })
        };
        if (old.child, old.parent) != (new.child, new.parent) {
            changes.push(line("moved", Some((new.child, new.parent)), None, None)?);
        } else if let (None, Some((tag, p, group))) = (&old.aside, new.aside) {
            // Le doublon ou la boucle est expliqué ; une règle interne au groupe se comprend seule. Une règle allumée
            // dont le tag fusionné est l'enfant, et qui pourrait être réécrite, a la case « Étendre ».
            let (c, par) = (if new.child == tag { p } else { new.child }, if new.parent == tag { p } else { new.parent });
            let (reason, free) = match blocked(&tx, group, c, par)? {
                Some(Blocked::Duplicate) => (Some("duplicate"), false),
                Some(Blocked::Loop) => (Some("loop"), false),
                Some(Blocked::Internal) => (None, false),
                None => (None, true),
            };
            let extend = (extendable && free && new.child == tag && new.enabled).then(|| missing(&tx, p, par)).transpose()?;
            let pair = (reason == Some("duplicate") || extend.is_some()).then_some((c, par));
            changes.push(line("aside", pair, reason, extend)?);
        } else if old.aside.is_some() && new.aside.is_none() {
            changes.push(line("back", None, None, None)?);
        }
    }
    if extendable {
        changes.extend(principal_rules(&tx, &merged_before)?);
    }
    changes.sort_by_key(|c| ["moved", "aside", "principal", "back"].iter().position(|k| *k == c.kind));
    Ok(changes)
}

/// Règles allumées des principaux qui viennent de recevoir des tags fusionnés : une case « Étendre aux médias de … »
/// quand des médias de ces tags recevraient leur parent (D11.3, règle du principal ; sans la case, ils reçoivent le
/// principal seul).
fn principal_rules(db: &Connection, before: &HashSet<(i64, i64)>) -> rusqlite::Result<Vec<RuleChange>> {
    let mut fresh: HashMap<i64, Vec<i64>> = HashMap::new();
    for (tag, p) in merged(db)?.difference(before) {
        fresh.entry(*p).or_default().push(*tag);
    }
    let name = |id: i64| db.query_row("SELECT name FROM tags WHERE id = ?1", [id], |r| r.get::<_, String>(0));
    let mut out = Vec::new();
    for (p, tags) in fresh {
        let rules = db
            .prepare(
                "SELECT r.id, r.parent_id FROM tag_parents r WHERE r.child_id = ?1 AND r.enabled = 1
                   AND NOT EXISTS (SELECT 1 FROM tag_group_names n WHERE n.tag_id = r.parent_id AND n.merged = 1)",
            )?
            .query_map([p], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?)))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let list = tags.iter().map(|t| t.to_string()).collect::<Vec<_>>().join(",");
        for (id, parent) in rules {
            // Médias qui ont reçu le principal par la fusion de ces tags, sans le parent.
            let n: i64 = db.query_row(
                &format!(
                    "SELECT COUNT(DISTINCT gm.media_id) FROM tag_group_media gm JOIN tag_group_names n ON n.id = gm.name_id
                      WHERE n.tag_id IN ({list}) AND gm.had_principal = 0
                        AND NOT EXISTS (SELECT 1 FROM media_tags y WHERE y.media_id = gm.media_id AND y.tag_id = ?1)"
                ),
                [parent],
                |r| r.get(0),
            )?;
            if n > 0 {
                out.push(RuleChange {
                    id,
                    kind: "principal",
                    child: name(p)?,
                    parent: name(parent)?,
                    new_child: None,
                    new_parent: None,
                    reason: None,
                    extend: Some(n),
                    of: tags.iter().map(|&t| name(t)).collect::<rusqlite::Result<_>>()?,
                });
            }
        }
    }
    out.sort_by_key(|c| c.id);
    Ok(out)
}
