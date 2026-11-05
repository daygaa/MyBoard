//! Journal d'une suppression de tag, pour la corbeille (TAGM-19, D-049). Pendant la suppression, des déclencheurs
//! temporaires (propres à cette connexion, retirés aussitôt après) notent chaque ligne ajoutée, retirée ou modifiée dans
//! les tables des tags, y compris par les cascades et les déclencheurs de la base. Le journal garde l'effet net (état
//! avant, état après) de chaque ligne, et de quoi retrouver plus tard ce que désignent ses identifiants : le nom des
//! tags, l'empreinte des médias, le tag principal des groupes, le tag des noms de groupe, l'enfant et le parent des
//! règles (un identifiant peut resservir : on ne s'y fie jamais seul).

use std::collections::{HashMap, HashSet};

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

/// Une table suivie : ses colonnes, sa clé, les opérations notées.
pub struct Table {
    pub name: &'static str,
    pub cols: &'static [&'static str],
    pub key: &'static [&'static str],
    ops: &'static [&'static str],
}

const ALL: &[&str] = &["INSERT", "UPDATE", "DELETE"];

/// Dans l'ordre où la restauration les remet (une table avant celles qui la désignent). `tags` : seules ses
/// suppressions comptent (son compteur de médias suit les déclencheurs de la base).
pub const TABLES: &[Table] = &[
    Table { name: "tags", cols: &["id", "name", "category_id", "hidden", "created_at", "description"], key: &["id"], ops: &["DELETE"] },
    Table { name: "tag_groups", cols: &["id", "principal_id", "created_at"], key: &["id"], ops: ALL },
    Table {
        name: "tag_group_names",
        cols: &["id", "group_id", "tag_id", "name", "category_id", "description", "hidden", "tag_created_at", "created_at", "merged"],
        key: &["id"],
        ops: ALL,
    },
    Table { name: "tag_parents", cols: &["id", "child_id", "parent_id", "enabled", "created_at", "child_from", "parent_from"], key: &["id"], ops: ALL },
    Table { name: "media_tags", cols: &["media_id", "tag_id"], key: &["media_id", "tag_id"], ops: &["INSERT", "DELETE"] },
    Table { name: "tag_group_media", cols: &["name_id", "media_id", "had_principal"], key: &["name_id", "media_id"], ops: ALL },
    Table { name: "tag_parent_media", cols: &["rule_id", "media_id", "tag_id", "moved_from", "extended"], key: &["rule_id", "media_id", "tag_id"], ops: ALL },
    Table { name: "tag_similar_ignore_tags", cols: &["ignore_id", "tag_id", "apart"], key: &["ignore_id", "tag_id"], ops: ALL },
];

pub fn table(name: &str) -> Option<&'static Table> {
    TABLES.iter().find(|t| t.name == name)
}

/// Rôle d'une colonne : ce que désigne sa valeur.
#[derive(Clone, Copy, PartialEq)]
pub enum Role {
    Own,
    Tag,
    /// Tag facultatif : sans lui, la colonne reste vide.
    TagOpt,
    Group,
    Name,
    Rule,
    Media,
    Ignore,
    Plain,
}

pub fn role(table: &str, col: &str) -> Role {
    match (table, col) {
        ("tags" | "tag_groups" | "tag_group_names" | "tag_parents", "id") => Role::Own,
        ("tag_groups", "principal_id") | ("tag_group_names" | "media_tags" | "tag_parent_media" | "tag_similar_ignore_tags", "tag_id") => Role::Tag,
        ("tag_parents", "child_id" | "parent_id") => Role::Tag,
        ("tag_parents", "child_from" | "parent_from") | ("tag_parent_media", "moved_from" | "extended") => Role::TagOpt,
        ("tag_group_names", "group_id") => Role::Group,
        ("tag_group_media", "name_id") => Role::Name,
        ("tag_parent_media", "rule_id") => Role::Rule,
        (_, "media_id") => Role::Media,
        ("tag_similar_ignore_tags", "ignore_id") => Role::Ignore,
        _ => Role::Plain,
    }
}

