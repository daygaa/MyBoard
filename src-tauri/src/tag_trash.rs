//! Corbeille des tags (TAGM-19, réponses du 05/11 ; D-049). Un tag supprimé y est gardé 30 jours avec le journal de
//! sa suppression (`trash_journal.rs`), puis effacé au lancement de MyBoard. Les tags d'une même suppression y vont un
//! par un, chacun avec son journal (ils sont indépendants : restaurer « kitty » seul le remet sans « chat ») : les
//! noms d'abord, les tags principaux ensuite, pour qu'un nom garde sa place dans son groupe jusqu'à sa propre
//! suppression. « Restaurer » rejoue le journal à l'envers (`trash_restore.rs`), les plus récents d'abord.

use std::collections::HashSet;

use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params};
use serde::Serialize;
use tauri::State;

use crate::trash_journal::{self, Journal};
use crate::{AppState, db, tag_delete, trash_restore};

/// 30 jours, comme la réserve des médias (DEL-05).
const KEEP_MS: i64 = 30 * 24 * 3600 * 1000;

/// Une ligne de la corbeille, et ce à quoi le tag était lié (pop-in « Voulez-vous restaurer… ? »).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashTag {
    pub id: i64,
    pub name: String,
    pub category_id: Option<i64>,
    pub hidden: bool,
    pub media: i64,
    pub rules: i64,
    pub synonyms: i64,
    pub deleted_at: i64,
}

const COLUMNS: &str = "id, name, category_id, hidden, media, rules, synonyms, deleted_at";

fn row(r: &rusqlite::Row) -> rusqlite::Result<TrashTag> {
    Ok(TrashTag {
        id: r.get(0)?,
        name: r.get(1)?,
        category_id: r.get(2)?,
        hidden: r.get(3)?,
        media: r.get(4)?,
        rules: r.get(5)?,
        synonyms: r.get(6)?,
        deleted_at: r.get(7)?,
    })
}

fn is_principal(db: &Connection, tag: i64) -> rusqlite::Result<bool> {
    db.query_row("SELECT EXISTS (SELECT 1 FROM tag_groups WHERE principal_id = ?1)", [tag], |r| r.get(0))
}

/// Ce à quoi un tag est lié : ses médias (un tag fusionné : ceux notés pour sa défusion), ses règles de parents, ses
/// synonymes (les autres tags de son groupe : un principal, les noms du groupe ; un nom, les autres noms et le
/// principal, soit autant que de noms).
struct Info {
    name: String,
    category: i64,
    hidden: bool,
    media: i64,
    rules: i64,
    synonyms: i64,
}

fn info(db: &Connection, tag: i64) -> rusqlite::Result<Option<Info>> {
    let Some((name, category, hidden, media)) = db
        .query_row(
            "SELECT name, category_id, hidden, media_count + (SELECT COUNT(*) FROM tag_group_media m JOIN tag_group_names n ON n.id = m.name_id
                                                               WHERE n.tag_id = tags.id AND n.merged = 1)
               FROM tags WHERE id = ?1",
            [tag],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .optional()?
    else {
        return Ok(None);
    };
    let rules = db.query_row("SELECT COUNT(*) FROM tag_parents WHERE child_id = ?1 OR parent_id = ?1", [tag], |r| r.get(0))?;
    let synonyms = db.query_row(
        "SELECT COUNT(*) FROM tag_group_names n
          WHERE n.group_id IN (SELECT id FROM tag_groups WHERE principal_id = ?1 UNION SELECT group_id FROM tag_group_names WHERE tag_id = ?1)",
        [tag],
        |r| r.get(0),
    )?;
    Ok(Some(Info { name, category, hidden, media, rules, synonyms }))
}

/// Supprime les tags en les mettant à la corbeille (transaction de l'appelant) ; mêmes cases que la suppression
/// définitive (`tag_delete::delete`).
pub fn delete(db: &Connection, ids: &[i64], with_merged: bool, strip: bool, remove_posed: bool) -> anyhow::Result<usize> {
    let mut order = tag_delete::expand(db, ids, with_merged)?;
    let mut principal = Vec::with_capacity(order.len());
    for &t in &order {
        principal.push((t, is_principal(db, t)?));
    }
    order = principal.iter().filter(|p| !p.1).chain(principal.iter().filter(|p| p.1)).map(|p| p.0).collect();
    // Ce à quoi chacun est lié, relevé avant toute suppression (pop-in « Voulez-vous restaurer… ? »).
    let mut infos = Vec::with_capacity(order.len());
    for &tag in &order {
        if let Some(info) = info(db, tag)? {
            infos.push((tag, info));
        }
    }
    trash_journal::start(db)?;
    let done = (|| -> anyhow::Result<usize> {
        let now = db::now_ms();
        let mut deleted = 0;
        for (tag, i) in infos {
            deleted += tag_delete::delete(db, &[tag], false, strip, remove_posed)?;
            let journal = trash_journal::take(db)?;
            db.execute(
                "INSERT INTO tag_trash (name, category_id, hidden, media, rules, synonyms, deleted_at, journal) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![i.name, i.category, i.hidden, i.media, i.rules, i.synonyms, now, serde_json::to_string(&journal)?],
            )?;
        }
        Ok(deleted)
    })();
    trash_journal::stop(db)?;
    done
}

