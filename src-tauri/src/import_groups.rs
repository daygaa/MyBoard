//! Groupes de synonymes d'une liste importée (TAGM-18 ; refonte, D13, cas C-02 ; lots R8-1 et R8-2). Chaque tag du
//! groupe est un tag de la liste (créé avant s'il manquait). Un groupe qui ne touche aucun groupe de la base est créé
//! avec le tag principal du code ; s'il en touche un, ce groupe garde son tag principal et ses fusions, et les noms du
//! code le rejoignent (réponse 1 du 04/11) ; s'il en touche plusieurs, ils sont réunis comme dans le formulaire
//! « Créer » (D14 : le plus grand garde son principal, les fusions des autres sont défaites ; réponse 2). Un nom
//! fusionné dans le code l'est ici s'il vient d'être créé, ou si la case « Fusionner les tags pré-existants s'ils le
//! sont dans l'import » est cochée. Tout est noté pour l'aperçu (une ligne par groupe) et pour « Annuler ».

use std::collections::{HashMap, HashSet};

use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};

use crate::group_create::absorb;
use crate::groups::{self, add_linked, group_of_tag, principal, tag_named};
use crate::tag_import::ImportedGroup;
use crate::tags::normalize;

/// Un nom d'une ligne de l'aperçu, avec son état de fusion après l'import.
#[derive(Debug, Serialize)]
pub struct LineName {
    pub name: String,
    pub merged: bool,
}

/// Groupe de la base réuni à un autre (ligne de l'aperçu).
#[derive(Debug, Serialize)]
pub struct JoinedLine {
    pub principal: LineName,
    pub names: Vec<LineName>,
}

/// Ligne « Groupes de synonymes » de l'aperçu (retour T3, point TAGM-18.9).
#[derive(Debug, Serialize)]
pub struct GroupLine {
    /// « new » (créé), « completed » (noms ajoutés), « joined » (groupes de la base réunis), « changed » (fusions
    /// seulement).
    pub kind: &'static str,
    pub principal: LineName,
    /// Noms qui étaient déjà dans le groupe.
    pub names: Vec<LineName>,
    pub joined: Vec<JoinedLine>,
    /// Noms que l'import ajoute.
    pub added: Vec<LineName>,
}

/// Note d'une règle de parents sur un média : (règle, média, tag, tag de l'extension, tag d'origine).
type Note = (i64, i64, i64, Option<i64>, Option<i64>);
/// Tags de chaque média (média, tag) et notes de règles.
type MediaState = (Vec<(i64, i64)>, Vec<Note>);

/// Groupe de la base défait par une réunion : de quoi le recréer à l'annulation (principal, noms et leur fusion), et
/// les tags et notes de règles de ses médias, remis à l'identique (défaire ses fusions retire aussi en chaîne les
/// parents posés par ses règles, qu'une nouvelle fusion ne repose pas).
#[derive(Debug, Serialize, Deserialize)]
pub struct JoinedGroup {
    pub principal: i64,
    pub names: Vec<(i64, bool)>,
    pub media: Vec<(i64, i64)>,
    pub notes: Vec<Note>,
}

/// Ce que l'import des groupes a fait.
#[derive(Debug, Default)]
pub struct Outcome {
    /// Noms ajoutés aux groupes (retirés à l'annulation).
    pub names: Vec<i64>,
    /// Noms déjà dans leur groupe, fusionnés par l'import (défusionnés à l'annulation).
    pub fused: Vec<i64>,
    pub joined: Vec<JoinedGroup>,
    pub lines: Vec<GroupLine>,
    pub skipped: usize,
}

fn tag_of(db: &Connection, name: &str) -> rusqlite::Result<Option<i64>> {
    normalize(name).map(|n| tag_named(db, &n)).transpose().map(Option::flatten)
}

fn name_of(db: &Connection, tag: i64) -> rusqlite::Result<String> {
    db.query_row("SELECT name FROM tags WHERE id = ?1", [tag], |r| r.get(0))
}

