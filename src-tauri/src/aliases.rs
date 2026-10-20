//! Synonymes (TAGM-15) : un nom redirigé vers un tag principal. Déclarer « A → B » alors que A est un
//! tag fusionne A dans B ; le synonyme garde les réglages de A et la liste de ses médias (et s'ils
//! avaient déjà B), pour que décocher le synonyme défasse la fusion à l'identique (Q1-B1, GEN-21).
//! Une fusion du gestionnaire peut aussi garder les anciens noms comme synonymes (TAGM-17).
//! Les opérations se font dans la transaction de l'appelant.

use rusqlite::{Connection, OptionalExtension, params};
use serde::Serialize;

use crate::parents::move_rules;
use crate::tagging::{Target, Tagger, remove_cascade, restore_justified};
use crate::tags::{DEFAULT_CATEGORY, normalize};

/// Vérification avant de créer un synonyme : refus expliqué, ou nombre de médias du tag qui sera
/// fusionné (confirmation, « Oui » rouge).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AliasCheck {
    pub error: Option<String>,
    /// Médias du tag qui porte déjà ce nom (`None` : aucun tag de ce nom, rien à fusionner).
    pub tag_media: Option<i64>,
}

fn shown(name: &str) -> String {
    name.replace('_', " ")
}

fn tag_named(db: &Connection, name: &str) -> rusqlite::Result<Option<(i64, i64)>> {
    db.query_row("SELECT id, media_count FROM tags WHERE name = ?1", [name], |r| Ok((r.get(0)?, r.get(1)?))).optional()
}

pub fn check(db: &Connection, raw: &str, target: i64) -> rusqlite::Result<AliasCheck> {
    let fail = |e: String| Ok(AliasCheck { error: Some(e), tag_media: None });
    let Some(alias) = normalize(raw) else { return fail("Nom vide.".into()) };
    let target_name: String = db.query_row("SELECT name FROM tags WHERE id = ?1", [target], |r| r.get(0))?;
    if alias == target_name {
        return fail(format!("« {} » est le tag principal lui-même.", shown(&alias)));
    }
    let existing: Option<(String, bool)> = db
        .query_row(
            "SELECT t.name, a.enabled FROM tag_aliases a JOIN tags t ON t.id = a.tag_id WHERE a.alias = ?1",
            [&alias],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;
    if let Some((of, true)) = existing {
        return fail(format!("« {} » est déjà un synonyme de « {} ».", shown(&alias), shown(&of)));
    }
    Ok(AliasCheck { error: None, tag_media: tag_named(db, &alias)?.map(|(_, n)| n) })
}

/// Crée (ou réutilise, s'il est décoché) le synonyme « alias → target » ; fusionne le tag qui porte
/// ce nom s'il existe.
pub fn create(db: &Connection, raw: &str, target: i64, now: i64) -> anyhow::Result<()> {
    if let Some(error) = check(db, raw, target)?.error {
        anyhow::bail!(error);
    }
    let alias = normalize(raw).unwrap_or_default();
    match tag_named(db, &alias)? {
        Some((source, _)) => merge_into(db, source, target, true, now),
        None => {
            db.execute("DELETE FROM tag_aliases WHERE alias = ?1", [&alias])?;
            db.execute("INSERT INTO tag_aliases (alias, tag_id, created_at) VALUES (?1, ?2, ?3)", params![alias, target, now])?;
            Ok(())
        }
    }
}

/// Fusionne le tag `source` dans `target` (TAGM-04) : ses médias reçoivent `target` et ses parents,
/// ses synonymes et ses règles passent à `target`, puis il est supprimé. Le tag gardé conserve sa
/// catégorie et son état ; sans description, il prend celle de `source`. Avec `keep`, le nom de
/// `source` devient un synonyme de `target` avec la liste de ses médias (TAGM-15, TAGM-17).
pub fn merge_into(db: &Connection, source: i64, target: i64, keep: bool, now: i64) -> anyhow::Result<()> {
    if source == target {
        return Ok(());
    }
    if keep {
        let name: String = db.query_row("SELECT name FROM tags WHERE id = ?1", [source], |r| r.get(0))?;
        // Un synonyme décoché du même nom (fusion défaite auparavant) est remplacé.
        db.execute("DELETE FROM tag_aliases WHERE alias = ?1", [&name])?;
        db.execute(
            "INSERT INTO tag_aliases (alias, tag_id, created_at, category_id, description, hidden, tag_created_at)
             SELECT name, ?2, ?3, category_id, description, hidden, created_at FROM tags WHERE id = ?1",
            params![source, target, now],
        )?;
        let alias = db.last_insert_rowid();
        db.execute(
            "INSERT INTO tag_alias_media (alias_id, media_id, had_target)
             SELECT ?1, s.media_id, EXISTS (SELECT 1 FROM media_tags t WHERE t.media_id = s.media_id AND t.tag_id = ?3)
             FROM media_tags s WHERE s.tag_id = ?2",
            params![alias, source, target],
        )?;
    }
    // Pas de synonyme de synonyme : ceux de `source` pointent directement vers `target`.
    db.execute("UPDATE tag_aliases SET tag_id = ?2 WHERE tag_id = ?1", params![source, target])?;
    db.execute(
        "UPDATE tags SET description = (SELECT description FROM tags WHERE id = ?1) WHERE id = ?2 AND description IS NULL",
        params![source, target],
    )?;
    move_rules(db, source, target)?;
    let tagger = Tagger::load(db)?;
    let mut stmt = db.prepare("SELECT media_id FROM media_tags WHERE tag_id = ?1")?;
    let media = stmt.query_map([source], |r| r.get::<_, i64>(0))?.collect::<rusqlite::Result<Vec<_>>>()?;
    for m in media {
        tagger.attach(db, m, Target { tag_id: target, alias_id: None })?;
    }
    db.execute("DELETE FROM tags WHERE id = ?1", [source])?;
    Ok(())
}

/// Ce que ferait la case recochée : nombre de médias du tag du même nom, fusionné à nouveau.
pub fn enable_check(db: &Connection, id: i64) -> rusqlite::Result<Option<i64>> {
    let alias: Option<String> = db.query_row("SELECT alias FROM tag_aliases WHERE id = ?1", [id], |r| r.get(0)).optional()?;
    Ok(match alias {
        Some(alias) => tag_named(db, &alias)?.map(|(_, n)| n),
        None => None,
    })
}

/// Case du synonyme. Décochée : la fusion est défaite. Recochée : le tag du même nom, s'il existe,
/// est fusionné à nouveau.
pub fn set_enabled(db: &Connection, id: i64, enabled: bool, now: i64) -> anyhow::Result<()> {
    let Some((alias, target, was)) = db
        .query_row("SELECT alias, tag_id, enabled FROM tag_aliases WHERE id = ?1", [id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?, r.get::<_, bool>(2)?)))
        .optional()?
    else {
        return Ok(());
    };
    if enabled == was {
        return Ok(());
    }
    if !enabled {
        return unmerge(db, id);
    }
    match tag_named(db, &alias)? {
        Some((source, _)) => merge_into(db, source, target, true, now),
        None => {
            db.execute("UPDATE tag_aliases SET enabled = 1 WHERE id = ?1", [id])?;
            Ok(())
        }
    }
}

