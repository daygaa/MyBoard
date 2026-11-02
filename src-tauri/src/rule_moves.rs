//! Règles de parents et fusion des synonymes (retour T3, point TAGM-16.4 ; refonte, décisions D11 à D11.3 ; lot R5,
//! D-047). Pendant la fusion d'un tag dans le principal, aucun média ne peut avoir ce tag : une règle qui le cite est
//! soit **déplacée** (réécrite avec le principal, elle note d'où elle vient et revient à la défusion), soit **mise de
//! côté** (laissée telle quelle : elle ne pose rien tant que le tag est fusionné, puis remarche). Une règle dont le tag
//! est l'enfant n'est déplacée que si elle est étendue à tout le groupe (case « Étendre », D11.3, lot R5-2) : son
//! parent est alors posé aux médias du groupe, et retiré à la défusion là où le tag ne revient pas. Aperçu des
//! pop-ins : `rule_preview.rs`.

use std::collections::HashSet;

use rusqlite::{Connection, params};

use crate::parents::reaches;
use crate::tagging::{Tagger, remove_cascade};

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
pub(crate) enum Blocked {
    /// Les deux tags seraient du groupe (« kitty » → « chat » donnerait « chat » → « chat »).
    Internal,
    /// La règle réécrite existe déjà.
    Duplicate,
    Loop,
}

pub(crate) fn blocked(db: &Connection, group: i64, child: i64, parent: i64) -> rusqlite::Result<Option<Blocked>> {
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

/// Médias d'une requête dont `?1` est le tag ou le nom fusionné, et `?2` le parent qu'ils n'ont pas encore.
fn media_without(db: &Connection, sql: &str, of: i64, parent: i64) -> rusqlite::Result<Vec<i64>> {
    db.prepare(sql)?.query_map(params![of, parent], |r| r.get(0))?.collect()
}

/// Case « Étendre » cochée (D11.3, lot R5-2), une fois les médias du tag passés au principal : une règle du tag
/// déplacée sur le principal pose son parent aux médias du groupe qui ne l'ont pas (marqués : la défusion les
/// reprend) ; une règle choisie du principal pose le sien aux médias que le principal vient de recevoir par la fusion.
pub fn extend_merge(db: &Connection, name: i64, tag: i64, p: i64, extend: &dyn Fn(i64) -> bool) -> rusqlite::Result<()> {
    let tagger = Tagger::load(db)?;
    let rules = db
        .prepare(
            "SELECT r.id, r.parent_id FROM tag_parents r WHERE r.child_id = ?1 AND r.enabled = 1
               AND NOT EXISTS (SELECT 1 FROM tag_group_names n WHERE n.tag_id = r.parent_id AND n.merged = 1)",
        )?
        .query_map([p], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let moved: HashSet<i64> = db.prepare("SELECT id FROM tag_parents WHERE child_from = ?1")?.query_map([tag], |r| r.get(0))?.collect::<rusqlite::Result<_>>()?;
    for (rule, parent) in rules {
        let media = if moved.contains(&rule) {
            media_without(
                db,
                "SELECT m.media_id FROM media_tags m WHERE m.tag_id = ?1
                   AND NOT EXISTS (SELECT 1 FROM media_tags y WHERE y.media_id = m.media_id AND y.tag_id = ?2)",
                p,
                parent,
            )?
        } else if extend(rule) {
            media_without(
                db,
                "SELECT m.media_id FROM tag_group_media m WHERE m.name_id = ?1 AND m.had_principal = 0
                   AND NOT EXISTS (SELECT 1 FROM media_tags y WHERE y.media_id = m.media_id AND y.tag_id = ?2)",
                name,
                parent,
            )?
        } else {
            continue;
        };
        for m in media {
            tagger.apply_rule(db, rule, parent, m)?;
        }
    }
    Ok(())
}

/// Défusion de `tag` : les tags posés par l'extension de ses règles sont retirés partout où elle les a posés (D11.3),
/// avec leur chaîne, même sur un média qui retrouve le tag (sa règle revenue ne pose rien sans nouvel ajout, D10.2).
/// Renvoie les tags retirés en chaîne, que `restore_justified` remet si une autre règle les justifie ; ceux de
/// l'extension, non (la règle revenue les « justifierait »).
pub fn undo_extension(db: &Connection, tag: i64) -> rusqlite::Result<Vec<(i64, i64)>> {
    let pairs = db
        .prepare("SELECT DISTINCT media_id, tag_id FROM tag_parent_media WHERE extended = ?1")?
        .query_map([tag], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    db.execute("UPDATE tag_parent_media SET extended = NULL WHERE extended = ?1", [tag])?;
    let mut removed = Vec::new();
    for (media, t) in pairs {
        removed.extend(remove_cascade(db, media, t)?);
    }
    Ok(removed)
}
