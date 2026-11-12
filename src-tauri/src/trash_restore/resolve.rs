//! Restauration d'un tag de la corbeille : retrouver ce que désignent les identifiants d'un journal (TAGM-19, D-049).
//! Un identifiant peut resservir : on vérifie toujours le nom du tag, l'empreinte du média, le principal du groupe, le
//! tag du nom de groupe, l'enfant et le parent de la règle. Un tag encore dans la corbeille fait attendre la ligne.

use rusqlite::{OptionalExtension, params, params_from_iter};
use serde_json::{Map, Value};

use super::{Cx, Found, Miss, sql};
use crate::trash_journal::{Role, Table, role};
use crate::db::Cached;

impl Cx<'_> {
    pub(super) fn tag(&self, old: i64) -> Found<i64> {
        if let Some(&id) = self.found.get(&("tags", old)) {
            return Ok(id);
        }
        let Some(name) = self.j.tags.get(&old) else { return Err(Miss::Drop) };
        let same: Option<i64> = self.db.row("SELECT id FROM tags WHERE id = ?1 AND name = ?2", params![old, name], |r| r.get(0)).optional().ok().flatten();
        let by_name = || self.db.row("SELECT id FROM tags WHERE name = ?1", [name], |r| r.get(0)).optional().ok().flatten();
        match same.or_else(by_name) {
            Some(id) => Ok(id),
            None if self.trash.get(name).is_some_and(|&n| n > 0) => Err(Miss::Wait(name.clone())),
            None => Err(Miss::Drop),
        }
    }

    pub(super) fn waiting(&self, table: &'static str, old: i64) -> Option<Miss> {
        self.waiting.get(&(table, old)).map(|n| Miss::Wait(n.clone()))
    }

    pub(super) fn group(&self, old: i64) -> Found<i64> {
        if let Some(&id) = self.found.get(&("tag_groups", old)) {
            return Ok(id);
        }
        if let Some(m) = self.waiting("tag_groups", old) {
            return Err(m);
        }
        let principal = self.tag(*self.j.groups.get(&old).ok_or(Miss::Drop)?)?;
        self.db.row("SELECT id FROM tag_groups WHERE principal_id = ?1", [principal], |r| r.get(0)).optional().ok().flatten().ok_or(Miss::Drop)
    }

    /// Groupe d'un nom qui revient : son principal est là mais le groupe a disparu (vidé par la suppression d'un autre
    /// de ses noms, encore dans la corbeille) : il est recréé, avec son identifiant et sa date si possible.
    pub(super) fn ensure_group(&mut self, old: i64) {
        if self.group(old).is_ok() {
            return;
        }
        let Some(&p) = self.j.groups.get(&old) else { return };
        let Ok(principal) = self.tag(p) else { return };
        if self.exists("SELECT 1 FROM tag_group_names WHERE tag_id = ?1", principal) {
            return;
        }
        let at = self.j.groups_at.get(&old).copied().unwrap_or_else(crate::db::now_ms);
        let id = if self.exists("SELECT 1 FROM tag_groups WHERE id = ?1", old) { None } else { Some(old) };
        if self.db.execute("INSERT INTO tag_groups (id, principal_id, created_at) VALUES (?1, ?2, ?3)", params![id, principal, at]).is_ok() {
            self.found.insert(("tag_groups", old), self.db.last_insert_rowid());
        }
    }

    pub(super) fn name(&self, old: i64) -> Found<i64> {
        if let Some(&id) = self.found.get(&("tag_group_names", old)) {
            return Ok(id);
        }
        if let Some(m) = self.waiting("tag_group_names", old) {
            return Err(m);
        }
        let tag = self.tag(*self.j.names.get(&old).ok_or(Miss::Drop)?)?;
        self.db.row("SELECT id FROM tag_group_names WHERE tag_id = ?1", [tag], |r| r.get(0)).optional().ok().flatten().ok_or(Miss::Drop)
    }

    pub(super) fn rule(&self, old: i64) -> Found<i64> {
        if let Some(&id) = self.found.get(&("tag_parents", old)) {
            return Ok(id);
        }
        if let Some(m) = self.waiting("tag_parents", old) {
            return Err(m);
        }
        let &(c, p) = self.j.rules.get(&old).ok_or(Miss::Drop)?;
        let (c, p) = (self.tag(c)?, self.tag(p)?);
        self.db.row("SELECT id FROM tag_parents WHERE child_id = ?1 AND parent_id = ?2", [c, p], |r| r.get(0)).optional().ok().flatten().ok_or(Miss::Drop)
    }

    pub(super) fn media(&self, old: i64) -> Found<i64> {
        let hash = self.j.media.get(&old).ok_or(Miss::Drop)?;
        self.db.row("SELECT id FROM media WHERE hash = ?1", [hash], |r| r.get(0)).optional().ok().flatten().ok_or(Miss::Drop)
    }

    /// La ligne avec ses références traduites (sa propre clé `id` reste l'ancienne).
    pub(super) fn remap(&self, t: &Table, row: &Map<String, Value>) -> Found<Map<String, Value>> {
        let mut out = row.clone();
        for &col in t.cols {
            let Some(old) = row.get(col).and_then(Value::as_i64) else { continue };
            let new = match role(t.name, col) {
                Role::Tag => self.tag(old)?,
                Role::TagOpt => match self.tag(old) {
                    Ok(id) => id,
                    Err(_) => {
                        out.insert(col.into(), Value::Null);
                        continue;
                    }
                },
                Role::Group => self.group(old)?,
                Role::Name => self.name(old)?,
                Role::Rule => self.rule(old)?,
                Role::Media => self.media(old)?,
                Role::Ignore => {
                    let exists: bool = self.db.row("SELECT EXISTS (SELECT 1 FROM tag_similar_ignores WHERE id = ?1)", [old], |r| r.get(0)).unwrap_or(false);
                    if !exists {
                        return Err(Miss::Drop);
                    }
                    old
                }
                Role::Own | Role::Plain => continue,
            };
            out.insert(col.into(), Value::from(new));
        }
        Ok(out)
    }

    pub(super) fn current(&self, t: &Table, key: &[(&str, Value)]) -> Option<Map<String, Value>> {
        let cond: Vec<String> = key.iter().enumerate().map(|(i, (c, _))| format!("{c} = ?{}", i + 1)).collect();
        let cols: Vec<String> = t.cols.iter().map(|c| format!("'{c}', {c}")).collect();
        let sql_text = format!("SELECT json_object({}) FROM {} WHERE {}", cols.join(", "), t.name, cond.join(" AND "));
        let text: Option<String> = self.db.row(&sql_text, params_from_iter(key.iter().map(|(_, v)| sql(v))), |r| r.get(0)).optional().ok().flatten();
        text.and_then(|s| serde_json::from_str(&s).ok())
    }

    pub(super) fn key(t: &Table, row: &Map<String, Value>) -> Vec<(&'static str, Value)> {
        t.key.iter().map(|&k| (k, row.get(k).cloned().unwrap_or(Value::Null))).collect()
    }

    pub(super) fn exists(&self, sql_text: &str, id: i64) -> bool {
        self.db.row(&format!("SELECT EXISTS ({sql_text})"), [id], |r| r.get(0)).unwrap_or(true)
    }
}