/// Effet net d'une suppression sur une ligne : `b` avant, `a` après (vide : la ligne n'existait pas).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Change {
    pub t: String,
    #[serde(default)]
    pub b: Option<Map<String, Value>>,
    #[serde(default)]
    pub a: Option<Map<String, Value>>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Journal {
    pub changes: Vec<Change>,
    /// Tag → son nom.
    #[serde(default)]
    pub tags: HashMap<i64, String>,
    /// Média → son empreinte.
    #[serde(default)]
    pub media: HashMap<i64, String>,
    /// Groupe → son tag principal.
    #[serde(default)]
    pub groups: HashMap<i64, i64>,
    /// Groupe → sa date de création (un groupe vidé par la suppression d'un autre tag est recréé à l'identique).
    #[serde(default)]
    pub groups_at: HashMap<i64, i64>,
    /// Nom de groupe → son tag.
    #[serde(default)]
    pub names: HashMap<i64, i64>,
    /// Règle → (enfant, parent).
    #[serde(default)]
    pub rules: HashMap<i64, (i64, i64)>,
    /// Lignes d'autres tags de la corbeille qui attendaient celui-ci (son groupe, une règle vers lui…) : remises
    /// avec lui, chacune avec ses propres repères.
    #[serde(default)]
    pub carried: Vec<Journal>,
}

fn json_of(prefix: &str, cols: &[&str]) -> String {
    let pairs: Vec<String> = cols.iter().map(|c| format!("'{c}', {prefix}.{c}")).collect();
    format!("json_object({})", pairs.join(", "))
}

/// Pose les déclencheurs temporaires (transaction de l'appelant).
pub fn start(db: &Connection) -> rusqlite::Result<()> {
    let mut sql = String::from("CREATE TEMP TABLE IF NOT EXISTS trash_log (seq INTEGER PRIMARY KEY, tab TEXT NOT NULL, old TEXT, new TEXT);");
    for t in TABLES {
        for op in t.ops {
            let (old, new) = match *op {
                "INSERT" => ("NULL".to_string(), json_of("NEW", t.cols)),
                "DELETE" => (json_of("OLD", t.cols), "NULL".to_string()),
                _ => (json_of("OLD", t.cols), json_of("NEW", t.cols)),
            };
            sql.push_str(&format!(
                "CREATE TEMP TRIGGER IF NOT EXISTS trash_{name}_{low} AFTER {op} ON main.{name} BEGIN
                   INSERT INTO temp.trash_log (tab, old, new) VALUES ('{name}', {old}, {new});
                 END;",
                name = t.name,
                low = op.to_lowercase(),
            ));
        }
    }
    db.execute_batch(&sql)
}

/// Retire les déclencheurs temporaires.
pub fn stop(db: &Connection) -> rusqlite::Result<()> {
    let mut sql = String::new();
    for t in TABLES {
        for op in t.ops {
            sql.push_str(&format!("DROP TRIGGER IF EXISTS temp.trash_{}_{};", t.name, op.to_lowercase()));
        }
    }
    sql.push_str("DROP TABLE IF EXISTS temp.trash_log;");
    db.execute_batch(&sql)
}

fn key_of(t: &Table, row: &Map<String, Value>) -> String {
    t.key.iter().map(|k| row.get(*k).map(Value::to_string).unwrap_or_default()).collect::<Vec<_>>().join("|")
}

/// Une ligne notée (vide : la ligne n'existe pas).
type Row = Option<Map<String, Value>>;

fn int(row: &Map<String, Value>, col: &str) -> Option<i64> {
    row.get(col).and_then(Value::as_i64)
}

/// Le journal de ce qui a été noté depuis le dernier appel (puis le registre est vidé).
pub fn take(db: &Connection) -> rusqlite::Result<Journal> {
    let rows: Vec<(String, Option<String>, Option<String>)> =
        db.prepare("SELECT tab, old, new FROM temp.trash_log ORDER BY seq")?.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?.collect::<rusqlite::Result<_>>()?;
    db.execute("DELETE FROM temp.trash_log", [])?;
    let parse = |s: Option<String>| s.and_then(|s| serde_json::from_str::<Map<String, Value>>(&s).ok());
    let mut order: Vec<(String, String)> = Vec::new();
    let mut net: HashMap<(String, String), (Row, Row)> = HashMap::new();
    let mut touch = |tab: &str, key: String, before: Row, after: Row| {
        let id = (tab.to_string(), key);
        match net.get_mut(&id) {
            Some(entry) => entry.1 = after,
            None => {
                order.push(id.clone());
                net.insert(id, (before, after));
            }
        }
    };
    for (tab, old, new) in rows {
        let Some(t) = table(&tab) else { continue };
        let (old, new) = (parse(old), parse(new));
        // Une modification = la ligne d'avant retirée, celle d'après ajoutée (sa clé peut changer : note déplacée).
        if let Some(o) = &old {
            touch(&tab, key_of(t, o), Some(o.clone()), None);
        }
        if let Some(n) = &new {
            touch(&tab, key_of(t, n), None, Some(n.clone()));
        }
    }
    let mut journal = Journal::default();
    for id in order {
        if let Some((b, a)) = net.remove(&id)
            && b != a
        {
            journal.changes.push(Change { t: id.0, b, a });
        }
    }
    landmarks(db, &mut journal)?;
    Ok(journal)
}

