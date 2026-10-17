//! Réserve des données des médias retirés de la bibliothèque (DEL-05).
//!
//! Un média supprimé sans son fichier laisse ici ses tags, son favori, ses dossiers et sa note,
//! pendant 1 mois (réglable plus tard, SET-15), retrouvés par l'empreinte du fichier. Le média
//! lui-même est réellement supprimé : la réserve ne compte dans aucun compteur ni aucune recherche,
//! et la vider ne change aucun compteur (D-032). Si le fichier est réimporté pendant ce mois, la fin
//! de l'import propose de remettre ses données (`restore_media_data`).

use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

use crate::tags::{self, NewTag};
use crate::{AppState, db};

/// Durée de conservation (1 mois).
const KEEP_MS: i64 = 30 * 24 * 3600 * 1000;

/// Tag gardé : nom et catégorie au moment de la suppression.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct KeptTag {
    pub name: String,
    pub category: i64,
}

/// Dossier gardé ; `created` le distingue d'un dossier créé plus tard avec le même identifiant.
#[derive(Debug, Deserialize)]
struct KeptFolder {
    id: i64,
    name: String,
    created: i64,
    added: i64,
}

/// Dossier d'un média retrouvé, pour la pop-in : existe-t-il encore ?
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderInfo {
    pub name: String,
    pub exists: bool,
}

/// Média réimporté dont les données sont dans la réserve.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreCandidate {
    pub media_id: i64,
    pub hash: String,
    pub file_name: String,
    pub deleted_at: i64,
    pub tags: Vec<KeptTag>,
    pub favorite: bool,
    pub folders: Vec<FolderInfo>,
    pub notes: Option<String>,
}

/// Range les données du média dans la réserve, juste avant sa suppression (même transaction).
pub fn keep(tx: &Connection, media_id: i64, now: i64) -> rusqlite::Result<()> {
    tx.prepare_cached(
        "INSERT OR REPLACE INTO media_reserve (hash, file_name, path, deleted_at, favorite_at, notes, tags, folders)
         SELECT m.hash, m.file_name, m.path, ?2,
                (SELECT added_at FROM favorites WHERE media_id = m.id),
                m.notes,
                (SELECT json_group_array(json_object('name', t.name, 'category', t.category_id))
                   FROM media_tags mt JOIN tags t ON t.id = mt.tag_id WHERE mt.media_id = m.id),
                (SELECT json_group_array(json_object('id', f.id, 'name', f.name, 'created', f.created_at, 'added', fm.added_at))
                   FROM folder_media fm JOIN folders f ON f.id = fm.folder_id WHERE fm.media_id = m.id)
         FROM media m WHERE m.id = ?1",
    )?
    .execute(params![media_id, now])?;
    Ok(())
}

/// Efface les données gardées depuis plus d'un mois (aucun compteur ne bouge).
pub fn purge(db: &Connection) -> rusqlite::Result<usize> {
    db.execute("DELETE FROM media_reserve WHERE deleted_at < ?1", [db::now_ms() - KEEP_MS])
}

/// Le média qui vient d'être importé a-t-il des données en réserve ?
pub fn has_kept(conn: &Connection, media_id: i64) -> rusqlite::Result<bool> {
    conn.prepare_cached("SELECT EXISTS (SELECT 1 FROM media_reserve r JOIN media m ON m.hash = r.hash WHERE m.id = ?1)")?
        .query_row([media_id], |r| r.get(0))
}

fn folder_exists(conn: &Connection, folder: &KeptFolder) -> rusqlite::Result<bool> {
    conn.prepare_cached("SELECT EXISTS (SELECT 1 FROM folders WHERE id = ?1 AND created_at = ?2)")?
        .query_row(params![folder.id, folder.created], |r| r.get(0))
}

type ReserveRow = (String, String, i64, Option<i64>, Option<String>, String, String);

fn reserve_of(conn: &Connection, media_id: i64) -> rusqlite::Result<Option<ReserveRow>> {
    conn.prepare_cached(
        "SELECT r.hash, m.file_name, r.deleted_at, r.favorite_at, r.notes, r.tags, r.folders
         FROM media_reserve r JOIN media m ON m.hash = r.hash WHERE m.id = ?1",
    )?
    .query_row([media_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?)))
    .optional()
}

