//! Service des miniatures en arrière-plan (LIB-06, D-011).
//!
//! Plusieurs fils de travail prennent les médias « à faire » dans la base, les plus
//! récents d'abord, et ceux de la page affichée en priorité. L'import n'attend
//! jamais : il réveille simplement le service après chaque lot enregistré.
//! L'interface est prévenue par lots (`thumbs-ready`) : seules les vignettes
//! concernées se redessinent. Les miniatures sont rangées dans `thumbs.db` (D-014).

mod image;
mod video;

pub mod protocol;
pub mod store;

use std::collections::{HashSet, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Condvar, Mutex, OnceLock};
use std::time::{Duration, Instant};

use rusqlite::{Connection, OptionalExtension, params_from_iter};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::ffmpeg::{self, Ffmpeg};

pub use image::THUMB_SIZE;

/// Valeurs de `media.thumb_status`.
pub mod status {
    pub const TODO: i64 = 0;
    pub const READY: i64 = 1;
    pub const ERROR: i64 = 2;
    pub const NONE: i64 = 3;
    pub const NO_FFMPEG: i64 = 4;
}

/// Regroupement des notifications vers l'interface.
const EMIT_INTERVAL: Duration = Duration::from_millis(200);
/// Médias chargés depuis la base à chaque remplissage de la file.
const BATCH: usize = 64;

/// Résultat envoyé à l'interface pour une vignette.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbUpdate {
    pub id: i64,
    pub status: i64,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub duration_ms: Option<i64>,
}

#[derive(Clone)]
struct Job {
    id: i64,
    hash: String,
    path: PathBuf,
    kind: String,
}

#[derive(Default)]
struct Queue {
    priority: VecDeque<Job>,
    batch: VecDeque<Job>,
    in_flight: HashSet<i64>,
    /// La base n'avait plus rien à faire au dernier remplissage.
    exhausted: bool,
}

struct Pending {
    updates: Vec<ThumbUpdate>,
    last_emit: Instant,
}

struct Shared {
    app: AppHandle,
    db: Mutex<Connection>,
    /// Fichier des miniatures (écriture).
    store: Mutex<Connection>,
    ffmpeg: OnceLock<Option<Ffmpeg>>,
    queue: Mutex<Queue>,
    wake: Condvar,
    pending: Mutex<Pending>,
}

#[derive(Clone)]
pub struct ThumbService {
    shared: Arc<Shared>,
}

impl ThumbService {
    /// Démarre le service avec ses propres connexions à la base et au fichier des miniatures.
    pub fn start(app: AppHandle, db_path: &Path, thumbs_db: &Path) -> anyhow::Result<Self> {
        let store_existed = thumbs_db.exists();
        let db = crate::db::open(db_path)?;
        if !store_existed {
            // Fichier des miniatures absent (supprimé, ou première version) : tout est à refaire.
            db.execute(
                "UPDATE media SET thumb_status = ?1 WHERE thumb_status IN (?2, ?3)",
                [status::TODO, status::READY, status::ERROR],
            )?;
        }
        let shared = Arc::new(Shared {
            app,
            db: Mutex::new(db),
            store: Mutex::new(store::open_writer(thumbs_db)?),
            ffmpeg: OnceLock::new(),
            queue: Mutex::new(Queue::default()),
            wake: Condvar::new(),
            pending: Mutex::new(Pending { updates: Vec::new(), last_emit: Instant::now() }),
        });
        let service = Self { shared: shared.clone() };

        // La détection de ffmpeg lance des processus : on ne retarde pas l'ouverture de la fenêtre.
        std::thread::Builder::new().name("miniatures-demarrage".into()).spawn(move || {
            let found = shared.ffmpeg.get_or_init(ffmpeg::detect).is_some();
            if found {
                // ffmpeg installé depuis le dernier lancement : on retente les vidéos en attente.
                let db = shared.db.lock().unwrap();
                let _ = db.execute(
                    "UPDATE media SET thumb_status = ?1 WHERE thumb_status = ?2",
                    [status::TODO, status::NO_FFMPEG],
                );
            }
            let workers = std::thread::available_parallelism().map_or(2, |n| n.get() / 2).clamp(1, 6);
            for index in 0..workers {
                let shared = shared.clone();
                let _ = std::thread::Builder::new()
                    .name(format!("miniatures-{index}"))
                    .spawn(move || worker_loop(&shared));
            }
        })?;
        Ok(service)
    }

    /// ffmpeg détecté (attend la fin de la détection si elle est en cours).
    pub fn ffmpeg(&self) -> Option<&Ffmpeg> {
        self.shared.ffmpeg.get_or_init(ffmpeg::detect).as_ref()
    }

    /// De nouveaux médias attendent une miniature (appelé par l'import).
    pub fn wake(&self) {
        let mut queue = self.shared.queue.lock().unwrap();
        queue.exhausted = false;
        self.shared.wake.notify_all();
    }

    /// Fait passer en premier les médias de la page affichée (remplace la priorité précédente).
    pub fn prioritize(&self, ids: &[i64]) -> anyhow::Result<()> {
        if ids.is_empty() {
            return Ok(());
        }
        let jobs = {
            let db = self.shared.db.lock().unwrap();
            let marks = vec!["?"; ids.len()].join(",");
            let sql = format!(
                "SELECT id, hash, path, kind FROM media WHERE thumb_status = {} AND id IN ({marks})",
                status::TODO
            );
            let mut stmt = db.prepare(&sql)?;
            let rows = stmt.query_map(params_from_iter(ids), job_from_row)?;
            rows.collect::<Result<Vec<_>, _>>()?
        };
        let mut queue = self.shared.queue.lock().unwrap();
        queue.priority = jobs.into();
        queue.exhausted = false;
        self.shared.wake.notify_all();
        Ok(())
    }
}

