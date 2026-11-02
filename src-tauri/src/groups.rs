//! Groupes de synonymes (TAGM-15, refonte TAGM-20, D-047) : des tags reliés autour d'un tag principal. Chaque nom
//! d'un groupe est un tag à part entière (décision B, retour T3, point TAGM-15.22) : relié, il garde ses médias ;
//! fusionné, ses médias lui sont retirés et reçoivent le principal, et le groupe note lesquels (et s'ils avaient
//! déjà le principal) pour défaire la fusion à l'identique (GEN-21). Fusion et défusion par nom, toujours
//! réversibles. Création et réunion de groupes : `group_create.rs` ; lecture (liste, aperçu, vérifications) :
//! `group_list.rs`. Les opérations se font dans la transaction de l'appelant ; les compteurs suivent par les
//! déclencheurs (D-005).

use std::collections::HashSet;

use rusqlite::{Connection, OptionalExtension, params};

use crate::rule_moves::{follow_merge, follow_unmerge};
use crate::tagging::{remove_cascade, restore_justified};

/// Groupe dont le tag est le principal ou un nom (relié ou fusionné).
pub fn group_of_tag(db: &Connection, tag: i64) -> rusqlite::Result<Option<i64>> {
    db.query_row("SELECT id FROM tag_groups WHERE principal_id = ?1 UNION SELECT group_id FROM tag_group_names WHERE tag_id = ?1", [tag], |r| r.get(0))
        .optional()
}

pub fn principal(db: &Connection, group: i64) -> rusqlite::Result<i64> {
    db.query_row("SELECT principal_id FROM tag_groups WHERE id = ?1", [group], |r| r.get(0))
}

