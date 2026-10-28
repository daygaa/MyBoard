//! Groupes de synonymes (TAGM-15, refonte TAGM-20, D-047) : des noms reliés autour d'un tag principal. Un nom
//! relié est un vrai tag, à part ; un nom fusionné n'est plus un tag : ses médias portent le principal, et le
//! groupe garde ce qu'il faut pour défaire la fusion à l'identique (ses médias, s'ils avaient déjà le principal,
//! sa catégorie, sa description, son état masqué ; GEN-21). Fusion et défusion par nom, toujours réversibles.
//! Création et réunion de groupes : `group_create.rs` ; lecture (liste, aperçu, vérifications) : `group_list.rs`. Les opérations se font dans la transaction de
//! l'appelant ; les compteurs suivent par les déclencheurs (D-005).

use rusqlite::{Connection, OptionalExtension, params};

use crate::parents::move_rules;
use crate::tagging::{Target, Tagger, remove_cascade, restore_justified};
use crate::tags::DEFAULT_CATEGORY;

/// Groupe dont le tag est le principal ou un nom relié.
pub fn group_of_tag(db: &Connection, tag: i64) -> rusqlite::Result<Option<i64>> {
    db.query_row("SELECT id FROM tag_groups WHERE principal_id = ?1 UNION SELECT group_id FROM tag_group_names WHERE tag_id = ?1", [tag], |r| r.get(0))
        .optional()
}

pub fn principal(db: &Connection, group: i64) -> rusqlite::Result<i64> {
    db.query_row("SELECT principal_id FROM tag_groups WHERE id = ?1", [group], |r| r.get(0))
}

