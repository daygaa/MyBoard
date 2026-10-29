//! Création et réunion de groupes de synonymes (refonte TAGM-20, D-047) : formulaire « Tag principal » +
//! « Synonymes » (D2.2, D3, D4, D4.1, D14) et fusions du gestionnaire (revues au lot R6). Les opérations de base
//! (fusion, défusion, principal) : `groups.rs`. Dans la transaction de l'appelant.

use rusqlite::{Connection, OptionalExtension, params};

use crate::groups::{add_linked, add_pure, group_of_tag, ids, listed, merge, merged_name, principal, tag_named, unmerge};
use crate::tags::normalize;

/// Un nom tapé : un tag, un nom fusionné (son groupe), ou un nom libre.
enum Ref {
    Tag(i64),
    Merged(i64),
    New(String),
}

fn reference(db: &Connection, raw: &str) -> rusqlite::Result<Option<Ref>> {
    let Some(name) = normalize(raw) else { return Ok(None) };
    if let Some(tag) = tag_named(db, &name)? {
        return Ok(Some(Ref::Tag(tag)));
    }
    Ok(Some(match merged_name(db, &name)? {
        Some((_, group, _)) => Ref::Merged(group),
        None => Ref::New(name),
    }))
}

/// Réunit le groupe `other` au groupe `group` (refonte, décision D14) : ses fusions sont défaites (sauf les noms
/// sans média, qui suivent tels quels), ses noms et son principal deviennent des noms de `group`. Renvoie les
/// noms reliés ajoutés (ils prendront l'état de l'interrupteur, D2.2).
fn absorb(db: &Connection, group: i64, other: i64, now: i64) -> anyhow::Result<Vec<i64>> {
    let p = principal(db, other)?;
    for id in ids(db, "SELECT id FROM tag_group_names WHERE group_id = ?1 AND tag_id IS NULL", other)? {
        if listed(db, id)? > 0 {
            unmerge(db, id)?;
        }
    }
    let mut added = ids(db, "SELECT id FROM tag_group_names WHERE group_id = ?1 AND tag_id IS NOT NULL", other)?;
    db.execute("UPDATE tag_group_names SET group_id = ?1 WHERE group_id = ?2", params![group, other])?;
    db.execute("DELETE FROM tag_groups WHERE id = ?1", [other])?;
    added.push(add_linked(db, group, p, now)?);
    Ok(added)
}

/// Crée ou complète le groupe de `principal` avec ces noms (formulaire « Tag principal » + « Synonymes »). Un
/// principal tapé qui est déjà dans un groupe y ajoute les noms ; un nom d'un autre groupe réunit les deux (D14) ;
/// un nom qui n'est pas un tag devient un nom fusionné sans média (D4.1) ; avec `merge`, les noms ajoutés sont
/// fusionnés.
pub fn create(db: &Connection, principal_tag: i64, names: &[String], merge_new: bool, now: i64) -> anyhow::Result<i64> {
    // Principal tapé qui est un nom relié d'un groupe : les noms rejoignent ce groupe, son principal ne
    // change pas (retouches de R3, 29/10 ; changer de principal se fait avec l'étoile, D3).
    let group = match group_of_tag(db, principal_tag)? {
        Some(g) => g,
        None => {
            db.execute("INSERT INTO tag_groups (principal_id, created_at) VALUES (?1, ?2)", params![principal_tag, now])?;
            db.last_insert_rowid()
        }
    };
    let mut added = Vec::new();
    for raw in names {
        match reference(db, raw)? {
            None => {}
            Some(Ref::Tag(t)) if t == principal_tag => {}
            Some(Ref::Tag(t)) => match group_of_tag(db, t)? {
                Some(k) if k == group => {}
                Some(k) => added.extend(absorb(db, group, k, now)?),
                None => added.push(add_linked(db, group, t, now)?),
            },
            Some(Ref::Merged(k)) if k == group => {}
            Some(Ref::Merged(k)) => added.extend(absorb(db, group, k, now)?),
            Some(Ref::New(name)) => {
                add_pure(db, group, &name, now)?;
            }
        }
    }
    if merge_new {
        for id in added {
            merge(db, id)?;
        }
    }
    // Aucun nom ajouté à un groupe tout neuf : il ne reste pas vide.
    db.execute("DELETE FROM tag_groups WHERE id = ?1 AND NOT EXISTS (SELECT 1 FROM tag_group_names WHERE group_id = ?1)", [group])?;
    Ok(group)
}

/// Fusion du gestionnaire (TAGM-04, TAGM-11, TAGM-13 ; revue au lot R6) : `source` rejoint le groupe de
/// `target`, fusionné ; sans `keep` (case « Garder les anciens noms » décochée), son nom est ensuite oublié.
pub fn merge_tag(db: &Connection, source: i64, target: i64, keep: bool, now: i64) -> anyhow::Result<()> {
    if source == target {
        return Ok(());
    }
    let name: String = db.query_row("SELECT name FROM tags WHERE id = ?1", [source], |r| r.get(0))?;
    create(db, target, std::slice::from_ref(&name), true, now)?;
    // Déjà relié au groupe : `create` le laisse tel quel, la fusion demandée le fusionne.
    let row: Option<i64> = db.query_row("SELECT id FROM tag_group_names WHERE tag_id = ?1", [source], |r| r.get(0)).optional()?;
    if let Some(row) = row {
        merge(db, row)?;
    }
    if !keep {
        db.execute("DELETE FROM tag_group_names WHERE name = ?1", [&name])?;
    }
    Ok(())
}