/// Tag fusionné portant ce nom : (son nom dans le groupe, son groupe, le principal). Taper ce nom donne le
/// principal (D-047).
pub fn merged_name(db: &Connection, name: &str) -> rusqlite::Result<Option<(i64, i64, i64)>> {
    db.prepare_cached(
        "SELECT n.id, n.group_id, g.principal_id FROM tag_group_names n JOIN tags t ON t.id = n.tag_id JOIN tag_groups g ON g.id = n.group_id
          WHERE t.name = ?1 AND n.merged = 1",
    )?
    .query_row([name], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
    .optional()
}

pub fn tag_named(db: &Connection, name: &str) -> rusqlite::Result<Option<i64>> {
    db.prepare_cached("SELECT id FROM tags WHERE name = ?1")?.query_row([name], |r| r.get(0)).optional()
}

pub(crate) fn ids(db: &Connection, sql: &str, group: i64) -> rusqlite::Result<Vec<i64>> {
    db.prepare(sql)?.query_map([group], |r| r.get(0))?.collect()
}

pub(crate) fn add_linked(db: &Connection, group: i64, tag: i64, now: i64) -> rusqlite::Result<i64> {
    db.execute("INSERT INTO tag_group_names (group_id, tag_id, created_at) VALUES (?1, ?2, ?3)", params![group, tag, now])?;
    Ok(db.last_insert_rowid())
}

/// Fusionne un nom relié dans le principal : ses médias (et s'ils avaient déjà le principal par eux-mêmes) sont
/// notés, ses règles de parents suivent (`rule_moves.rs` : déplacées ou mises de côté, elles reviendront à la
/// défusion), ses médias reçoivent le principal et perdent ce tag, qui reste un tag, sans média.
pub fn merge(db: &Connection, name_id: i64) -> anyhow::Result<()> {
    merge_with(db, name_id, &|_| false)
}

/// `extend` : les règles dont le tag est l'enfant qui passent au principal (étendues à tout le groupe, D11.3).
pub(crate) fn merge_with(db: &Connection, name_id: i64, extend: &dyn Fn(i64) -> bool) -> anyhow::Result<()> {
    let row: Option<(i64, i64)> = db
        .query_row("SELECT group_id, tag_id FROM tag_group_names WHERE id = ?1 AND merged = 0", [name_id], |r| Ok((r.get(0)?, r.get(1)?)))
        .optional()?;
    let Some((group, tag)) = row else { return Ok(()) };
    let p = principal(db, group)?;
    // « Avait déjà le principal » : par lui-même, pas seulement par un autre tag fusionné du groupe.
    db.execute(
        "INSERT INTO tag_group_media (name_id, media_id, had_principal)
         SELECT ?1, s.media_id,
                EXISTS (SELECT 1 FROM media_tags t WHERE t.media_id = s.media_id AND t.tag_id = ?3)
                AND NOT EXISTS (SELECT 1 FROM tag_group_media o JOIN tag_group_names n ON n.id = o.name_id
                                 WHERE n.group_id = ?4 AND o.media_id = s.media_id AND o.had_principal = 0)
           FROM media_tags s WHERE s.tag_id = ?2",
        params![name_id, tag, p, group],
    )?;
    db.execute("UPDATE tag_group_names SET merged = 1 WHERE id = ?1", [name_id])?;
    follow_merge(db, name_id, tag, p, group, extend)?;
    // Le principal seul, sans ses parents : ses règles ne s'étendent pas aux médias du tag (case « Étendre »
    // décochée, D11.3, lot R5).
    db.execute("INSERT OR IGNORE INTO media_tags (media_id, tag_id) SELECT media_id, ?2 FROM media_tags WHERE tag_id = ?1", params![tag, p])?;
    db.execute("DELETE FROM media_tags WHERE tag_id = ?1", [tag])?;
    Ok(())
}

/// Défait la fusion d'un nom : ses règles reviennent, le tag est rendu à ses médias ; le principal est retiré de
/// ceux qui ne l'avaient pas avant et qu'aucun autre tag fusionné du groupe ne note, avec ce qu'il leur avait
/// apporté en chaîne. Renvoie les règles qui n'ont pas pu revenir (elles feraient une boucle).
pub fn unmerge(db: &Connection, name_id: i64) -> anyhow::Result<Vec<i64>> {
    let row: Option<(i64, i64)> = db
        .query_row("SELECT group_id, tag_id FROM tag_group_names WHERE id = ?1 AND merged = 1", [name_id], |r| Ok((r.get(0)?, r.get(1)?)))
        .optional()?;
    let Some((group, tag)) = row else { return Ok(Vec::new()) };
    let p = principal(db, group)?;
    let listed = db
        .prepare("SELECT media_id, had_principal FROM tag_group_media WHERE name_id = ?1")?
        .query_map([name_id], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, bool>(1)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    db.execute("DELETE FROM tag_group_media WHERE name_id = ?1", [name_id])?;
    db.execute("UPDATE tag_group_names SET merged = 0 WHERE id = ?1", [name_id])?;
    let stayed = follow_unmerge(db, tag, p)?;
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
    Ok(stayed)
}

/// Interrupteur de fusion d'un nom ; renvoie les règles restées sur le principal (défusion).
pub fn set_merged(db: &Connection, name_id: i64, merged: bool) -> anyhow::Result<Vec<i64>> {
    if merged { merge(db, name_id).map(|_| Vec::new()) } else { unmerge(db, name_id) }
}

/// Défait toutes les fusions du groupe ; renvoie les règles restées sur le principal.
fn unmerge_all(db: &Connection, group: i64) -> anyhow::Result<Vec<i64>> {
    let mut stayed = Vec::new();
    for id in ids(db, "SELECT id FROM tag_group_names WHERE group_id = ?1 AND merged = 1", group)? {
        stayed.extend(unmerge(db, id)?);
    }
    Ok(stayed)
}

/// Interrupteur du groupe : fusionne tous ses noms reliés, ou défait toutes ses fusions.
pub fn set_group_merged(db: &Connection, group: i64, merged: bool) -> anyhow::Result<Vec<i64>> {
    if !merged {
        return unmerge_all(db, group);
    }
    for id in ids(db, "SELECT id FROM tag_group_names WHERE group_id = ?1 AND merged = 0", group)? {
        merge(db, id)?;
    }
    Ok(Vec::new())
}

/// Retire un nom du groupe : fusionné, ses médias le récupèrent d'abord ; le tag reste. Le dernier nom retiré
/// emporte le groupe (déclencheur).
pub fn remove_name(db: &Connection, name_id: i64) -> anyhow::Result<Vec<i64>> {
    let stayed = unmerge(db, name_id)?;
    db.execute("DELETE FROM tag_group_names WHERE id = ?1", [name_id])?;
    Ok(stayed)
}

/// Supprime le groupe : les fusions sont défaites, les noms ne sont plus reliés ; les tags restent.
pub fn delete_group(db: &Connection, group: i64) -> anyhow::Result<Vec<i64>> {
    let stayed = unmerge_all(db, group)?;
    db.execute("DELETE FROM tag_groups WHERE id = ?1", [group])?;
    Ok(stayed)
}

/// Change le principal (refonte, décision D3.1) : toutes les fusions sont défaites (chaque tag retrouve ses
/// médias d'origine, ses règles reviennent), puis refaites vers le nouveau principal ; l'ancien principal prend
/// l'état qu'avait le nouveau (fusionné ou relié). Règles (réponse 5b du lot R5) : celles de l'ancien principal
/// passent au nouveau sans rien demander (elles valaient déjà pour tout le groupe) ; une règle étendue le reste.
pub fn set_principal(db: &Connection, group: i64, name_id: i64) -> anyhow::Result<()> {
    let old = principal(db, group)?;
    let was_merged: bool = db.query_row("SELECT merged FROM tag_group_names WHERE id = ?1 AND group_id = ?2", params![name_id, group], |r| r.get(0))?;
    let extended: HashSet<i64> = ids(db, "SELECT id FROM tag_parents WHERE child_from IN (SELECT tag_id FROM tag_group_names WHERE group_id = ?1)", group)?.into_iter().collect();
    // Tous, même sans média : leurs règles déplacées citent l'ancien principal.
    let mut merged = Vec::new();
    for id in ids(db, "SELECT id FROM tag_group_names WHERE group_id = ?1 AND merged = 1", group)? {
        unmerge(db, id)?;
        if id != name_id {
            merged.push(id);
        }
    }
    let new: i64 = db.query_row("SELECT tag_id FROM tag_group_names WHERE id = ?1", [name_id], |r| r.get(0))?;
    db.execute("UPDATE tag_group_names SET tag_id = ?2 WHERE id = ?1", params![name_id, old])?;
    db.execute("UPDATE tag_groups SET principal_id = ?2 WHERE id = ?1", params![group, new])?;
    for id in merged {
        merge_with(db, id, &|rule| extended.contains(&rule))?;
    }
    if was_merged {
        merge_with(db, name_id, &|_| true)?;
    }
    Ok(())
}
