//! Restauration d'un tag de la corbeille (TAGM-19, réponses du 05/11 ; D-049) : le journal de sa suppression est
//! rejoué à l'envers. Les lignes que la suppression a ajoutées sont retirées si elles sont encore là ; le tag revient
//! (ou rejoint le tag qui porte maintenant son nom, réponse 3) ; les lignes retirées sont remises et les lignes
//! modifiées reprennent leur état d'avant si personne n'y a touché depuis. Ce qui n'a plus de sens est sauté (média
//! sorti de la bibliothèque, règle qui ferait une boucle, nom pris dans un autre groupe…) : « remet ce qui peut ». Une
//! ligne qui désigne un autre tag de la corbeille (son groupe, une règle vers lui) attend ce tag : elle est remise avec
//! lui (chaque tag de la corbeille est indépendant, réponse du 05/11).

use std::collections::HashMap;

use rusqlite::types::Value as Sql;
use rusqlite::{Connection, OptionalExtension, params, params_from_iter};
use serde_json::{Map, Value};

use crate::parents::reaches;
use crate::tags::DEFAULT_CATEGORY;
use crate::trash_journal::{Change, Journal, TABLES, Table};
use crate::db::Cached;

mod resolve;

/// Noms des tags de la corbeille, et combien de lignes portent chacun (0 : plus aucune).
pub type TrashNames = HashMap<String, usize>;

/// Pourquoi une référence ne se retrouve pas : sautée, ou en attente d'un tag de la corbeille (son nom).
enum Miss {
    Drop,
    Wait(String),
}

type Found<T> = Result<T, Miss>;

