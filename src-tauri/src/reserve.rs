//! Réserve des données des médias retirés de la bibliothèque (DEL-05).
//!
//! Un média supprimé sans son fichier laisse ici ses tags, son favori, ses dossiers et sa note,
//! pendant 1 mois (réglable plus tard, SET-15), retrouvés par l'empreinte du fichier. Le média
//! lui-même est réellement supprimé : la réserve ne compte dans aucun compteur ni aucune recherche,
//! et la vider ne change aucun compteur (D-032). Si le fichier est réimporté pendant ce mois, la fin
//! de l'import propose de remettre ses données (`restore_media_data`).
//! Groupes de synonymes (retour T3, point AUT.22) : un tag fusionné est gardé sous son nom d'origine, avec son
//! principal ; le principal reçu seulement par la fusion n'est pas gardé à part. À la restauration : fusion
//! toujours active → le principal, et la note pour la défusion ; tag défusionné → lui-même ; tag supprimé entre-temps
//! → le principal (réponse 6 A du 31/10).

use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

use crate::tagging::{Tagger, resolve, resolve_or_create};
use crate::tags::NewTag;
use crate::{AppState, db};

/// Durée de conservation (1 mois).
const KEEP_MS: i64 = 30 * 24 * 3600 * 1000;

/// Tag gardé : nom et catégorie au moment de la suppression ; `merged` : c'était un tag fusionné.
#[derive(Clone, Debug, Deserialize)]
struct KeptTag {
    name: String,
    category: i64,
    #[serde(default)]
    merged: Option<KeptMerge>,
}

/// Principal d'un tag fusionné gardé, et si le média l'avait par lui-même (note de la défusion).
#[derive(Clone, Debug, Deserialize)]
struct KeptMerge {
    principal: String,
    category: i64,
    had: bool,
}

/// Tag montré dans la pop-in : celui qui sera posé ; `alias` : le tag fusionné d'origine (« kitty → cat »).
#[derive(Clone, Debug, Serialize)]
pub struct ShownTag {
    pub name: String,
    pub category: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alias: Option<String>,
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
    pub tags: Vec<ShownTag>,
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
                (SELECT json_group_array(json_object('name', k.name, 'category', k.category, 'merged', json(k.merged))) FROM (
                   -- Ses tags, sauf un principal qu'il n'a que par la fusion de ses tags (il revient avec eux).
                   SELECT t.name, t.category_id category, NULL merged FROM media_tags mt JOIN tags t ON t.id = mt.tag_id
                    WHERE mt.media_id = m.id
                      AND NOT (EXISTS (SELECT 1 FROM tag_group_media o JOIN tag_group_names n ON n.id = o.name_id JOIN tag_groups g ON g.id = n.group_id
                                        WHERE o.media_id = m.id AND g.principal_id = t.id AND o.had_principal = 0)
                               AND NOT EXISTS (SELECT 1 FROM tag_group_media o JOIN tag_group_names n ON n.id = o.name_id JOIN tag_groups g ON g.id = n.group_id
                                                WHERE o.media_id = m.id AND g.principal_id = t.id AND o.had_principal = 1))
                   UNION ALL
                   -- Ses tags fusionnés, sous leur nom d'origine.
                   SELECT f.name, f.category_id, json_object('principal', p.name, 'category', p.category_id, 'had', json(CASE WHEN o.had_principal THEN 'true' ELSE 'false' END))
                     FROM tag_group_media o JOIN tag_group_names n ON n.id = o.name_id JOIN tags f ON f.id = n.tag_id
                     JOIN tag_groups g ON g.id = n.group_id JOIN tags p ON p.id = g.principal_id
                    WHERE o.media_id = m.id) k),
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
        let tags = parse::<KeptTag>(&tags).into_iter().map(|t| shown(conn, t)).collect::<rusqlite::Result<_>>()?;
        out.push(RestoreCandidate {
            media_id,
            hash,
            file_name,
            deleted_at,
            tags,
            favorite: favorite_at.is_some(),
            folders,
            notes,
        });
    }
    Ok(out)
}

/// Tag fusionné gardé, tel que la restauration le posera : fusion active → le principal (« kitty → cat ») ;
/// défusionné → lui-même ; supprimé entre-temps → le principal gardé.
fn shown(db: &Connection, tag: KeptTag) -> rusqlite::Result<ShownTag> {
    let Some(merged) = tag.merged else { return Ok(ShownTag { name: tag.name, category: tag.category, alias: None }) };
    Ok(match resolve(db, &tag.name)? {
        Some(t) if t.name_id.is_some() => {
            let (name, category) = db.query_row("SELECT name, category_id FROM tags WHERE id = ?1", [t.tag_id], |r| Ok((r.get(0)?, r.get(1)?)))?;
            ShownTag { name, category, alias: Some(tag.name) }
        }
        Some(_) => ShownTag { name: tag.name, category: tag.category, alias: None },
        None => ShownTag { name: merged.principal, category: merged.category, alias: None },
    })
}

/// Catégorie gardée, ou la catégorie par défaut si elle a disparu entre-temps.
fn category(tx: &Connection, id: i64) -> rusqlite::Result<Option<i64>> {
    tx.prepare_cached("SELECT id FROM tag_categories WHERE id = ?1")?.query_row([id], |r| r.get(0)).optional()
}

/// Remet les données d'un média réimporté (dans la transaction de l'appelant). Un tag supprimé
/// entre-temps est recréé avec sa catégorie ; un dossier supprimé entre-temps ne l'est pas.
fn restore_one(tx: &Connection, media_id: i64, now: i64) -> anyhow::Result<()> {
    let Some((_, _, _, favorite_at, notes, tags, folders)) = reserve_of(tx, media_id)? else { return Ok(()) };
    let tagger = Tagger::load(tx)?;
    // Ses tags d'abord (le principal qu'il avait par lui-même compris), puis ses tags fusionnés.
    let (plain, merged): (Vec<KeptTag>, Vec<KeptTag>) = parse::<KeptTag>(&tags).into_iter().partition(|t| t.merged.is_none());
    for tag in plain {
        // Synonymes et parents suivis comme pour tout ajout (TAGM-15, TAGM-16).
        if let Some(target) = resolve_or_create(tx, &NewTag { name: tag.name, category_id: category(tx, tag.category)? }, now)? {
            tagger.attach(tx, media_id, target)?;
        }
    }
    for tag in merged {
        let Some(m) = tag.merged else { continue };
        match resolve(tx, &tag.name)? {
            Some(target) => {
                tagger.attach(tx, media_id, target)?;
                // Fusion toujours active : la note de la défusion reprend ce que le média avait avant (et non « déjà
                // posé » par un autre de ses tags fusionnés restauré juste avant).
                if let Some(name) = target.name_id {
                    tx.execute("UPDATE tag_group_media SET had_principal = ?3 WHERE name_id = ?1 AND media_id = ?2", params![name, media_id, m.had])?;
                }
            }
            None => {
                if let Some(target) = resolve_or_create(tx, &NewTag { name: m.principal, category_id: category(tx, m.category)? }, now)? {
                    tagger.attach(tx, media_id, target)?;
                }
            }
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
            let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
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
