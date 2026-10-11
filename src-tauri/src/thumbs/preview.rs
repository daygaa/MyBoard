//! Grands aperçus 640 px à la demande, pour les grilles de 4 à 6 colonnes (LIB-09, LIB-10).
//!
//! L'interface demande l'aperçu d'une vignette restée visible ~150 ms et annule la demande
//! si la vignette sort de l'écran avant. Deux fils de travail en priorité basse fabriquent les
//! aperçus ; la petite miniature reste affichée en attendant. Le cache est limité : au-delà,
//! les aperçus les moins récemment demandés sont supprimés.

use std::collections::{HashSet, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Condvar, Mutex};

use rusqlite::{Connection, OptionalExtension, params_from_iter};
use tauri::{AppHandle, Emitter};

use super::{ThumbService, lower_thread_priority, make_preview, status, store};
use crate::db;

/// Fils de fabrication : peu, pour ne jamais ralentir l'interface.
const WORKERS: usize = 2;
/// Taille maximale du cache des aperçus (LIB-10 ; réglable plus tard dans les paramètres, LIB-11).
const CACHE_LIMIT: i64 = 1 << 30; // 1 Go
/// Après un nettoyage, le cache redescend à 90 % de la limite (évite de nettoyer à chaque ajout).
const CACHE_TARGET: i64 = CACHE_LIMIT / 10 * 9;

#[derive(Default)]
struct Queue {
    order: VecDeque<i64>,
    /// Demandes encore valables (une annulation retire l'id d'ici).
    wanted: HashSet<i64>,
    /// Aperçus impossibles à fabriquer (fichier introuvable…) : pas de nouvel essai.
    failed: HashSet<i64>,
}

struct Inner {
    app: AppHandle,
    thumbs: ThumbService,
    db: Mutex<Connection>,
    store: Mutex<Connection>,
    queue: Mutex<Queue>,
    wake: Condvar,
    cache_bytes: Mutex<i64>,
}

#[derive(Clone)]
pub struct PreviewService {
    inner: Arc<Inner>,
}

impl PreviewService {
    pub fn start(app: AppHandle, thumbs: ThumbService, db_path: &Path, thumbs_db: &Path) -> anyhow::Result<Self> {
        let store = store::open_writer(thumbs_db)?;
        let cache_bytes = store::previews_size(&store)?;
        let inner = Arc::new(Inner {
            app,
            thumbs,
            db: Mutex::new(db::open(db_path)?),
            store: Mutex::new(store),
            queue: Mutex::new(Queue::default()),
            wake: Condvar::new(),
            cache_bytes: Mutex::new(cache_bytes),
        });
        for index in 0..WORKERS {
            let inner = inner.clone();
            std::thread::Builder::new()
                .name(format!("apercus-{index}"))
                .spawn(move || worker_loop(&inner))?;
        }
        Ok(Self { inner })
    }

    /// `want` : vignettes visibles depuis ~150 ms ; `cancel` : vignettes sorties de l'écran.
    pub fn request(&self, want: &[i64], cancel: &[i64]) -> anyhow::Result<()> {
        let inner = &self.inner;
        let mut queue = inner.queue.lock().unwrap();
        for id in cancel {
            queue.wanted.remove(id);
        }
        let candidates: Vec<i64> = want.iter().copied().filter(|id| !queue.failed.contains(id)).collect();
        drop(queue);
        if candidates.is_empty() {
            return Ok(());
        }

        // Seuls les médias dont la miniature est prête ont un aperçu (images et vidéos).
        let rows: Vec<(i64, String)> = {
            let db = inner.db.lock().unwrap();
            let marks = vec!["?"; candidates.len()].join(",");
            let sql = format!("SELECT id, hash FROM media WHERE thumb_status = {} AND id IN ({marks})", status::READY);
            let mut stmt = db.prepare(&sql)?;
            stmt.query_map(params_from_iter(&candidates), |r| Ok((r.get(0)?, r.get(1)?)))?
                .collect::<Result<_, _>>()?
        };

        // Déjà en cache : prêt tout de suite (et marqué comme récemment utilisé).
        let now = db::now_ms();
        let mut ready = Vec::new();
        let mut missing = Vec::new();
        {
            let store = inner.store.lock().unwrap();
            for (id, hash) in rows {
                if store::touch_preview(&store, &hash, now)? {
                    ready.push(id);
                } else {
                    missing.push(id);
                }
            }
        }
        if !ready.is_empty() {
            let _ = inner.app.emit("previews-ready", ready);
        }
        if !missing.is_empty() {
            let mut queue = inner.queue.lock().unwrap();
            for id in missing {
                if queue.wanted.insert(id) {
                    queue.order.push_back(id);
                }
            }
            inner.wake.notify_all();
        }
        Ok(())
    }
}

fn worker_loop(inner: &Inner) {
    lower_thread_priority();
    loop {
        let id = next_job(inner);
        let made = fabricate(inner, id);
        let mut queue = inner.queue.lock().unwrap();
        queue.wanted.remove(&id);
        match made {
            Ok(()) => {
                drop(queue);
                let _ = inner.app.emit("previews-ready", vec![id]);
            }
            Err(e) => {
                queue.failed.insert(id);
                eprintln!("[aperçus] média {id} : {e:#}");
            }
        }
    }
}

/// Prochaine demande encore valable (les demandes annulées sont sautées).
fn next_job(inner: &Inner) -> i64 {
    let mut queue = inner.queue.lock().unwrap();
    loop {
        while let Some(id) = queue.order.pop_front() {
            if queue.wanted.contains(&id) {
                return id;
            }
        }
        queue = inner.wake.wait(queue).unwrap();
    }
}

fn fabricate(inner: &Inner, id: i64) -> anyhow::Result<()> {
    let row: Option<(String, String, String)> = inner
        .db
        .lock()
        .unwrap()
        .query_row("SELECT hash, path, kind FROM media WHERE id = ?1", [id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
        .optional()?;
    let Some((hash, path, kind)) = row else { return Ok(()) };
    let data = make_preview(inner.thumbs.ffmpeg(), &kind, &PathBuf::from(path))?;

    let store = inner.store.lock().unwrap();
    store::put_preview(&store, &hash, &data, db::now_ms())?;
    let mut size = inner.cache_bytes.lock().unwrap();
    *size += data.len() as i64;
    if *size > CACHE_LIMIT {
        *size = store::evict_previews(&store, *size, CACHE_TARGET)?;
    }
    Ok(())
}
