//! Lecture des groupes de synonymes (refonte TAGM-20, D-047) : liste de l'onglet « Synonymes et parents » et
//! des colonnes du gestionnaire, aperçu du formulaire de création (sans rien écrire), médias concernés par un
//! changement de principal. Les opérations : `groups.rs`.

use std::collections::HashMap;

use rusqlite::{Connection, params};
use serde::Serialize;

use crate::groups::{group_of_tag, merged_name, principal, tag_named};
use crate::tags::normalize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NameRow {
    pub id: i64,
    /// Tag du nom relié ; `None` : nom fusionné.
    pub tag_id: Option<i64>,
    pub name: String,
    pub merged: bool,
    /// Médias du tag (relié) ou médias notés (fusionné).
    pub media: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupRow {
    pub id: i64,
    pub principal_id: i64,
    /// Nom du principal, lu avec le groupe : l'affichage n'attend pas la relecture de la liste des tags (après
    /// un changement de principal, la ligne affichait « ? » un instant, retouches de R3).
    pub principal_name: String,
    /// Médias que trouve la recherche d'un nom du groupe.
    pub media: i64,
    pub names: Vec<NameRow>,
    pub created_at: i64,
}

pub fn list(db: &Connection) -> rusqlite::Result<Vec<GroupRow>> {
    let mut names: HashMap<i64, Vec<NameRow>> = HashMap::new();
    let mut stmt = db.prepare(
        "SELECT n.group_id, n.id, n.tag_id, COALESCE(n.name, t.name), n.tag_id IS NULL,
                CASE WHEN n.tag_id IS NULL THEN (SELECT COUNT(*) FROM tag_group_media m WHERE m.name_id = n.id) ELSE t.media_count END
           FROM tag_group_names n LEFT JOIN tags t ON t.id = n.tag_id ORDER BY 4",
    )?;
    for row in stmt.query_map([], |r| Ok((r.get::<_, i64>(0)?, NameRow { id: r.get(1)?, tag_id: r.get(2)?, name: r.get(3)?, merged: r.get(4)?, media: r.get(5)? })))? {
        let (group, name) = row?;
        names.entry(group).or_default().push(name);
    }
    // Médias du groupe : ceux du principal (les médias fusionnés le portent), plus ceux des noms reliés.
    let mut stmt = db.prepare(
        "SELECT g.id, g.principal_id, g.created_at,
                CASE WHEN EXISTS (SELECT 1 FROM tag_group_names n WHERE n.group_id = g.id AND n.tag_id IS NOT NULL)
                     THEN (SELECT COUNT(DISTINCT mt.media_id) FROM media_tags mt
                            WHERE mt.tag_id IN (SELECT g.principal_id UNION SELECT tag_id FROM tag_group_names WHERE group_id = g.id AND tag_id IS NOT NULL))
                     ELSE (SELECT media_count FROM tags WHERE id = g.principal_id) END,
                (SELECT name FROM tags WHERE id = g.principal_id)
           FROM tag_groups g",
    )?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, i64>(1)?, r.get::<_, i64>(2)?, r.get::<_, i64>(3)?, r.get::<_, String>(4)?)))?;
    let mut out = Vec::new();
    for row in rows {
        let (id, principal_id, created_at, media, principal_name) = row?;
        out.push(GroupRow { id, principal_id, principal_name, media, names: names.remove(&id).unwrap_or_default(), created_at });
    }
    Ok(out)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewName {
    pub name: String,
    pub merged: bool,
    pub media: i64,
}

/// Ce que donnerait le formulaire de création, sans rien écrire.
#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
    /// Principal après résolution (un nom fusionné tapé donne son principal) ; `None` : champ vide.
    pub principal: Option<String>,
    /// Le principal n'est pas encore un tag : « Créer un nouveau tag » à la validation.
    pub new_principal: bool,
    /// Tag tapé en principal qui est un nom relié d'un groupe : il le reste, `principal` est alors celui
    /// de son groupe.
    pub member: Option<String>,
    /// Noms déjà dans le groupe du principal, avec leur état.
    pub existing: Vec<PreviewName>,
    /// Noms ajoutés : ils prendront l'état de l'interrupteur (D2.2).
    pub added: Vec<PreviewName>,
    /// Noms qui ne sont pas des tags : noms fusionnés sans média (D4.1), et ceux d'un groupe réuni.
    pub pure: Vec<String>,
    /// Principaux des autres groupes réunis (D14).
    pub joined: Vec<String>,
    /// Groupe du principal entièrement fusionné : l'interrupteur est allumé d'office (D2.2, D8.1).
    pub fully_merged: bool,
}