struct Cx<'a> {
    db: &'a Connection,
    j: &'a Journal,
    /// Noms des autres tags de la corbeille.
    trash: &'a TrashNames,
    /// Ancien identifiant → actuel, pour ce que cette restauration a remis ou retrouvé.
    found: HashMap<(&'static str, i64), i64>,
    /// Lignes mises en attente (table, ancien identifiant) → nom du tag attendu : leurs lignes filles attendent aussi.
    waiting: HashMap<(&'static str, i64), String>,
    /// Lignes en attente, par nom du tag attendu.
    pending: HashMap<String, Vec<Change>>,
}

fn int(row: &Map<String, Value>, col: &str) -> Option<i64> {
    row.get(col).and_then(Value::as_i64)
}

fn sql(v: &Value) -> Sql {
    match v {
        Value::Null => Sql::Null,
        Value::Bool(b) => Sql::Integer(*b as i64),
        Value::Number(n) => n.as_i64().map(Sql::Integer).unwrap_or_else(|| Sql::Real(n.as_f64().unwrap_or_default())),
        Value::String(s) => Sql::Text(s.clone()),
        other => Sql::Text(other.to_string()),
    }
}

impl Cx<'_> {
    /// Ligne ajoutée par la suppression : retirée si elle est encore là, telle quelle.
    fn remove_added(&self, t: &'static Table, after: &Map<String, Value>) {
        let Ok(mut row) = self.remap(t, after) else { return };
        if t.key == ["id"] {
            let Some(old) = int(after, "id") else { return };
            row.insert("id".into(), Value::from(*self.found.get(&(t.name, old)).unwrap_or(&old)));
        }
        if self.current(t, &Self::key(t, &row)).as_ref() == Some(&row) {
            let cond: Vec<String> = t.key.iter().enumerate().map(|(i, c)| format!("{c} = ?{}", i + 1)).collect();
            let _ = self.db.execute(&format!("DELETE FROM {} WHERE {}", t.name, cond.join(" AND ")), params_from_iter(Self::key(t, &row).iter().map(|(_, v)| sql(v))));
        }
    }

    /// Tag supprimé : recréé avec ses réglages, ou réuni au tag qui porte maintenant son nom (réponse 3).
    fn revive(&mut self, before: &Map<String, Value>) -> rusqlite::Result<()> {
        let (Some(old), Some(name)) = (int(before, "id"), before.get("name").and_then(Value::as_str)) else { return Ok(()) };
        if let Some(id) = self.db.row("SELECT id FROM tags WHERE name = ?1", [name], |r| r.get(0)).optional()? {
            self.found.insert(("tags", old), id);
            return Ok(());
        }
        let category: Option<i64> = self.db.row("SELECT id FROM tag_categories WHERE id = ?1", [int(before, "category_id")], |r| r.get(0)).optional()?;
        let category = match category {
            Some(c) => c,
            None => self.db.row("SELECT id FROM tag_categories WHERE key = ?1", [DEFAULT_CATEGORY], |r| r.get(0))?,
        };
        let free: bool = self.db.row("SELECT NOT EXISTS (SELECT 1 FROM tags WHERE id = ?1)", [old], |r| r.get(0))?;
        let get = |c: &str| before.get(c).map(sql).unwrap_or(Sql::Null);
        self.db.execute(
            "INSERT INTO tags (id, name, category_id, hidden, created_at, description) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![if free { Sql::Integer(old) } else { Sql::Null }, name, category, get("hidden"), get("created_at"), get("description")],
        )?;
        self.found.insert(("tags", old), self.db.last_insert_rowid());
        Ok(())
    }

    /// Ligne retirée par la suppression : remise, si elle a encore un sens.
    fn reinsert(&mut self, t: &'static Table, change: &Change) {
        let Some(before) = &change.b else { return };
        let old_id = if t.key == ["id"] { int(before, "id") } else { None };
        if t.name == "tag_group_names"
            && let Some(g) = int(before, "group_id")
        {
            self.ensure_group(g);
        }
        let mut row = match self.remap(t, before) {
            Ok(row) => row,
            Err(Miss::Wait(name)) => {
                if let Some(old) = old_id {
                    self.waiting.insert((t.name, old), name.clone());
                }
                self.pending.entry(name).or_default().push(change.clone());
                return;
            }
            Err(Miss::Drop) => return,
        };
        let id = |c: &str| int(&row, c).unwrap_or_default();
        let blocked = match t.name {
            // Un tag est principal d'un seul groupe, et jamais en même temps nom d'un groupe.
            "tag_groups" => self.exists("SELECT 1 FROM tag_groups WHERE principal_id = ?1 UNION SELECT 1 FROM tag_group_names WHERE tag_id = ?1", id("principal_id")),
            "tag_group_names" => self.exists("SELECT 1 FROM tag_groups WHERE principal_id = ?1", id("tag_id")),
            // Pas de règle d'un tag vers lui-même ni de boucle.
            "tag_parents" => id("child_id") == id("parent_id") || reaches(self.db, id("parent_id"), id("child_id")).unwrap_or(true),
            _ => false,
        };
        if blocked {
            return;
        }
        // Un tag fusionné n'est sur aucun média : son principal lui est posé à la place (comme le taper).
        if t.name == "media_tags"
            && let Some(p) = self
                .db
                .query_row(
                    "SELECT g.principal_id FROM tag_group_names n JOIN tag_groups g ON g.id = n.group_id WHERE n.tag_id = ?1 AND n.merged = 1",
                    [id("tag_id")],
                    |r| r.get::<_, i64>(0),
                )
                .optional()
                .ok()
                .flatten()
        {
            row.insert("tag_id".into(), Value::from(p));
        }
        if let Some(old) = old_id
            && self.exists(&format!("SELECT 1 FROM {} WHERE id = ?1", t.name), old)
        {
            row.insert("id".into(), Value::Null);
        }
        let marks: Vec<String> = (1..=t.cols.len()).map(|i| format!("?{i}")).collect();
        let values: Vec<Sql> = t.cols.iter().map(|c| row.get(*c).map(sql).unwrap_or(Sql::Null)).collect();
        // Une contrainte de la base refuse la ligne (doublon…) : elle est sautée, le reste continue.
        if self.db.execute(&format!("INSERT INTO {} ({}) VALUES ({})", t.name, t.cols.join(", "), marks.join(", ")), params_from_iter(values)).is_ok()
            && let Some(old) = old_id
        {
            self.found.insert((t.name, old), self.db.last_insert_rowid());
        }
    }

    /// Ligne modifiée par la suppression : reprend son état d'avant, si elle est restée telle que la suppression l'a
    /// laissée.
    fn revert(&mut self, t: &'static Table, change: &Change) {
        let (Some(before), Some(after)) = (&change.b, &change.a) else { return };
        let (mut now, mut then) = match (self.remap(t, after), self.remap(t, before)) {
            (Ok(now), Ok(then)) => (now, then),
            // Elle désigne un tag encore dans la corbeille (règle de son ancien principal…) : elle attend ce tag.
            (Err(Miss::Wait(name)), _) | (_, Err(Miss::Wait(name))) => {
                self.pending.entry(name).or_default().push(change.clone());
                return;
            }
            _ => return,
        };
        if t.key == ["id"] {
            let Some(old) = int(after, "id") else { return };
            let id = Value::from(*self.found.get(&(t.name, old)).unwrap_or(&old));
            now.insert("id".into(), id.clone());
            then.insert("id".into(), id);
        }
        if self.current(t, &Self::key(t, &now)).as_ref() != Some(&now) {
            return;
        }
        let sets: Vec<String> = t.cols.iter().enumerate().map(|(i, c)| format!("{c} = ?{}", i + 1)).collect();
        let cond: Vec<String> = t.key.iter().enumerate().map(|(i, c)| format!("{c} = ?{}", t.cols.len() + i + 1)).collect();
        let values: Vec<Sql> = t.cols.iter().map(|c| then.get(*c).map(sql).unwrap_or(Sql::Null)).chain(Self::key(t, &now).iter().map(|(_, v)| sql(v))).collect();
        let done = self.db.execute(&format!("UPDATE {} SET {} WHERE {}", t.name, sets.join(", "), cond.join(" AND ")), params_from_iter(values)).is_ok();
        if done && let Some(old) = int(after, "id").filter(|_| t.key == ["id"]) {
            let id = int(&now, "id").unwrap_or(old);
            self.found.insert((t.name, old), id);
        }
    }
}

