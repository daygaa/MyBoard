//! Suppression de tags (TAGM-04, TAGM-08) avec les groupes de synonymes (refonte, décision D15 bis revue le 31/10 avec
//! la décision B ; retour T3, point TAGM-15.28). Un tag fusionné est un tag : le supprimer ne rend rien à ses médias,
//! qui gardent le principal (une case, `strip`, le leur retire là où il n'est venu que par lui). Supprimer un
//! principal défait d'abord les fusions des tags qu'on garde (case « Supprimer aussi » décochée, `with_merged`) ;
//! les noms qui restent forment un groupe sans fusion, avec le plus utilisé comme principal (s'il en reste au moins
//! deux). Un tag relié quitte son groupe. Les règles de parents des tags supprimés partent avec eux.

use std::collections::HashSet;

use rusqlite::{Connection, OptionalExtension, params};
use serde::Serialize;

use crate::groups::{principal, unmerge};
use crate::tag_manager::marks;
use crate::tagging::{remove_cascade, restore_justified};

/// Un nom d'un groupe : sa ligne, son tag, son nom, fusionné ou non, et ses médias (notés à la fusion pour un
/// tag fusionné : il les retrouve s'il est défusionné).
struct Name {
    row: i64,
    tag: i64,
    name: String,
    merged: bool,
    media: i64,
}

fn names_of(db: &Connection, group: i64) -> rusqlite::Result<Vec<Name>> {
    db.prepare(
        "SELECT n.id, n.tag_id, t.name, n.merged,
                CASE WHEN n.merged THEN (SELECT COUNT(*) FROM tag_group_media m WHERE m.name_id = n.id) ELSE t.media_count END
           FROM tag_group_names n JOIN tags t ON t.id = n.tag_id WHERE n.group_id = ?1 ORDER BY t.name",
    )?
    .query_map([group], |r| Ok(Name { row: r.get(0)?, tag: r.get(1)?, name: r.get(2)?, merged: r.get(3)?, media: r.get(4)? }))?
    .collect()
}

/// Le plus utilisé des noms qui restent (à égalité, le premier par ordre alphabétique), s'il en reste au moins deux.
fn next_principal<'a>(kept: &[&'a Name]) -> Option<&'a Name> {
    if kept.len() < 2 {
        return None;
    }
    kept.iter().copied().fold(None, |best: Option<&Name>, n| match best {
        Some(b) if b.media >= n.media => Some(b),
        _ => Some(n),
    })
}

/// Groupes des tags (principal ou nom), chacun une fois, dans l'ordre des tags.
fn groups_of(db: &Connection, ids: &[i64]) -> rusqlite::Result<Vec<i64>> {
    let mut out = Vec::new();
    for &id in ids {
        let group: Option<i64> = db
            .query_row("SELECT id FROM tag_groups WHERE principal_id = ?1 UNION SELECT group_id FROM tag_group_names WHERE tag_id = ?1", [id], |r| r.get(0))
            .optional()?;
        if let Some(g) = group.filter(|g| !out.contains(g)) {
            out.push(g);
        }
    }
    Ok(out)
}

/// Médias qui n'ont reçu le principal que par ce tag fusionné : ils ne l'avaient pas avant, et aucun autre tag
/// fusionné gardé du groupe ne les note (même règle que la défusion).
fn only_through(db: &Connection, row: i64, group: i64, doomed: &HashSet<i64>) -> rusqlite::Result<Vec<i64>> {
    let mut stmt = db.prepare(
        "SELECT m.media_id, (SELECT group_concat(n.tag_id) FROM tag_group_media o JOIN tag_group_names n ON n.id = o.name_id
                              WHERE n.group_id = ?2 AND o.media_id = m.media_id AND o.name_id != ?1)
           FROM tag_group_media m WHERE m.name_id = ?1 AND m.had_principal = 0",
    )?;
    let rows = stmt.query_map(params![row, group], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, Option<String>>(1)?)))?;
    let mut out = Vec::new();
    for row in rows {
        let (media, others) = row?;
        let kept_other = others.is_some_and(|list| list.split(',').filter_map(|t| t.parse::<i64>().ok()).any(|t| !doomed.contains(&t)));
        if !kept_other {
            out.push(media);
        }
    }
    Ok(out)
}

/// Pop-in « Supprimer… » : ce qui arrivera aux groupes des tags supprimés.
#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePreview {
    /// Tags fusionnés dans un principal supprimé, eux-mêmes non supprimés : la case « Supprimer aussi ».
    pub merged: Vec<String>,
    pub principals: Vec<PrincipalFate>,
    pub fused: Vec<FusedFate>,
    pub linked: Vec<LinkedFate>,
    /// Règles de parents qui partent avec les tags supprimés.
    pub parents: i64,
}

/// Principal supprimé : les noms qui restent et leur nouveau principal, case « Supprimer aussi » décochée puis cochée.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrincipalFate {
    pub name: String,
    pub kept: Vec<String>,
    pub next: Option<String>,
    pub kept_also: Vec<String>,
    pub next_also: Option<String>,
}