fn tag_name(db: &Connection, tag: i64) -> rusqlite::Result<(String, i64)> {
    db.query_row("SELECT name, media_count FROM tags WHERE id = ?1", [tag], |r| Ok((r.get(0)?, r.get(1)?)))
}

/// Noms d'un groupe (hors principal), avec leur état et leurs médias.
fn members(db: &Connection, group: i64) -> rusqlite::Result<Vec<(Option<i64>, PreviewName)>> {
    db.prepare(
        "SELECT n.tag_id, COALESCE(n.name, t.name), n.tag_id IS NULL,
                CASE WHEN n.tag_id IS NULL THEN (SELECT COUNT(*) FROM tag_group_media m WHERE m.name_id = n.id) ELSE t.media_count END
           FROM tag_group_names n LEFT JOIN tags t ON t.id = n.tag_id WHERE n.group_id = ?1 ORDER BY 2",
    )?
    .query_map([group], |r| Ok((r.get(0)?, PreviewName { name: r.get(1)?, merged: r.get(2)?, media: r.get(3)? })))?
    .collect()
}

pub fn preview(db: &Connection, principal_text: &str, names: &[String]) -> rusqlite::Result<Preview> {
    let mut out = Preview::default();
    let Some(typed) = normalize(principal_text) else { return Ok(out) };
    let p = match tag_named(db, &typed)? {
        Some(tag) => Some(tag),
        None => merged_name(db, &typed)?.map(|(_, _, p)| p),
    };
    let group = match p {
        Some(tag) => group_of_tag(db, tag)?,
        None => None,
    };
    out.principal = Some(match p {
        Some(tag) => tag_name(db, tag)?.0,
        None => typed.clone(),
    });
    out.new_principal = p.is_none();
    if let (Some(tag), Some(g)) = (p, group) {
        // Tag tapé qui est un nom relié d'un groupe : il le reste, et les noms rejoignent ce groupe, dont le
        // principal ne change pas (retouches de R3, 29/10).
        let real = principal(db, g)?;
        if real != tag {
            out.member = out.principal.take();
            out.principal = Some(tag_name(db, real)?.0);
        }
        out.existing.extend(members(db, g)?.into_iter().map(|(_, name)| name));
        out.fully_merged = !out.existing.is_empty() && out.existing.iter().all(|n| n.merged);
    }
    let mut seen: Vec<String> = out.principal.iter().cloned().collect();
    seen.extend(out.existing.iter().map(|n| n.name.clone()));
    for raw in names {
        let Some(name) = normalize(raw) else { continue };
        if seen.contains(&name) {
            continue;
        }
        // Un tag ou un nom fusionné d'un autre groupe : tout ce groupe est réuni.
        let other = match tag_named(db, &name)? {
            Some(tag) => group_of_tag(db, tag)?.map(Ok).unwrap_or(Err(tag)),
            None => match merged_name(db, &name)? {
                Some((_, k, _)) => Ok(k),
                None => {
                    seen.push(name.clone());
                    out.pure.push(name);
                    continue;
                }
            },
        };
        match other {
            Err(tag) => {
                let (name, media) = tag_name(db, tag)?;
                seen.push(name.clone());
                out.added.push(PreviewName { name, merged: false, media });
            }
            Ok(k) if Some(k) == group => {}
            Ok(k) => {
                let (pk, media) = tag_name(db, principal(db, k)?)?;
                out.joined.push(pk.clone());
                seen.push(pk.clone());
                out.added.push(PreviewName { name: pk, merged: false, media });
                for (_, n) in members(db, k)? {
                    seen.push(n.name.clone());
                    if n.merged && n.media == 0 {
                        out.pure.push(n.name);
                    } else {
                        out.added.push(PreviewName { merged: false, ..n });
                    }
                }
            }
        }
    }
    Ok(out)
}

/// Changement de principal (D3.1) : médias qui passeront de l'ancien au nouveau principal (ceux des noms
/// fusionnés, et tous ceux de l'ancien principal si le nouveau était fusionné).
pub fn principal_check(db: &Connection, group: i64, name_id: i64) -> rusqlite::Result<i64> {
    let was_merged: bool = db.query_row("SELECT tag_id IS NULL FROM tag_group_names WHERE id = ?1", [name_id], |r| r.get(0))?;
    if was_merged {
        return db.query_row("SELECT media_count FROM tags WHERE id = ?1", [principal(db, group)?], |r| r.get(0));
    }
    db.query_row(
        "SELECT COUNT(DISTINCT m.media_id) FROM tag_group_media m JOIN tag_group_names n ON n.id = m.name_id WHERE n.group_id = ?1",
        params![group],
        |r| r.get(0),
    )
}