fn load(db: &Connection, id: i64) -> anyhow::Result<Option<Journal>> {
    let text: Option<String> = db.query_row("SELECT journal FROM tag_trash WHERE id = ?1", [id], |r| r.get(0)).optional()?;
    Ok(match text {
        Some(t) => Some(serde_json::from_str(&t)?),
        None => None,
    })
}

/// Restaure ces tags, les plus récemment supprimés d'abord (l'ordre inverse de leurs suppressions).
fn restore(db: &Connection, ids: &[i64]) -> anyhow::Result<usize> {
    let mut ordered: Vec<(i64, i64)> = Vec::new();
    for &id in ids {
        if let Some(at) = db.query_row("SELECT deleted_at FROM tag_trash WHERE id = ?1", [id], |r| r.get(0)).optional()? {
            ordered.push((id, at));
        }
    }
    ordered.sort_by(|a, b| b.1.cmp(&a.1).then(b.0.cmp(&a.0)));
    let mut restored = 0;
    for (id, _) in ordered {
        let Some(journal) = load(db, id)? else { continue };
        db.execute("DELETE FROM tag_trash WHERE id = ?1", [id])?;
        let trash: HashSet<String> = db.prepare("SELECT DISTINCT name FROM tag_trash")?.query_map([], |r| r.get(0))?.collect::<rusqlite::Result<_>>()?;
        for (name, waiting) in trash_restore::restore(db, &journal, &trash)? {
            // Lignes qui attendent un autre tag de la corbeille : rangées avec lui (le plus récent de ce nom).
            let target: Option<i64> = db.query_row("SELECT id FROM tag_trash WHERE name = ?1 ORDER BY deleted_at DESC, id DESC LIMIT 1", [&name], |r| r.get(0)).optional()?;
            if let Some(target) = target
                && let Some(mut other) = load(db, target)?
            {
                other.carried.push(waiting);
                db.execute("UPDATE tag_trash SET journal = ?2 WHERE id = ?1", params![target, serde_json::to_string(&other)?])?;
            }
        }
        restored += 1;
    }
    Ok(restored)
}

/// Efface ce qui est à la corbeille depuis plus de 30 jours.
pub fn purge(db: &Connection) -> rusqlite::Result<usize> {
    db.execute("DELETE FROM tag_trash WHERE deleted_at < ?1", [db::now_ms() - KEEP_MS])
}

fn with_tx<T>(state: &State<'_, AppState>, f: impl FnOnce(&Connection) -> anyhow::Result<T>) -> Result<T, String> {
    let mut conn = state.db.lock().unwrap();
    (|| -> anyhow::Result<T> {
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let out = f(&tx)?;
        tx.commit()?;
        Ok(out)
    })()
    .map_err(|e| format!("{e:#}"))
}

/// Contenu de la corbeille, les plus récents d'abord.
#[tauri::command]
pub async fn trash_list(state: State<'_, AppState>) -> Result<Vec<TrashTag>, String> {
    let db = state.db.lock().unwrap();
    (|| -> rusqlite::Result<Vec<TrashTag>> { db.prepare(&format!("SELECT {COLUMNS} FROM tag_trash ORDER BY deleted_at DESC, id DESC"))?.query_map([], row)?.collect() })()
        .map_err(|e| e.to_string())
}

/// Le tag de ce nom dans la corbeille (le plus récent), s'il y est : recréer ce nom propose de le restaurer.
#[tauri::command]
pub async fn trash_find(state: State<'_, AppState>, name: String) -> Result<Option<TrashTag>, String> {
    let name = crate::tags::normalize(&name).unwrap_or(name);
    let db = state.db.lock().unwrap();
    db.query_row(&format!("SELECT {COLUMNS} FROM tag_trash WHERE name = ?1 ORDER BY deleted_at DESC, id DESC LIMIT 1"), [name], row)
        .optional()
        .map_err(|e| e.to_string())
}

/// « Restaurer », « Tout restaurer ».
#[tauri::command]
pub async fn trash_restore(state: State<'_, AppState>, ids: Vec<i64>) -> Result<usize, String> {
    with_tx(&state, |db| restore(db, &ids))
}

/// « Supprimer », « Tout supprimer » : effacés pour de bon.
#[tauri::command]
pub async fn trash_delete(state: State<'_, AppState>, ids: Vec<i64>) -> Result<usize, String> {
    with_tx(&state, |db| {
        let mut n = 0;
        for id in ids {
            n += db.execute("DELETE FROM tag_trash WHERE id = ?1", [id])?;
        }
        Ok(n)
    })
}