/// Tag fusionné supprimé, son principal restant : ses médias notés, et ceux qui n'ont le principal que par lui.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FusedFate {
    pub name: String,
    pub principal: String,
    pub media: i64,
    pub only: i64,
}

/// Tag relié supprimé, son principal restant ; `dissolved` : le principal n'aura plus de synonyme.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkedFate {
    pub name: String,
    pub principal: String,
    pub dissolved: bool,
}

fn tag_name(db: &Connection, id: i64) -> rusqlite::Result<String> {
    db.query_row("SELECT name FROM tags WHERE id = ?1", [id], |r| r.get(0))
}

pub fn preview(db: &Connection, ids: &[i64]) -> rusqlite::Result<DeletePreview> {
    let mut out = DeletePreview::default();
    if ids.is_empty() {
        return Ok(out);
    }
    let doomed: HashSet<i64> = ids.iter().copied().collect();
    for group in groups_of(db, ids)? {
        let p = principal(db, group)?;
        let names = names_of(db, group)?;
        let kept: Vec<&Name> = names.iter().filter(|n| !doomed.contains(&n.tag)).collect();
        if doomed.contains(&p) {
            let kept_also: Vec<&Name> = kept.iter().copied().filter(|n| !n.merged).collect();
            out.merged.extend(kept.iter().filter(|n| n.merged).map(|n| n.name.clone()));
            out.principals.push(PrincipalFate {
                name: tag_name(db, p)?,
                next: next_principal(&kept).map(|n| n.name.clone()),
                kept: kept.iter().map(|n| n.name.clone()).collect(),
                next_also: next_principal(&kept_also).map(|n| n.name.clone()),
                kept_also: kept_also.iter().map(|n| n.name.clone()).collect(),
            });
            continue;
        }
        let principal_name = tag_name(db, p)?;
        for n in names.iter().filter(|n| doomed.contains(&n.tag)) {
            if n.merged {
                let only = only_through(db, n.row, group, &doomed)?.len() as i64;
                out.fused.push(FusedFate { name: n.name.clone(), principal: principal_name.clone(), media: n.media, only });
            } else {
                out.linked.push(LinkedFate { name: n.name.clone(), principal: principal_name.clone(), dissolved: kept.is_empty() });
            }
        }
    }
    let marks = marks(ids.len());
    out.parents = db.query_row(
        &format!("SELECT COUNT(*) FROM tag_parents WHERE child_id IN ({marks}) OR parent_id IN ({marks})"),
        rusqlite::params_from_iter(ids.iter().chain(ids.iter())),
        |r| r.get(0),
    )?;
    Ok(out)
}

/// Supprime les tags (transaction de l'appelant) ; renvoie le nombre supprimé. `with_merged` : les tags fusionnés
/// dans un principal supprimé partent avec lui ; `strip` : un tag fusionné supprimé retire son principal des médias
/// qui ne l'ont reçu que par lui.
pub fn delete(db: &Connection, ids: &[i64], with_merged: bool, strip: bool) -> anyhow::Result<usize> {
    if ids.is_empty() {
        return Ok(0);
    }
    let mut doomed: HashSet<i64> = ids.iter().copied().collect();
    let groups = groups_of(db, ids)?;
    if with_merged {
        for &group in &groups {
            if doomed.contains(&principal(db, group)?) {
                doomed.extend(names_of(db, group)?.iter().filter(|n| n.merged).map(|n| n.tag));
            }
        }
    }
    let mut removed = Vec::new();
    for &group in &groups {
        let p = principal(db, group)?;
        let names = names_of(db, group)?;
        if !doomed.contains(&p) {
            // Tags fusionnés supprimés, principal gardé : leurs médias le gardent, sauf avec la case.
            if strip {
                for n in names.iter().filter(|n| n.merged && doomed.contains(&n.tag)) {
                    for media in only_through(db, n.row, group, &doomed)? {
                        removed.extend(remove_cascade(db, media, p)?);
                    }
                }
            }
            continue;
        }
        // Principal supprimé : les tags fusionnés gardés retrouvent leurs médias, puis le plus utilisé des noms
        // restants prend sa place (sa ligne reçoit l'ancien principal, qui part avec sa suppression).
        for n in names.iter().filter(|n| n.merged && !doomed.contains(&n.tag)) {
            unmerge(db, n.row)?;
        }
        let kept = names_of(db, group)?;
        let kept: Vec<&Name> = kept.iter().filter(|n| !doomed.contains(&n.tag)).collect();
        match next_principal(&kept) {
            Some(next) => {
                db.execute("UPDATE tag_group_names SET tag_id = ?2, merged = 0 WHERE id = ?1", params![next.row, p])?;
                db.execute("UPDATE tag_groups SET principal_id = ?2 WHERE id = ?1", params![group, next.tag])?;
            }
            None => {
                db.execute("DELETE FROM tag_groups WHERE id = ?1", [group])?;
            }
        }
    }
    restore_justified(db, &removed)?;
    let ids: Vec<i64> = doomed.into_iter().collect();
    Ok(db.execute(&format!("DELETE FROM tags WHERE id IN ({})", marks(ids.len())), rusqlite::params_from_iter(&ids))?)
}
