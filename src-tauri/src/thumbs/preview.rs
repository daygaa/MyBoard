//! Grands aperçus à la demande (LIB-09, LIB-10, LIB-16) : 640 px, et 1 280 px pour les vignettes
//! encore plus grandes (écrans 4K et 5K).
//!
//! L'interface demande l'aperçu d'une vignette restée visible ~150 ms et annule la demande
//! si la vignette sort de l'écran avant. Deux fils de travail en priorité basse fabriquent les
//! aperçus ; la petite miniature reste affichée en attendant. Le cache, commun aux deux tailles,
//! est limité : au-delà, les aperçus les moins récemment demandés sont supprimés.

use std::collections::{HashSet, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Condvar, Mutex};

use rusqlite::{Connection, OptionalExtension, params_from_iter};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use super::image::{LARGE_SIZE, PREVIEW_SIZE};
use super::store::Tier;
use super::{ThumbService, lower_thread_priority, make_preview, status, store};
use crate::db;

/// Fils de fabrication : peu, pour ne jamais ralentir l'interface.
const WORKERS: usize = 2;
/// Taille maximale du cache des aperçus (LIB-10 ; réglable plus tard dans les paramètres, LIB-11).
const CACHE_LIMIT: i64 = 1 << 30; // 1 Go
/// Après un nettoyage, le cache redescend à 90 % de la limite (évite de nettoyer à chaque ajout).
const CACHE_TARGET: i64 = CACHE_LIMIT / 10 * 9;

/// Un aperçu : un média et sa taille (640 ou 1 280 px).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PreviewKey {
    pub id: i64,
    pub size: u32,
}

impl PreviewKey {
    /// Table de rangement ; `None` pour une taille inconnue (demande ignorée).
    fn tier(self) -> Option<Tier> {
        match self.size {
            PREVIEW_SIZE => Some(Tier::Preview),
            LARGE_SIZE => Some(Tier::Large),
            _ => None,
        }
    }
}

#[derive(Default)]
struct Queue {
    order: VecDeque<PreviewKey>,
    /// Demandes encore valables (une annulation retire la clé d'ici).
    wanted: HashSet<PreviewKey>,
    /// Aperçus impossibles à fabriquer (fichier introuvable…) : pas de nouvel essai.
    failed: HashSet<PreviewKey>,
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

    /// Aperçus effacés avec leurs médias (DEL-02) : la taille connue du cache diminue d'autant.
    pub fn forget(&self, bytes: i64) {
        let mut size = self.inner.cache_bytes.lock().unwrap();
        *size = (*size - bytes).max(0);
    }

    /// Fichiers revus (réimportés, emplacement rebranché, LIB-05, LIB-14) : les aperçus ratés seront réessayés.
    pub fn retry_failed(&self) {
        self.inner.queue.lock().unwrap().failed.clear();
    }

