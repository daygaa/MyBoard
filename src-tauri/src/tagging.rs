//! Pose de tags sur des médias en suivant les groupes de synonymes (TAGM-15, D-047) et les règles de parents
//! (TAGM-16). Tous les chemins qui ajoutent un tag passent par ici : visionneuse, barre du bas de la
//! sélection, tags par défaut de l'import, import JSON (DEV-01), fusion, restauration (DEL-05).
//!
//! Un tag posé par une règle est noté sous chaque règle du chemin (chat → animal → être vivant :
//! « être vivant » est noté sous les deux règles) : supprimer l'une avec sa case de retrait le retire
//! (GEN-21). Un tag déjà
//! présent n'est jamais noté : il a été posé à la main ou par une autre règle.

use std::collections::{HashMap, HashSet};

use rusqlite::{Connection, OptionalExtension, params};

use crate::tags::{DEFAULT_CATEGORY, NewTag, normalize};

/// Tag à poser : son identifiant, et le nom fusionné tapé s'il y en a un (noté pour pouvoir défaire la
/// fusion, D-047).
#[derive(Clone, Copy, Debug)]
pub struct Target {
    pub tag_id: i64,
    pub name_id: Option<i64>,
}

/// Tag désigné par ce nom : un tag fusionné donne le principal de son groupe (le média est noté pour la
/// défusion) ; sinon le tag de ce nom (un nom relié est un tag comme un autre).
pub fn resolve(db: &Connection, raw: &str) -> rusqlite::Result<Option<Target>> {
    let Some(name) = normalize(raw) else { return Ok(None) };
    if let Some((id, _, principal)) = crate::groups::merged_name(db, &name)? {
        return Ok(Some(Target { tag_id: principal, name_id: Some(id) }));
    }
    Ok(crate::groups::tag_named(db, &name)?.map(|tag_id| Target { tag_id, name_id: None }))
}

/// Comme `resolve`, mais crée le tag s'il n'existe pas (TAGM-07). À appeler dans une transaction
/// ouverte par l'appelant (D-005) ; `None` si le nom est vide après normalisation.
pub fn resolve_or_create(db: &Connection, tag: &NewTag, now: i64) -> anyhow::Result<Option<Target>> {
    if let Some(found) = resolve(db, &tag.name)? {
        return Ok(Some(found));
    }
    let Some(name) = normalize(&tag.name) else { return Ok(None) };
    let category = match tag.category_id {
        Some(id) => id,
        None => db.query_row("SELECT id FROM tag_categories WHERE key = ?1", [DEFAULT_CATEGORY], |r| r.get(0))?,
    };
    db.prepare_cached("INSERT INTO tags (name, category_id, created_at) VALUES (?1, ?2, ?3)")?.execute(params![name, category, now])?;
    Ok(Some(Target { tag_id: db.last_insert_rowid(), name_id: None }))
}

/// Une règle « enfant → parent ». `active` : allumée (D-047) et pas mise de côté par une fusion (lot R5) ; `merged` :
/// nom fusionné d'où vient son parent (règle déplacée) : un média où elle pose le principal est noté sous ce nom,
/// comme si on l'avait tapé (la défusion le lui rendra, réponse 1 du lot R5).
#[derive(Clone, Copy)]
struct Rule {
    id: i64,
    parent: i64,
    active: bool,
    merged: Option<i64>,
}

/// Une règle qui cite un tag fusionné est mise de côté : elle ne pose rien pendant la fusion (lot R5).
const ASIDE: &str = "EXISTS (SELECT 1 FROM tag_group_names n WHERE n.merged = 1 AND n.tag_id IN (p.child_id, p.parent_id))";

/// Règles de parents lues une fois, pour une série d'ajouts dans la même transaction.
pub struct Tagger {
    by_child: HashMap<i64, Vec<Rule>>,
    merged: HashMap<i64, i64>,
    /// Règles étendues à tout le groupe pendant une fusion (D11.3) : le tag fusionné, marqué sur leurs notes.
    extended: HashMap<i64, i64>,
}