/// Repères des identifiants cités par le journal (état d'avant la suppression quand le journal l'a, sinon actuel).
fn landmarks(db: &Connection, j: &mut Journal) -> rusqlite::Result<()> {
    let (mut tags, mut media, mut groups, mut names, mut rules) = (HashSet::new(), HashSet::new(), HashSet::new(), HashSet::new(), HashSet::new());
    for c in &j.changes {
        for row in [&c.b, &c.a].into_iter().flatten() {
            for (col, v) in row {
                let Some(id) = v.as_i64() else { continue };
                match role(&c.t, col) {
                    Role::Tag | Role::TagOpt => tags.insert(id),
                    Role::Media => media.insert(id),
                    Role::Group => groups.insert(id),
                    Role::Name => names.insert(id),
                    Role::Rule => rules.insert(id),
                    Role::Own if c.t == "tag_groups" => groups.insert(id),
                    _ => false,
                };
            }
        }
    }
    // Ce que le journal sait déjà (lignes retirées ou modifiées : leur état d'avant).
    for c in &j.changes {
        let Some(b) = &c.b else { continue };
        match c.t.as_str() {
            "tags" => {
                if let (Some(id), Some(name)) = (int(b, "id"), b.get("name").and_then(Value::as_str)) {
                    j.tags.insert(id, name.to_string());
                }
            }
            "tag_groups" => {
                if let (Some(id), Some(p)) = (int(b, "id"), int(b, "principal_id")) {
                    j.groups.insert(id, p);
                    if let Some(at) = int(b, "created_at") {
                        j.groups_at.insert(id, at);
                    }
                }
            }
            "tag_group_names" => {
                if let (Some(id), Some(t)) = (int(b, "id"), int(b, "tag_id")) {
                    j.names.insert(id, t);
                }
            }
            "tag_parents" => {
                if let (Some(id), Some(cid), Some(pid)) = (int(b, "id"), int(b, "child_id"), int(b, "parent_id")) {
                    j.rules.insert(id, (cid, pid));
                }
            }
            _ => {}
        }
    }
    for g in groups {
        if !j.groups.contains_key(&g)
            && let Some((p, at)) = db.query_row("SELECT principal_id, created_at FROM tag_groups WHERE id = ?1", [g], |r| Ok((r.get(0)?, r.get(1)?))).optional()?
        {
            j.groups.insert(g, p);
            j.groups_at.insert(g, at);
        }
    }
    for n in names {
        if !j.names.contains_key(&n)
            && let Some(t) = db.query_row("SELECT tag_id FROM tag_group_names WHERE id = ?1", [n], |r| r.get::<_, Option<i64>>(0)).optional()?.flatten()
        {
            j.names.insert(n, t);
        }
    }
    for r in rules {
        if !j.rules.contains_key(&r)
            && let Some(pair) = db.query_row("SELECT child_id, parent_id FROM tag_parents WHERE id = ?1", [r], |r| Ok((r.get(0)?, r.get(1)?))).optional()?
        {
            j.rules.insert(r, pair);
        }
    }
    tags.extend(j.groups.values().copied());
    tags.extend(j.names.values().copied());
    tags.extend(j.rules.values().flat_map(|&(c, p)| [c, p]));
    for t in tags {
        if !j.tags.contains_key(&t)
            && let Some(name) = db.query_row("SELECT name FROM tags WHERE id = ?1", [t], |r| r.get::<_, String>(0)).optional()?
        {
            j.tags.insert(t, name);
        }
    }
    for m in media {
        if let Some(hash) = db.query_row("SELECT hash FROM media WHERE id = ?1", [m], |r| r.get::<_, String>(0)).optional()? {
            j.media.insert(m, hash);
        }
    }
    Ok(())
}