/// Rejoue le journal à l'envers ; renvoie les lignes qui attendent d'autres tags de la corbeille (nom → journal).
pub fn restore(db: &Connection, j: &Journal, trash: &TrashNames) -> rusqlite::Result<Vec<(String, Journal)>> {
    let mut cx = Cx { db, j, trash, found: HashMap::new(), waiting: HashMap::new(), pending: HashMap::new() };
    let of = |name: &'static str| j.changes.iter().filter(move |c| c.t == name);
    // 1. Ce que la suppression a ajouté (les tables filles d'abord).
    for t in TABLES.iter().rev() {
        for c in of(t.name) {
            if let (None, Some(a)) = (&c.b, &c.a) {
                cx.remove_added(t, a);
            }
        }
    }
    // 2. Le tag lui-même.
    for c in of(TABLES[0].name) {
        if let (Some(b), None) = (&c.b, &c.a) {
            cx.revive(b)?;
        }
    }
    // 3. Table par table : les lignes modifiées reprennent leur état, puis les lignes retirées reviennent.
    for t in &TABLES[1..] {
        for c in of(t.name) {
            if c.b.is_some() && c.a.is_some() {
                cx.revert(t, c);
            }
        }
        for c in of(t.name) {
            if c.a.is_none() {
                cx.reinsert(t, c);
            }
        }
    }
    let mut out: Vec<(String, Journal)> = cx
        .pending
        .into_iter()
        .map(|(name, changes)| (name, Journal {
                    changes,
                    tags: j.tags.clone(),
                    media: j.media.clone(),
                    groups: j.groups.clone(),
                    groups_at: j.groups_at.clone(),
                    names: j.names.clone(),
                    rules: j.rules.clone(),
                    carried: Vec::new(),
                }))
        .collect();
    for sub in &j.carried {
        out.extend(restore(db, sub, trash)?);
    }
    Ok(out)
}