    /// Plus grande image déjà faite pour ce média (visionneuse d'un fichier introuvable, retour du 11/11) : 1 280,
    /// 640, 320 ou 128 px (un grand aperçu montré est marqué comme utilisé : il reste en cache).
    pub fn best(&self, hash: &str) -> anyhow::Result<Option<&'static str>> {
        let store = self.inner.store.lock().unwrap();
        for (tier, name) in [(Tier::Large, "large"), (Tier::Preview, "preview")] {
            if store::touch_preview(&store, tier, hash, db::now_ms())? {
                return Ok(Some(name));
            }
        }
        for (tier, name) in [(Tier::Normal, "normal"), (Tier::Small, "small")] {
            if store::get(&store, tier, hash)?.is_some() {
                return Ok(Some(name));
            }
        }
        Ok(None)
    }

    /// `want` : vignettes visibles depuis ~150 ms ; `cancel` : vignettes sorties de l'écran.
    pub fn request(&self, want: &[PreviewKey], cancel: &[PreviewKey]) -> anyhow::Result<()> {
        let inner = &self.inner;
        let mut queue = inner.queue.lock().unwrap();
        for key in cancel {
            queue.wanted.remove(key);
        }
        let candidates: Vec<PreviewKey> = want.iter().copied().filter(|k| k.tier().is_some() && !queue.failed.contains(k)).collect();
        drop(queue);
        if candidates.is_empty() {
            return Ok(());
        }

        // Seuls les médias dont la miniature est prête ont un aperçu (images et vidéos).
        let hashes: Vec<(i64, String)> = {
            let db = inner.db.lock().unwrap();
            let ids: Vec<i64> = candidates.iter().map(|k| k.id).collect();
            let marks = vec!["?"; ids.len()].join(",");
            let sql = format!("SELECT id, hash FROM media WHERE thumb_status = {} AND id IN ({marks})", status::READY);
            let mut stmt = db.prepare(&sql)?;
            stmt.query_map(params_from_iter(&ids), |r| Ok((r.get(0)?, r.get(1)?)))?
                .collect::<Result<_, _>>()?
        };

        // Déjà en cache : prêt tout de suite (et marqué comme récemment utilisé).
        let now = db::now_ms();
        let mut ready = Vec::new();
        let mut missing = Vec::new();
        {
            let store = inner.store.lock().unwrap();
            for key in candidates {
                let (Some(tier), Some((_, hash))) = (key.tier(), hashes.iter().find(|(id, _)| *id == key.id)) else { continue };
                if store::touch_preview(&store, tier, hash, now)? {
                    ready.push(key);
                } else {
                    missing.push(key);
                }
            }
        }
        if !ready.is_empty() {
            let _ = inner.app.emit("previews-ready", ready);
        }
        if !missing.is_empty() {
            let mut queue = inner.queue.lock().unwrap();
            for key in missing {
                if queue.wanted.insert(key) {
                    queue.order.push_back(key);
                }
            }
            inner.wake.notify_all();
        }
        Ok(())
    }
}

/// Plus grande miniature d'un média introuvable ou inaccessible (`PreviewService::best`) : sa taille pour `thumb://`.
#[tauri::command]
pub fn best_thumb(state: tauri::State<'_, crate::AppState>, hash: String) -> Result<Option<String>, String> {
    state.previews.best(&hash).map(|t| t.map(str::to_owned)).map_err(|e| format!("{e:#}"))
}

fn worker_loop(inner: &Inner) {
    lower_thread_priority();
    loop {
        let key = next_job(inner);
        let made = fabricate(inner, key);
        let mut queue = inner.queue.lock().unwrap();
        queue.wanted.remove(&key);
        match made {
            Ok(()) => {
                drop(queue);
                let _ = inner.app.emit("previews-ready", vec![key]);
            }
            Err(e) => {
                queue.failed.insert(key);
                eprintln!("[aperçus] média {} ({} px) : {e:#}", key.id, key.size);
            }
        }
    }
}

/// Prochaine demande encore valable (les demandes annulées sont sautées).
fn next_job(inner: &Inner) -> PreviewKey {
    let mut queue = inner.queue.lock().unwrap();
    loop {
        while let Some(key) = queue.order.pop_front() {
            if queue.wanted.contains(&key) {
                return key;
            }
        }
        queue = inner.wake.wait(queue).unwrap();
    }
}

fn fabricate(inner: &Inner, key: PreviewKey) -> anyhow::Result<()> {
    let Some(tier) = key.tier() else { return Ok(()) };
    let row: Option<(String, String, String)> = inner
        .db
        .lock()
        .unwrap()
        .query_row("SELECT hash, path, kind FROM media WHERE id = ?1", [key.id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
        .optional()?;
    let Some((hash, path, kind)) = row else { return Ok(()) };
    let data = make_preview(inner.thumbs.ffmpeg(), &kind, &PathBuf::from(path), key.size)?;

    let store = inner.store.lock().unwrap();
    store::put_preview(&store, tier, &hash, &data, db::now_ms())?;
    let mut size = inner.cache_bytes.lock().unwrap();
    *size += data.len() as i64;
    if *size > CACHE_LIMIT {
        *size = store::evict_previews(&store, *size, CACHE_TARGET)?;
    }
    Ok(())
}
