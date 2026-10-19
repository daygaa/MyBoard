//! Suppression de médias (DEL-01 à DEL-04).
//!
//! « Supprimer » marque les médias dans UNE transaction (`media.pending_delete`) et rend la main :
//! ils disparaissent aussitôt de toutes les pages (DEL-01). Un fil en arrière-plan, en priorité
//! basse, les retire ensuite réellement (DEL-02) ; marqués en base, ils sont repris au lancement
//! suivant si MyBoard a été fermé entre-temps (DEL-03).
//!
//! Deux sortes (DEL-04) : 1 = retiré de la bibliothèque, fichier intact, données gardées en réserve
//! (DEL-05, `reserve.rs`) ; 2 = fichier effacé définitivement (sans la Corbeille) puis données
//! effacées. Un fichier impossible à effacer (ouvert ailleurs, lecture seule, disque débranché) :
//! son média revient dans la bibliothèque avec toutes ses données, et l'interface reçoit la liste
//! des échecs (`deletion-failed`). Vignette et miniatures sont effacées dans les deux cas.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Condvar, Mutex};
use std::time::Duration;

use rusqlite::{Connection, params, params_from_iter};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::thumbs::preview::PreviewService;
use crate::thumbs::store::PREVIEW_TABLES;
use crate::{AppState, db, reserve};

/// Médias traités par passage : un lot = une transaction.
const BATCH: usize = 500;
/// Sortes de suppression (`media.pending_delete`).
const LIBRARY_ONLY: i64 = 1;
const WITH_FILE: i64 = 2;
/// Le fil se réveille au moins une fois par heure pour vider la réserve des données trop anciennes.
const PURGE_EVERY: Duration = Duration::from_secs(3600);

/// Événements envoyés à l'interface.
pub const EVENT_DELETED: &str = "media-deleted";
pub const EVENT_FAILED: &str = "deletion-failed";

/// Fichier qui n'a pas pu être effacé : son média est revenu dans la bibliothèque.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FailedFile {
    pub id: i64,
    pub path: String,
    /// Code d'erreur Windows, quand il est connu (VIEW-28).
    pub code: Option<i32>,
    pub message: String,
}

struct Inner {
    app: AppHandle,
    db: Mutex<Connection>,
    store: Mutex<Connection>,
    previews: PreviewService,
    work: Mutex<bool>,
    wake: Condvar,
}

#[derive(Clone)]
pub struct DeletionService {
    inner: Arc<Inner>,
}

impl DeletionService {
    pub fn start(app: AppHandle, db_path: &Path, thumbs_db: &Path, previews: PreviewService) -> anyhow::Result<Self> {
        let inner = Arc::new(Inner {
            app,
            db: Mutex::new(db::open(db_path)?),
            store: Mutex::new(crate::thumbs::store::open_writer(thumbs_db)?),
            previews,
            // Au lancement : reprise des suppressions interrompues (DEL-03).
            work: Mutex::new(true),
            wake: Condvar::new(),
        });
        let worker = inner.clone();
        std::thread::Builder::new().name("suppression".into()).spawn(move || worker_loop(&worker))?;
        Ok(Self { inner })
    }

    fn wake(&self) {
        *self.inner.work.lock().unwrap() = true;
        self.inner.wake.notify_all();
    }
}

fn worker_loop(inner: &Inner) {
    crate::thumbs::lower_thread_priority();
    loop {
        if let Err(e) = reserve::purge(&inner.db.lock().unwrap()) {
            eprintln!("[suppression] réserve : {e:#}");
        }
        loop {
            match process_batch(inner) {
                Ok(true) => continue,
                Ok(false) => break,
                Err(e) => {
                    eprintln!("[suppression] {e:#}");
                    break;
                }
            }
        }
        let mut work = inner.work.lock().unwrap();
        if !*work {
            work = inner.wake.wait_timeout(work, PURGE_EVERY).unwrap().0;
        }
        *work = false;
    }
}

struct Pending {
    id: i64,
    hash: String,
    path: String,
    mode: i64,
}