fn job_from_row(row: &rusqlite::Row) -> rusqlite::Result<Job> {
    Ok(Job {
        id: row.get(0)?,
        hash: row.get(1)?,
        path: PathBuf::from(row.get::<_, String>(2)?),
        kind: row.get(3)?,
    })
}

fn worker_loop(shared: &Shared) {
    lower_thread_priority();
    loop {
        let job = next_job(shared);
        let update = process(shared, &job);
        finish(shared, job.id, update);
    }
}

/// Prochain média à traiter : la priorité d'abord, puis la file chargée depuis la base.
fn next_job(shared: &Shared) -> Job {
    let mut queue = shared.queue.lock().unwrap();
    loop {
        let next = match queue.priority.pop_front() {
            Some(job) => Some(job),
            None => queue.batch.pop_front(),
        };
        if let Some(job) = next {
            if queue.in_flight.insert(job.id) {
                return job;
            }
            continue; // déjà pris par un autre fil
        }
        if !queue.exhausted {
            let jobs = load_todo(shared, &queue.in_flight).unwrap_or_default();
            if jobs.is_empty() {
                queue.exhausted = true;
                flush(shared, true);
            } else {
                queue.batch.extend(jobs);
            }
            continue;
        }
        queue = shared.wake.wait(queue).unwrap();
    }
}

fn load_todo(shared: &Shared, in_flight: &HashSet<i64>) -> rusqlite::Result<Vec<Job>> {
    let db = shared.db.lock().unwrap();
    let mut stmt = db.prepare_cached(
        "SELECT id, hash, path, kind FROM media WHERE thumb_status = 0 ORDER BY id DESC LIMIT ?1",
    )?;
    let rows = stmt.query_map([(BATCH + in_flight.len()) as i64], job_from_row)?;
    let jobs = rows.collect::<Result<Vec<_>, _>>()?;
    Ok(jobs.into_iter().filter(|j| !in_flight.contains(&j.id)).take(BATCH).collect())
}

/// Fabrique la miniature ; `None` si le média n'est plus à faire (déjà traité entre-temps).
fn process(shared: &Shared, job: &Job) -> Option<ThumbUpdate> {
    let still_todo = {
        let db = shared.db.lock().unwrap();
        db.query_row("SELECT thumb_status FROM media WHERE id = ?1", [job.id], |r| r.get::<_, i64>(0))
            .optional()
            .ok()
            .flatten()
            == Some(status::TODO)
    };
    if !still_todo {
        return None;
    }
    let ff = shared.ffmpeg.get_or_init(ffmpeg::detect).as_ref();
    let mut update = ThumbUpdate { id: job.id, status: status::ERROR, width: None, height: None, duration_ms: None };

    let made = match job.kind.as_str() {
        "image" => image::from_image_file(&job.path)
            .or_else(|e| match ff {
                Some(ff) => video::image_thumb(ff, &job.path),
                None => Err(e),
            })
            .map(|t| (t, None)),
        "video" => match ff {
            Some(ff) => video::video_thumb(ff, &job.path).map(|v| (v.thumb, v.duration_ms)),
            None => {
                update.status = status::NO_FFMPEG;
                return Some(update);
            }
        },
        _ => {
            update.status = status::NONE;
            return Some(update);
        }
    };

    match made.and_then(|(thumb, duration)| {
        store::put(&shared.store.lock().unwrap(), &job.hash, &thumb.webp)?;
        Ok((thumb.width, thumb.height, duration))
    }) {
        Ok((w, h, duration)) => {
            update.status = status::READY;
            update.width = Some(w);
            update.height = Some(h);
            update.duration_ms = duration;
        }
        Err(e) => eprintln!("[miniatures] {} : {e:#}", job.path.display()),
    }
    Some(update)
}

fn finish(shared: &Shared, id: i64, update: Option<ThumbUpdate>) {
    if let Some(u) = &update {
        let db = shared.db.lock().unwrap();
        let result = db.execute(
            "UPDATE media SET thumb_status = ?1,
                 width = COALESCE(?2, width), height = COALESCE(?3, height),
                 duration_ms = COALESCE(?4, duration_ms)
             WHERE id = ?5",
            rusqlite::params![u.status, u.width, u.height, u.duration_ms, u.id],
        );
        if let Err(e) = result {
            eprintln!("[miniatures] enregistrement du média {id} : {e}");
        }
    }
    shared.queue.lock().unwrap().in_flight.remove(&id);
    if let Some(u) = update {
        shared.pending.lock().unwrap().updates.push(u);
    }
    flush(shared, false);
}

/// Envoie les résultats accumulés à l'interface (au plus toutes les 200 ms, sauf `force`).
fn flush(shared: &Shared, force: bool) {
    let mut pending = shared.pending.lock().unwrap();
    if pending.updates.is_empty() || (!force && pending.last_emit.elapsed() < EMIT_INTERVAL) {
        return;
    }
    let updates = std::mem::take(&mut pending.updates);
    pending.last_emit = Instant::now();
    drop(pending);
    let _ = shared.app.emit("thumbs-ready", updates);
}

/// Les miniatures passent après l'interface : elle reste fluide pendant le travail.
fn lower_thread_priority() {
    #[cfg(windows)]
    {
        unsafe extern "system" {
            fn GetCurrentThread() -> isize;
            fn SetThreadPriority(thread: isize, priority: i32) -> i32;
        }
        const THREAD_PRIORITY_BELOW_NORMAL: i32 = -1;
        // SAFETY : appels Win32 sans pointeur, sur le fil courant.
        unsafe {
            SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_BELOW_NORMAL);
        }
    }
}