impl Tagger {
    pub fn load(db: &Connection) -> rusqlite::Result<Self> {
        let mut by_child: HashMap<i64, Vec<Rule>> = HashMap::new();
        let mut merged = HashMap::new();
        let mut stmt = db.prepare(&format!(
            "SELECT p.id, p.child_id, p.parent_id, p.enabled = 1 AND NOT {ASIDE},
                    (SELECT n.id FROM tag_group_names n WHERE n.tag_id = p.parent_from AND n.merged = 1),
                    (SELECT n.tag_id FROM tag_group_names n WHERE n.tag_id = p.child_from AND n.merged = 1)
               FROM tag_parents p"
        ))?;
        let mut extended = HashMap::new();
        let rows = stmt.query_map([], |r| Ok((r.get::<_, i64>(1)?, Rule { id: r.get(0)?, parent: r.get(2)?, active: r.get(3)?, merged: r.get(4)? }, r.get::<_, Option<i64>>(5)?)))?;
        for row in rows {
            let (child, rule, from) = row?;
            if let Some(name) = rule.merged {
                merged.insert(rule.id, name);
            }
            if let Some(tag) = from {
                extended.insert(rule.id, tag);
            }
            by_child.entry(child).or_default().push(rule);
        }
        Ok(Self { by_child, merged, extended })
    }

    /// Le tag a-t-il des règles de parents (allumées ou non) ? Sans règle ni synonyme, un ajout groupé
    /// peut se faire en une seule requête.
    pub fn has_rules(&self, tag: i64) -> bool {
        self.by_child.contains_key(&tag)
    }

    /// Pose un tag (tapé, importé…) sur un média, avec ses parents en chaîne ; note le nom fusionné tapé (le
    /// défusionner le rendra à ce média). Renvoie vrai si le tag est nouveau sur ce média.
    pub fn attach(&self, db: &Connection, media: i64, target: Target) -> rusqlite::Result<bool> {
        let added = self.put(db, media, target.tag_id, &mut Vec::new())?;
        if let Some(name) = target.name_id {
            db.prepare_cached("INSERT OR IGNORE INTO tag_group_media (name_id, media_id, had_principal) VALUES (?1, ?2, ?3)")?
                .execute(params![name, media, !added])?;
        }
        Ok(added)
    }

    /// Applique une règle à un média qui porte son enfant (création avec sa case, parent remis par
    /// `restore_justified`).
    pub fn apply_rule(&self, db: &Connection, rule: i64, parent: i64, media: i64) -> rusqlite::Result<bool> {
        let added = self.put(db, media, parent, &mut vec![rule])?;
        self.note_merged(db, rule, media, added)?;
        Ok(added)
    }

    /// Règle déplacée qui vient de poser (ou trouver) le principal : le média est noté sous le nom fusionné.
    fn note_merged(&self, db: &Connection, rule: i64, media: i64, added: bool) -> rusqlite::Result<()> {
        if let Some(name) = self.merged.get(&rule) {
            db.prepare_cached("INSERT OR IGNORE INTO tag_group_media (name_id, media_id, had_principal) VALUES (?1, ?2, ?3)")?
                .execute(params![name, media, !added])?;
        }
        Ok(())
    }