/// Nom fusionné de ce nom : (son identifiant, son groupe, le principal).
pub fn merged_name(db: &Connection, name: &str) -> rusqlite::Result<Option<(i64, i64, i64)>> {
    db.prepare_cached("SELECT n.id, n.group_id, g.principal_id FROM tag_group_names n JOIN tag_groups g ON g.id = n.group_id WHERE n.name = ?1")?
        .query_row([name], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
        .optional()
}

pub fn tag_named(db: &Connection, name: &str) -> rusqlite::Result<Option<i64>> {
    db.prepare_cached("SELECT id FROM tags WHERE name = ?1")?.query_row([name], |r| r.get(0)).optional()
}

/// Médias notés sous un nom fusionné.
pub(crate) fn listed(db: &Connection, name_id: i64) -> rusqlite::Result<i64> {
    db.query_row("SELECT COUNT(*) FROM tag_group_media WHERE name_id = ?1", [name_id], |r| r.get(0))
}

pub(crate) fn ids(db: &Connection, sql: &str, group: i64) -> rusqlite::Result<Vec<i64>> {
    db.prepare(sql)?.query_map([group], |r| r.get(0))?.collect()
}

pub(crate) fn add_linked(db: &Connection, group: i64, tag: i64, now: i64) -> rusqlite::Result<i64> {
    db.execute("INSERT INTO tag_group_names (group_id, tag_id, created_at) VALUES (?1, ?2, ?3)", params![group, tag, now])?;
    Ok(db.last_insert_rowid())
}

/// Nom tapé qui n'est pas un tag : nom fusionné, sans média (refonte, décision D4.1).
pub fn add_pure(db: &Connection, group: i64, name: &str, now: i64) -> rusqlite::Result<i64> {
    db.execute("INSERT INTO tag_group_names (group_id, name, created_at) VALUES (?1, ?2, ?3)", params![group, name, now])?;
    Ok(db.last_insert_rowid())
}

/// Fusionne un nom relié dans le principal : ses médias (et ceux qui avaient déjà le principal par eux-mêmes)
/// sont notés, ses réglages gardés, ses règles de parents passent au principal (le retour viendra au lot R5),
/// ses médias reçoivent le principal (avec ses parents), puis le tag est supprimé.
pub fn merge(db: &Connection, name_id: i64) -> anyhow::Result<()> {
    let row: Option<(i64, i64)> = db
        .query_row("SELECT group_id, tag_id FROM tag_group_names WHERE id = ?1 AND tag_id IS NOT NULL", [name_id], |r| Ok((r.get(0)?, r.get(1)?)))
        .optional()?;
    let Some((group, tag)) = row else { return Ok(()) };
    let p = principal(db, group)?;
    // « Avait déjà le principal » : par lui-même, pas seulement par un autre nom fusionné du groupe.
    db.execute(
        "INSERT INTO tag_group_media (name_id, media_id, had_principal)
         SELECT ?1, s.media_id,
                EXISTS (SELECT 1 FROM media_tags t WHERE t.media_id = s.media_id AND t.tag_id = ?3)
                AND NOT EXISTS (SELECT 1 FROM tag_group_media o JOIN tag_group_names n ON n.id = o.name_id
                                 WHERE n.group_id = ?4 AND o.media_id = s.media_id AND o.had_principal = 0)
           FROM media_tags s WHERE s.tag_id = ?2",
        params![name_id, tag, p, group],
    )?;
    // Le nom devient fusionné AVANT la suppression du tag (sinon la ligne partirait avec lui).
    db.execute(
        "UPDATE tag_group_names SET (name, category_id, description, hidden, tag_created_at, tag_id) =
           (SELECT name, category_id, description, hidden, created_at, NULL FROM tags WHERE id = ?2)
         WHERE id = ?1",
        params![name_id, tag],
    )?;
    db.execute("UPDATE tags SET description = (SELECT description FROM tags WHERE id = ?1) WHERE id = ?2 AND description IS NULL", params![tag, p])?;
    move_rules(db, tag, p)?;
    let tagger = Tagger::load(db)?;
    let media = db.prepare("SELECT media_id FROM media_tags WHERE tag_id = ?1")?.query_map([tag], |r| r.get::<_, i64>(0))?.collect::<rusqlite::Result<Vec<_>>>()?;
    for m in media {
        tagger.attach(db, m, Target { tag_id: p, name_id: None })?;
    }
    db.execute("DELETE FROM tags WHERE id = ?1", [tag])?;
    Ok(())
}

/// Défait la fusion d'un nom : le tag est recréé à l'identique sur ses médias ; le principal est retiré de ceux
/// qui ne l'avaient pas avant et qu'aucun autre nom fusionné du groupe ne note, avec ce qu'il leur avait apporté
/// en chaîne. Renvoie le tag recréé.
pub fn unmerge(db: &Connection, name_id: i64) -> anyhow::Result<Option<i64>> {
    type Row = (i64, String, Option<i64>, Option<String>, bool, Option<i64>);
    let row: Option<Row> = db
        .query_row(
            "SELECT group_id, name, category_id, description, hidden, tag_created_at FROM tag_group_names WHERE id = ?1 AND tag_id IS NULL",
            [name_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)),
        )
        .optional()?;
    let Some((group, name, category, description, hidden, created)) = row else { return Ok(None) };
    let p = principal(db, group)?;
    let tag = match tag_named(db, &name)? {
        Some(tag) => tag,
        None => {
            let category: i64 = db.query_row(
                "SELECT COALESCE((SELECT id FROM tag_categories WHERE id = ?1), (SELECT id FROM tag_categories WHERE key = ?2))",
                params![category, DEFAULT_CATEGORY],
                |r| r.get(0),
            )?;
            db.execute(
                "INSERT INTO tags (name, category_id, hidden, created_at, description) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![name, category, hidden, created.unwrap_or_else(crate::db::now_ms), description],
            )?;
            db.last_insert_rowid()
        }
    };
    let listed = db
        .prepare("SELECT media_id, had_principal FROM tag_group_media WHERE name_id = ?1")?
        .query_map([name_id], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, bool>(1)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    db.execute("DELETE FROM tag_group_media WHERE name_id = ?1", [name_id])?;
    db.execute(
        "UPDATE tag_group_names SET tag_id = ?2, name = NULL, category_id = NULL, description = NULL, hidden = 0, tag_created_at = NULL WHERE id = ?1",
        params![name_id, tag],
    )?;
    let mut removed = Vec::new();
    for (media, had) in listed {
        db.prepare_cached("INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?1, ?2)")?.execute(params![media, tag])?;
        let still: bool = db
            .prepare_cached(
                "SELECT EXISTS (SELECT 1 FROM tag_group_media o JOIN tag_group_names n ON n.id = o.name_id WHERE n.group_id = ?1 AND o.media_id = ?2)",
            )?
            .query_row(params![group, media], |r| r.get(0))?;
        if !had && !still {
            removed.extend(remove_cascade(db, media, p)?);
        }
    }
    restore_justified(db, &removed)?;
    Ok(Some(tag))
}

/// Interrupteur de fusion d'un nom.
pub fn set_merged(db: &Connection, name_id: i64, merged: bool) -> anyhow::Result<()> {
    if merged { merge(db, name_id) } else { unmerge(db, name_id).map(|_| ()) }
}

/// Interrupteur du groupe : fusionne tous ses noms reliés, ou défait toutes ses fusions.
pub fn set_group_merged(db: &Connection, group: i64, merged: bool) -> anyhow::Result<()> {
    if merged {
        for id in ids(db, "SELECT id FROM tag_group_names WHERE group_id = ?1 AND tag_id IS NOT NULL", group)? {
            merge(db, id)?;
        }
    } else {
        for id in ids(db, "SELECT id FROM tag_group_names WHERE group_id = ?1 AND tag_id IS NULL", group)? {
            unmerge(db, id)?;
        }
    }
    Ok(())
}

/// Retire un nom du groupe : fusionné, ses médias le récupèrent d'abord (un nom sans média disparaît
/// simplement). Le dernier nom retiré emporte le groupe (déclencheur).
pub fn remove_name(db: &Connection, name_id: i64) -> anyhow::Result<()> {
    if listed(db, name_id)? > 0 {
        unmerge(db, name_id)?;
    }
    db.execute("DELETE FROM tag_group_names WHERE id = ?1", [name_id])?;
    Ok(())
}

/// Supprime le groupe : les fusions sont défaites, les noms ne sont plus reliés ; les tags restent.
pub fn delete_group(db: &Connection, group: i64) -> anyhow::Result<()> {
    for id in ids(db, "SELECT id FROM tag_group_names WHERE group_id = ?1 AND tag_id IS NULL", group)? {
        if listed(db, id)? > 0 {
            unmerge(db, id)?;
        }
    }
    db.execute("DELETE FROM tag_groups WHERE id = ?1", [group])?;
    Ok(())
}

/// Change le principal (refonte, décision D3.1) : toutes les fusions sont défaites (chaque nom retrouve ses
/// médias d'origine), puis refaites vers le nouveau principal ; l'ancien principal prend l'état qu'avait le
/// nouveau (fusionné ou relié). Les noms fusionnés sans média suivent tels quels.
pub fn set_principal(db: &Connection, group: i64, name_id: i64) -> anyhow::Result<()> {
    let old = principal(db, group)?;
    let was_merged: bool = db.query_row("SELECT tag_id IS NULL FROM tag_group_names WHERE id = ?1 AND group_id = ?2", params![name_id, group], |r| r.get(0))?;
    let mut merged = Vec::new();
    for id in ids(db, "SELECT id FROM tag_group_names WHERE group_id = ?1 AND tag_id IS NULL", group)? {
        if id == name_id || listed(db, id)? > 0 {
            unmerge(db, id)?;
            if id != name_id {
                merged.push(id);
            }
        }
    }
    let new: i64 = db.query_row("SELECT tag_id FROM tag_group_names WHERE id = ?1", [name_id], |r| r.get(0))?;
    db.execute("UPDATE tag_group_names SET tag_id = ?2 WHERE id = ?1", params![name_id, old])?;
    db.execute("UPDATE tag_groups SET principal_id = ?2 WHERE id = ?1", params![group, new])?;
    for id in merged {
        merge(db, id)?;
    }
    if was_merged {
        merge(db, name_id)?;
    }
    Ok(())
}
