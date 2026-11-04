//! Création et réunion de groupes de synonymes (refonte TAGM-20, D-047) : formulaire « Tag principal » +
//! « Synonymes » (D2.2, D3, D4, D14) et fusions du gestionnaire (revues au lot R6). Les opérations de base
//! (fusion, défusion, principal) : `groups.rs`. Dans la transaction de l'appelant.

use rusqlite::{Connection, OptionalExtension, params};

use crate::groups::{add_linked, group_of_tag, ids, merge, principal, set_principal, tag_named, unmerge};
use crate::tagging::resolve_or_create;
use crate::tags::{NewTag, normalize};

/// Un nom tapé : un tag (relié, fusionné ou libre), ou un nom qui n'en est pas encore un.
enum Ref {
    Tag(i64),
    New(String),
}

fn reference(db: &Connection, raw: &str) -> rusqlite::Result<Option<Ref>> {
    let Some(name) = normalize(raw) else { return Ok(None) };
    Ok(Some(match tag_named(db, &name)? {
        Some(tag) => Ref::Tag(tag),
        None => Ref::New(name),
    }))
}

/// Réunit le groupe `other` au groupe `group` (refonte, décision D14) : ses fusions sont défaites, ses noms et
/// son principal deviennent des noms de `group`. Renvoie les noms ajoutés (ils prendront l'état de
/// l'interrupteur, D2.2).
pub(crate) fn absorb(db: &Connection, group: i64, other: i64, now: i64) -> anyhow::Result<Vec<i64>> {
    let p = principal(db, other)?;
    for id in ids(db, "SELECT id FROM tag_group_names WHERE group_id = ?1 AND merged = 1", other)? {
        unmerge(db, id)?;
    }
    let mut added = ids(db, "SELECT id FROM tag_group_names WHERE group_id = ?1", other)?;
    db.execute("UPDATE tag_group_names SET group_id = ?1 WHERE group_id = ?2", params![group, other])?;
    db.execute("DELETE FROM tag_groups WHERE id = ?1", [other])?;
    added.push(add_linked(db, group, p, now)?);
    Ok(added)
}

/// Tags cochés du gestionnaire (retour T3, point TAGM-11.4, retouche du 03/11) : le tag choisi qui est un nom d'un
/// groupe en devient d'abord le principal, comme avec l'étoile (D3.1 : fusions refaites vers lui, l'ancien principal
/// prend son état) ; `create` y ajoute ensuite les autres.
pub fn promote(db: &Connection, tag: i64) -> anyhow::Result<()> {
    let row: Option<(i64, i64)> = db.query_row("SELECT id, group_id FROM tag_group_names WHERE tag_id = ?1", [tag], |r| Ok((r.get(0)?, r.get(1)?))).optional()?;
    match row {
        Some((name, group)) => set_principal(db, group, name),
        None => Ok(()),
    }
}

/// Crée ou complète le groupe de `principal` avec ces noms (formulaire « Tag principal » + « Synonymes »). Un
/// principal tapé qui est déjà dans un groupe y ajoute les noms ; un nom d'un autre groupe réunit les deux (D14) ;
/// un nom qui n'est pas encore un tag devient un tag (catégorie par défaut ; le formulaire le crée d'abord par la
/// pop-in « Créer un nouveau tag ») ; avec `merge`, les noms ajoutés sont fusionnés (`extend` : règles cochées
/// « Étendre », D11.3).
pub fn create(db: &Connection, principal_tag: i64, names: &[String], merge_new: bool, new_tags: &[NewTag], extend: &[i64], now: i64) -> anyhow::Result<i64> {
    // Principal tapé qui est un nom relié d'un groupe : les noms rejoignent ce groupe, son principal ne
    // change pas (retouches de R3, 29/10 ; changer de principal se fait avec l'étoile, D3, ou `promote` d'abord).
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
            Some(Ref::New(name)) => {
                // Catégorie choisie dans la pop-in « Créer un nouveau tag » : le tag n'est créé qu'ici, avec le groupe.
                let category_id = new_tags.iter().find(|t| normalize(&t.name).as_deref() == Some(name.as_str())).and_then(|t| t.category_id);
                if let Some(t) = resolve_or_create(db, &NewTag { name, category_id }, now)? {
                    added.push(add_linked(db, group, t.tag_id, now)?);
                }
            }
        }
    }
    if merge_new {
        for id in added {
            merge(db, id, extend)?;
        }
    }
    // Aucun nom ajouté à un groupe tout neuf : il ne reste pas vide.
    db.execute("DELETE FROM tag_groups WHERE id = ?1 AND NOT EXISTS (SELECT 1 FROM tag_group_names WHERE group_id = ?1)", [group])?;
    Ok(group)
}