    /// Pose `tag` ; s'il est nouveau, le note sous les règles `via` qui y ont conduit, puis suit ses
    /// propres règles. Un tag déjà présent arrête la chaîne : le parent n'est posé qu'au moment où
    /// l'enfant est ajouté (on peut le retirer à la main ensuite).
    fn put(&self, db: &Connection, media: i64, tag: i64, via: &mut Vec<i64>) -> rusqlite::Result<bool> {
        let added = db.prepare_cached("INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?1, ?2)")?.execute(params![media, tag])? > 0;
        if !added {
            return Ok(false);
        }
        for rule in via.iter() {
            db.prepare_cached("INSERT OR IGNORE INTO tag_parent_media (rule_id, media_id, tag_id, extended) VALUES (?1, ?2, ?3, ?4)")?
                .execute(params![rule, media, tag, self.extended.get(rule)])?;
        }
        let Some(rules) = self.by_child.get(&tag) else { return Ok(true) };
        for rule in rules {
            // Garde-fou : les boucles sont refusées à la création des règles.
            if via.contains(&rule.id) {
                continue;
            }
            // Règle éteinte : rien n'est posé, et rien ne sera rattrapé en la rallumant (D-047).
            if rule.active {
                via.push(rule.id);
                let added = self.put(db, media, rule.parent, via)?;
                via.pop();
                self.note_merged(db, rule.id, media, added)?;
            }
        }
        Ok(true)
    }
}

/// Retire `tag` d'un média puis, en chaîne, les tags que ses règles de parents lui avaient posés
/// (« animal » retiré : « être vivant », posé par animal → être vivant, part aussi), quel que soit
/// l'ordre de création des règles. Renvoie les parents retirés : `restore_justified` remet ceux
/// qu'une autre règle justifie encore.
pub fn remove_cascade(db: &Connection, media: i64, tag: i64) -> rusqlite::Result<Vec<(i64, i64)>> {
    let mut removed = Vec::new();
    let mut seen = HashSet::new();
    let mut todo = vec![tag];
    while let Some(t) = todo.pop() {
        // Un tag fusionné n'est sur aucun média : ses notes attendent la défusion (lot R5).
        if !seen.insert(t) || is_merged(db, t)? {
            continue;
        }
        let mut stmt = db.prepare_cached(
            "SELECT DISTINCT l.tag_id FROM tag_parent_media l JOIN tag_parents r ON r.id = l.rule_id
             WHERE l.media_id = ?1 AND r.child_id = ?2",
        )?;
        let given = stmt.query_map(params![media, t], |r| r.get::<_, i64>(0))?.collect::<rusqlite::Result<Vec<_>>>()?;
        db.prepare_cached("DELETE FROM media_tags WHERE media_id = ?1 AND tag_id = ?2")?.execute(params![media, t])?;
        if t != tag {
            removed.push((media, t));
        }
        todo.extend(given);
    }
    Ok(removed)
}

fn is_merged(db: &Connection, tag: i64) -> rusqlite::Result<bool> {
    db.prepare_cached("SELECT EXISTS(SELECT 1 FROM tag_group_names WHERE tag_id = ?1 AND merged = 1)")?.query_row([tag], |r| r.get(0))
}

/// Après le retrait de tags posés par une règle (supprimée avec sa case de retrait, fusion défaite) :
/// remet ceux qu'une autre règle allumée justifie encore, son enfant étant toujours sur le média.
pub fn restore_justified(db: &Connection, removed: &[(i64, i64)]) -> rusqlite::Result<()> {
    let tagger = Tagger::load(db)?;
    loop {
        let mut changed = false;
        for &(media, tag) in removed {
            let present: bool = db
                .prepare_cached("SELECT EXISTS(SELECT 1 FROM media_tags WHERE media_id = ?1 AND tag_id = ?2)")?
                .query_row(params![media, tag], |r| r.get(0))?;
            if present {
                continue;
            }
            let rule: Option<i64> = db
                .prepare_cached(
                    &format!(
                        "SELECT p.id FROM tag_parents p JOIN media_tags c ON c.media_id = ?1 AND c.tag_id = p.child_id
                          WHERE p.parent_id = ?2 AND p.enabled = 1 AND NOT {ASIDE} LIMIT 1"
                    ),
                )?
                .query_row(params![media, tag], |r| r.get(0))
                .optional()?;
            if let Some(rule) = rule {
                tagger.apply_rule(db, rule, tag, media)?;
                changed = true;
            }
        }
        if !changed {
            return Ok(());
        }
    }
}