fn parse<T: for<'de> Deserialize<'de>>(json: &str) -> Vec<T> {
    serde_json::from_str(json).unwrap_or_default()
}

/// Pop-in de fin d'import : médias retrouvés et leurs données gardées.
pub fn candidates(conn: &Connection, media_ids: &[i64]) -> rusqlite::Result<Vec<RestoreCandidate>> {
    let mut out = Vec::new();
    for &media_id in media_ids {
        let Some((hash, file_name, deleted_at, favorite_at, notes, tags, folders)) = reserve_of(conn, media_id)? else { continue };
        let folders = parse::<KeptFolder>(&folders)
            .into_iter()
            .map(|f| Ok(FolderInfo { exists: folder_exists(conn, &f)?, name: f.name }))
            .collect::<rusqlite::Result<_>>()?;
        out.push(RestoreCandidate {
            media_id,
            hash,
            file_name,
            deleted_at,
            tags: parse(&tags),
            favorite: favorite_at.is_some(),
            folders,
            notes,
        });
    }
    Ok(out)
}

/// Remet les données d'un média réimporté (dans la transaction de l'appelant). Un tag supprimé
/// entre-temps est recréé avec sa catégorie ; un dossier supprimé entre-temps ne l'est pas.
fn restore_one(tx: &Connection, media_id: i64, now: i64) -> anyhow::Result<()> {
    let Some((_, _, _, favorite_at, notes, tags, folders)) = reserve_of(tx, media_id)? else { return Ok(()) };
    for tag in parse::<KeptTag>(&tags) {
        // Catégorie disparue entre-temps : catégorie par défaut.
        let category: Option<i64> = tx
            .prepare_cached("SELECT id FROM tag_categories WHERE id = ?1")?
            .query_row([tag.category], |r| r.get(0))
            .optional()?;
        if let Some(tag_id) = tags::get_or_create(tx, &NewTag { name: tag.name, category_id: category }, now)? {
            tags::attach(tx, media_id, tag_id)?;
        }
    }
    if let Some(at) = favorite_at {
        tx.execute("INSERT OR IGNORE INTO favorites (media_id, added_at) VALUES (?1, ?2)", params![media_id, at])?;
    }
    for folder in parse::<KeptFolder>(&folders) {
        if folder_exists(tx, &folder)? {
            tx.execute(
                "INSERT OR IGNORE INTO folder_media (folder_id, media_id, added_at) VALUES (?1, ?2, ?3)",
                params![folder.id, media_id, folder.added],
            )?;
        }
    }
    if notes.is_some() {
        tx.execute("UPDATE media SET notes = ?1 WHERE id = ?2", params![notes, media_id])?;
    }
    Ok(())
}

fn forget(tx: &Connection, media_id: i64) -> rusqlite::Result<()> {
    tx.execute("DELETE FROM media_reserve WHERE hash = (SELECT hash FROM media WHERE id = ?1)", [media_id])?;
    Ok(())
}

// --- Commande appelée par l'interface ---

/// Réponse à la pop-in de fin d'import (DEL-05) : `restore` = médias dont les données reviennent,
/// `discard` = les autres (leur réserve est effacée). Une seule transaction.
#[tauri::command]
pub async fn restore_media_data(app: AppHandle, state: State<'_, AppState>, restore: Vec<i64>, discard: Vec<i64>) -> Result<(), String> {
    {
        let mut conn = state.db.lock().unwrap();
        (|| -> anyhow::Result<()> {
            let tx = conn.transaction()?;
            let now = db::now_ms();
            for &id in &restore {
                restore_one(&tx, id, now)?;
                forget(&tx, id)?;
            }
            for &id in &discard {
                forget(&tx, id)?;
            }
            tx.commit()?;
            Ok(())
        })()
        .map_err(|e| format!("{e:#}"))?;
    }
    state.import.clear_restorable();
    let _ = app.emit("library-changed", ());
    Ok(())
}