/// Noms d'un groupe : (ligne, tag, fusionné).
fn rows(db: &Connection, group: i64) -> rusqlite::Result<Vec<(i64, i64, bool)>> {
    db.prepare("SELECT id, tag_id, merged FROM tag_group_names WHERE group_id = ?1 ORDER BY id")?
        .query_map([group], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
        .collect()
}

/// Tags et notes de règles des médias qui portent un de ces tags.
fn media_state(db: &Connection, tags: &[i64]) -> rusqlite::Result<MediaState> {
    let list = tags.iter().map(i64::to_string).collect::<Vec<_>>().join(",");
    let within = format!("SELECT DISTINCT media_id FROM media_tags WHERE tag_id IN ({list})");
    let media = db.prepare(&format!("SELECT media_id, tag_id FROM media_tags WHERE media_id IN ({within})"))?.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?.collect::<rusqlite::Result<_>>()?;
    let notes = db
        .prepare(&format!("SELECT rule_id, media_id, tag_id, extended, moved_from FROM tag_parent_media WHERE media_id IN ({within})"))?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)))?
        .collect::<rusqlite::Result<_>>()?;
    Ok((media, notes))
}

/// Le plus grand des groupes : le plus de noms, puis le principal le plus utilisé (D14).
fn largest(db: &Connection, groups: &[i64]) -> rusqlite::Result<i64> {
    let mut best = (groups[0], -1, -1);
    for &g in groups {
        let size: (i64, i64) = db.query_row(
            "SELECT (SELECT COUNT(*) FROM tag_group_names WHERE group_id = ?1), (SELECT media_count FROM tags WHERE id = g.principal_id)
               FROM tag_groups g WHERE g.id = ?1",
            [g],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        if (size.0, size.1) > (best.1, best.2) {
            best = (g, size.0, size.1);
        }
    }
    Ok(best.0)
}

pub fn import(db: &Connection, item: &ImportedGroup, created: &HashSet<i64>, merge_existing: bool, now: i64, out: &mut Outcome) -> anyhow::Result<()> {
    // Les tags du groupe du code, le principal d'abord, avec leur fusion dans le code.
    let Some(p) = tag_of(db, &item.principal)? else {
        out.skipped += item.names.len();
        return Ok(());
    };
    let mut members = vec![(p, false)];
    for n in &item.names {
        match tag_of(db, &n.name)? {
            Some(t) if !members.iter().any(|(m, _)| *m == t) => members.push((t, n.merged)),
            Some(_) => {}
            None => out.skipped += 1,
        }
    }
    let mut touched = Vec::new();
    for (t, _) in &members {
        if let Some(g) = group_of_tag(db, *t)?
            && !touched.contains(&g)
        {
            touched.push(g);
        }
    }
    let (group, fresh) = if touched.is_empty() {
        db.execute("INSERT INTO tag_groups (principal_id, created_at) VALUES (?1, ?2)", params![p, now])?;
        (db.last_insert_rowid(), true)
    } else {
        (largest(db, &touched)?, false)
    };
    let head = principal(db, group)?;
    let before = rows(db, group)?;
    // Réunion : chaque autre groupe touché est noté tel quel, puis réuni (ses fusions sont défaites, D14).
    let mut joined = Vec::new();
    for &g in touched.iter().filter(|&&g| g != group) {
        let (head_g, names) = (principal(db, g)?, rows(db, g)?.into_iter().map(|(_, t, m)| (t, m)).collect::<Vec<_>>());
        let tags: Vec<i64> = std::iter::once(head_g).chain(names.iter().map(|(t, _)| *t)).collect();
        let (media, notes) = media_state(db, &tags)?;
        let snapshot = JoinedGroup { principal: head_g, names, media, notes };
        absorb(db, group, g, now)?;
        joined.push(snapshot);
    }
    let mut added = Vec::new();
    for (t, _) in &members {
        if *t != head && group_of_tag(db, *t)? != Some(group) {
            out.names.push(add_linked(db, group, *t, now)?);
            added.push(*t);
        }
    }
    let earlier: HashSet<i64> = before.iter().map(|(id, _, _)| *id).collect();
    let mut changed = false;
    for (t, merged) in &members {
        if !merged || *t == head || !(created.contains(t) || merge_existing) {
            continue;
        }
        let row: Option<(i64, bool)> =
            db.query_row("SELECT id, merged FROM tag_group_names WHERE tag_id = ?1 AND group_id = ?2", params![t, group], |r| Ok((r.get(0)?, r.get(1)?))).optional()?;
        if let Some((id, false)) = row {
            groups::merge(db, id, &[])?;
            changed = true;
            if earlier.contains(&id) {
                out.fused.push(id);
            }
        }
    }
    // La ligne de l'aperçu, avec l'état de fusion final de chaque nom.
    let state: HashMap<i64, bool> = rows(db, group)?.into_iter().map(|(_, t, m)| (t, m)).collect();
    let line = |t: i64| -> rusqlite::Result<LineName> { Ok(LineName { name: name_of(db, t)?, merged: state.get(&t).copied().unwrap_or(false) }) };
    let kind = match () {
        _ if fresh => "new",
        _ if !joined.is_empty() => "joined",
        _ if !added.is_empty() => "completed",
        _ if changed => "changed",
        _ => "",
    };
    if fresh && added.is_empty() {
        // Groupe créé pour rien : il ne reste pas vide.
        db.execute("DELETE FROM tag_groups WHERE id = ?1 AND NOT EXISTS (SELECT 1 FROM tag_group_names WHERE group_id = ?1)", [group])?;
    } else if !kind.is_empty() {
        out.lines.push(GroupLine {
            kind,
            principal: line(head)?,
            names: before.iter().map(|(_, t, _)| line(*t)).collect::<rusqlite::Result<_>>()?,
            joined: joined
                .iter()
                .map(|j| Ok(JoinedLine { principal: line(j.principal)?, names: j.names.iter().map(|(t, _)| line(*t)).collect::<rusqlite::Result<_>>()? }))
                .collect::<rusqlite::Result<_>>()?,
            added: added.iter().map(|t| line(*t)).collect::<rusqlite::Result<_>>()?,
        });
    }
    out.joined.extend(joined);
    Ok(())
}

/// « Annuler » après l'import : fusions faites par l'import défaites, noms ajoutés retirés, groupes réunis recréés tels
/// qu'ils étaient (leurs fusions refaites).
pub fn undo(db: &Connection, names: &[i64], fused: &[i64], joined: &[JoinedGroup], now: i64) -> anyhow::Result<()> {
    for &id in fused {
        groups::unmerge(db, id)?;
    }
    for &id in names {
        groups::remove_name(db, id)?;
    }
    for g in joined.iter().rev() {
        for t in std::iter::once(g.principal).chain(g.names.iter().map(|(t, _)| *t)) {
            if let Some(id) = db.query_row("SELECT id FROM tag_group_names WHERE tag_id = ?1", [t], |r| r.get::<_, i64>(0)).optional()? {
                groups::remove_name(db, id)?;
            }
        }
        db.execute("INSERT INTO tag_groups (principal_id, created_at) VALUES (?1, ?2)", params![g.principal, now])?;
        let group = db.last_insert_rowid();
        for &(t, merged) in &g.names {
            let id = add_linked(db, group, t, now)?;
            if merged {
                groups::merge(db, id, &[])?;
            }
        }
        // Les médias du groupe retrouvent exactement leurs tags et les notes de leurs règles.
        let media: HashSet<i64> = g.media.iter().map(|(m, _)| *m).collect();
        for &m in &media {
            let keep: Vec<String> = g.media.iter().filter(|(x, _)| *x == m).map(|(_, t)| t.to_string()).collect();
            db.execute(&format!("DELETE FROM media_tags WHERE media_id = ?1 AND tag_id NOT IN ({})", keep.join(",")), [m])?;
            db.execute("DELETE FROM tag_parent_media WHERE media_id = ?1", [m])?;
        }
        for &(m, t) in &g.media {
            db.prepare_cached("INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?1, ?2)")?.execute(params![m, t])?;
        }
        for &(rule, m, t, extended, moved) in &g.notes {
            db.prepare_cached("INSERT OR IGNORE INTO tag_parent_media (rule_id, media_id, tag_id, extended, moved_from) VALUES (?1, ?2, ?3, ?4, ?5)")?
                .execute(params![rule, m, t, extended, moved])?;
        }
    }
    Ok(())
}