/// Un lot de médias marqués ; `false` s'il n'y en avait plus.
fn process_batch(inner: &Inner) -> anyhow::Result<bool> {
    let batch: Vec<Pending> = {
        let db = inner.db.lock().unwrap();
        let mut stmt = db.prepare_cached("SELECT id, hash, path, pending_delete FROM media WHERE pending_delete != 0 LIMIT ?1")?;
        stmt.query_map([BATCH as i64], |r| Ok(Pending { id: r.get(0)?, hash: r.get(1)?, path: r.get(2)?, mode: r.get(3)? }))?
            .collect::<Result<_, _>>()?
    };
    if batch.is_empty() {
        return Ok(false);
    }

    // Fichiers d'abord (hors transaction : un fichier effacé ne revient pas). Déjà absent : rien à
    // effacer, le média part quand même.
    let mut failed = Vec::new();
    let mut removed = Vec::new();
    for item in batch {
        if item.mode == WITH_FILE
            && let Err(e) = std::fs::remove_file(PathBuf::from(&item.path))
            && e.kind() != std::io::ErrorKind::NotFound
        {
            let text = e.to_string();
            let message = text.split(" (os error").next().unwrap_or(&text).trim().to_string();
            failed.push(FailedFile { id: item.id, path: item.path.clone(), code: e.raw_os_error(), message });
            continue;
        }
        removed.push(item);
    }

    // Base : une seule transaction pour tout le lot (D-005). Les déclencheurs mettent à jour les
    // compteurs des tags et des dossiers, et la génération de l'index de recherche.
    {
        let mut db = inner.db.lock().unwrap();
        let tx = db.transaction()?;
        let now = db::now_ms();
        for f in &failed {
            tx.execute("UPDATE media SET pending_delete = 0 WHERE id = ?1", [f.id])?;
        }
        for item in &removed {
            if item.mode == LIBRARY_ONLY {
                reserve::keep(&tx, item.id, now)?;
            } else {
                tx.execute("DELETE FROM media_reserve WHERE hash = ?1", [&item.hash])?;
            }
            tx.execute("DELETE FROM media WHERE id = ?1", [item.id])?;
        }
        tx.commit()?;
    }
    forget_thumbs(inner, &removed)?;

    let ids: Vec<i64> = removed.iter().map(|i| i.id).collect();
    let _ = inner.app.emit(EVENT_DELETED, ids);
    if !failed.is_empty() {
        let _ = inner.app.emit(EVENT_FAILED, failed);
    }
    Ok(true)
}

/// Vignette, miniature 128 px et grands aperçus des médias supprimés (une transaction).
fn forget_thumbs(inner: &Inner, removed: &[Pending]) -> anyhow::Result<()> {
    if removed.is_empty() {
        return Ok(());
    }
    let hashes: Vec<&str> = removed.iter().map(|i| i.hash.as_str()).collect();
    let marks = vec!["?"; hashes.len()].join(",");
    let mut store = inner.store.lock().unwrap();
    let tx = store.transaction()?;
    let mut preview_bytes = 0;
    for table in PREVIEW_TABLES {
        preview_bytes += tx.query_row(
            &format!("SELECT COALESCE(SUM(bytes), 0) FROM {table} WHERE hash IN ({marks})"),
            params_from_iter(&hashes),
            |r| r.get::<_, i64>(0),
        )?;
    }
    for table in ["thumbs", "thumbs_small"].into_iter().chain(PREVIEW_TABLES) {
        tx.execute(&format!("DELETE FROM {table} WHERE hash IN ({marks})"), params_from_iter(&hashes))?;
    }
    tx.commit()?;
    inner.previews.forget(preview_bytes);
    Ok(())
}

// --- Commande appelée par l'interface ---

/// Marque les médias à supprimer (DEL-01) ; `delete_files` : effacer aussi leurs fichiers (DEL-04).
#[tauri::command]
pub async fn delete_media(state: State<'_, AppState>, ids: Vec<i64>, delete_files: bool) -> Result<(), String> {
    if ids.is_empty() {
        return Ok(());
    }
    let mode = if delete_files { WITH_FILE } else { LIBRARY_ONLY };
    {
        let mut db = state.db.lock().unwrap();
        (|| -> rusqlite::Result<()> {
            let tx = db.transaction()?;
            {
                let mut stmt = tx.prepare_cached("UPDATE media SET pending_delete = ?1 WHERE id = ?2 AND pending_delete = 0")?;
                for id in &ids {
                    stmt.execute(params![mode, id])?;
                }
            }
            tx.commit()
        })()
        .map_err(|e| e.to_string())?;
    }
    state.deletion.wake();
    Ok(())
}