/// Défait la fusion : le tag est recréé (nom, catégorie, description, état masqué) sur ses médias, et
/// le tag principal est retiré de ceux qui ne l'avaient pas avant, avec les parents qu'il leur avait
/// apportés.
fn unmerge(db: &Connection, id: i64) -> anyhow::Result<()> {
    // Décoché d'abord : le déclencheur garde alors la liste pendant les retraits.
    db.execute("UPDATE tag_aliases SET enabled = 0 WHERE id = ?1", [id])?;
    let (alias, target, category, description, hidden, created): (String, i64, Option<i64>, Option<String>, bool, Option<i64>) = db.query_row(
        "SELECT alias, tag_id, category_id, description, hidden, tag_created_at FROM tag_aliases WHERE id = ?1",
        [id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)),
    )?;
    let mut stmt = db.prepare("SELECT media_id, had_target FROM tag_alias_media WHERE alias_id = ?1")?;
    let listed = stmt.query_map([id], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, bool>(1)?)))?.collect::<rusqlite::Result<Vec<_>>>()?;
    if category.is_none() && listed.is_empty() {
        return Ok(());
    }
    let tag = match tag_named(db, &alias)? {
        Some((tag, _)) => tag,
        None => {
            let category: i64 = db.query_row(
                "SELECT COALESCE((SELECT id FROM tag_categories WHERE id = ?1), (SELECT id FROM tag_categories WHERE key = ?2))",
                params![category, DEFAULT_CATEGORY],
                |r| r.get(0),
            )?;
            db.execute(
                "INSERT INTO tags (name, category_id, hidden, created_at, description) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![alias, category, hidden, created.unwrap_or_else(crate::db::now_ms), description],
            )?;
            db.last_insert_rowid()
        }
    };
    let mut removed = Vec::new();
    for (media, had_target) in listed {
        db.prepare_cached("INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?1, ?2)")?.execute(params![media, tag])?;
        if !had_target {
            removed.extend(remove_cascade(db, media, target)?);
        }
    }
    db.execute("DELETE FROM tag_alias_media WHERE alias_id = ?1", [id])?;
    restore_justified(db, &removed)?;
    Ok(())
}

/// Corbeille : défait la fusion (si le synonyme est coché), puis l'oublie.
pub fn delete(db: &Connection, id: i64) -> anyhow::Result<()> {
    let enabled: Option<bool> = db.query_row("SELECT enabled FROM tag_aliases WHERE id = ?1", [id], |r| r.get(0)).optional()?;
    if enabled == Some(true) {
        unmerge(db, id)?;
    }
    db.execute("DELETE FROM tag_aliases WHERE id = ?1", [id])?;
    Ok(())
}
