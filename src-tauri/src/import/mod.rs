//! Import d'un dossier sur place (IMP-02, IMP-04, IMP-40, IMP-41, IMP-42 « Arrêter », IMP-44).
//!
//! L'état de l'import vit ici, côté Rust : l'interface reçoit une photo complète de
//! cet état (`import-state`) à chaque changement. Changer de page puis revenir, ou
//! redémarrer l'interface, ne perd donc jamais la progression.

mod index;
mod scan;

use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::{AppState, db};
use index::{Indexer, Outcome};
pub use scan::ScanSummary;
use scan::ScanFile;

/// Un lot de fichiers est validé en base toutes les 200 entrées ou 300 ms.
const COMMIT_EVERY: usize = 200;
const COMMIT_INTERVAL: Duration = Duration::from_millis(300);
/// Rythme des notifications vers l'interface.
const PROGRESS_INTERVAL: Duration = Duration::from_millis(100);
const LIBRARY_INTERVAL: Duration = Duration::from_millis(1000);
/// Nombre maximal de fichiers en erreur listés dans le résumé.
const MAX_LISTED_ERRORS: usize = 200;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Phase {
    Idle,
    Scanning,
    Ready,
    Importing,
    Finished,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub total: u64,
    pub processed: u64,
    pub imported: u64,
    pub updated: u64,
    pub already_present: u64,
    pub duplicates: u64,
    pub errors: u64,
    pub current_file: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileError {
    pub path: String,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub cancelled: bool,
    /// Erreur qui a interrompu tout l'import (base inaccessible…).
    pub fatal: Option<String>,
    pub error_files: Vec<FileError>,
    pub elapsed_ms: u64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub phase: Phase,
    pub folder: Option<String>,
    pub recursive: bool,
    pub scan: Option<ScanSummary>,
    pub progress: Option<Progress>,
    pub result: Option<ImportResult>,
}

struct Inner {
    snapshot: Snapshot,
    files: Vec<ScanFile>,
    last_emit: Instant,
}

pub struct ImportManager {
    app: AppHandle,
    inner: Mutex<Inner>,
    cancel: AtomicBool,
    /// Numéro du parcours en cours : un parcours remplacé par un autre s'arrête.
    generation: AtomicU64,
}

impl ImportManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            inner: Mutex::new(Inner {
                snapshot: Snapshot {
                    phase: Phase::Idle,
                    folder: None,
                    recursive: true,
                    scan: None,
                    progress: None,
                    result: None,
                },
                files: Vec::new(),
                last_emit: Instant::now(),
            }),
            cancel: AtomicBool::new(false),
            generation: AtomicU64::new(0),
        }
    }

    pub fn snapshot(&self) -> Snapshot {
        self.inner.lock().unwrap().snapshot.clone()
    }

    /// Modifie l'état puis prévient l'interface (`throttle` : au plus 10 fois par seconde).
    fn update(&self, throttle: bool, change: impl FnOnce(&mut Inner)) {
        let mut inner = self.inner.lock().unwrap();
        change(&mut inner);
        if throttle && inner.last_emit.elapsed() < PROGRESS_INTERVAL {
            return;
        }
        inner.last_emit = Instant::now();
        let snapshot = inner.snapshot.clone();
        drop(inner);
        let _ = self.app.emit("import-state", snapshot);
    }
}

/// État actuel (au démarrage de l'interface).
#[tauri::command]
pub fn import_snapshot(state: State<'_, AppState>) -> Snapshot {
    state.import.snapshot()
}

/// Parcourt le dossier choisi et prépare la liste des fichiers à importer.
#[tauri::command]
pub fn scan_folder(app: AppHandle, state: State<'_, AppState>, path: String, recursive: bool) -> Result<(), String> {
    let manager = &state.import;
    if manager.snapshot().phase == Phase::Importing {
        return Err("Un import est déjà en cours.".into());
    }
    let generation = manager.generation.fetch_add(1, Ordering::SeqCst) + 1;
    manager.update(false, |inner| {
        inner.files.clear();
        inner.snapshot = Snapshot {
            phase: Phase::Scanning,
            folder: Some(path.clone()),
            recursive,
            scan: Some(ScanSummary::default()),
            progress: None,
            result: None,
        };
    });

    std::thread::Builder::new()
        .name("import-parcours".into())
        .spawn(move || {
            let manager = &app.state::<AppState>().import;
            let current = || manager.generation.load(Ordering::SeqCst) == generation;
            let found = scan::scan(&PathBuf::from(&path), recursive, || !current(), |summary| {
                let summary = summary.clone();
                manager.update(true, |inner| inner.snapshot.scan = Some(summary));
            });
            if let Some((files, summary)) = found.filter(|_| current()) {
                manager.update(false, |inner| {
                    inner.files = files;
                    inner.snapshot.phase = Phase::Ready;
                    inner.snapshot.scan = Some(summary);
                });
            }
        })
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Lance l'import des fichiers trouvés par le dernier parcours.
#[tauri::command]
pub fn start_import(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let manager = &state.import;
    let files = {
        let mut inner = manager.inner.lock().unwrap();
        if inner.snapshot.phase != Phase::Ready || inner.files.is_empty() {
            return Err("Aucun fichier prêt à importer.".into());
        }
        std::mem::take(&mut inner.files)
    };
    manager.cancel.store(false, Ordering::SeqCst);
    let total = files.len() as u64;
    manager.update(false, |inner| {
        inner.snapshot.phase = Phase::Importing;
        inner.snapshot.progress = Some(Progress { total, ..Progress::default() });
    });

    std::thread::Builder::new()
        .name("import".into())
        .spawn(move || run_import(&app, files))
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Bouton « Arrêter » : l'import s'arrête proprement après le fichier en cours.
#[tauri::command]
pub fn cancel_import(state: State<'_, AppState>) {
    state.import.cancel.store(true, Ordering::SeqCst);
}

fn run_import(app: &AppHandle, files: Vec<ScanFile>) {
    let state = app.state::<AppState>();
    let manager = &state.import;
    let start = Instant::now();
    let mut progress = Progress { total: files.len() as u64, ..Progress::default() };
    let mut error_files = Vec::new();
    let mut cancelled = false;

    let fatal = (|| -> anyhow::Result<()> {
        let conn = db::open(&state.paths.db)?;
        let mut indexer = Indexer::new();
        let mut in_batch = 0;
        let mut last_commit = Instant::now();
        let mut last_library = Instant::now();
        conn.execute_batch("BEGIN IMMEDIATE")?;

        for file in &files {
            if manager.cancel.load(Ordering::SeqCst) {
                cancelled = true;
                break;
            }
            progress.current_file = file.path.file_name().map(|n| n.to_string_lossy().into_owned());
            match indexer.index(&conn, file, db::now_ms()) {
                Ok(Outcome::Imported) => progress.imported += 1,
                Ok(Outcome::Updated) => progress.updated += 1,
                Ok(Outcome::AlreadyPresent) => progress.already_present += 1,
                Ok(Outcome::Duplicate) => progress.duplicates += 1,
                Err(e) => {
                    progress.errors += 1;
                    if error_files.len() < MAX_LISTED_ERRORS {
                        error_files.push(FileError { path: file.path.display().to_string(), message: format!("{e:#}") });
                    }
                }
            }
            progress.processed += 1;
            in_batch += 1;

            if in_batch >= COMMIT_EVERY || last_commit.elapsed() >= COMMIT_INTERVAL {
                conn.execute_batch("COMMIT; BEGIN IMMEDIATE")?;
                in_batch = 0;
                last_commit = Instant::now();
                state.thumbs.wake();
                if last_library.elapsed() >= LIBRARY_INTERVAL {
                    let _ = app.emit("library-changed", ());
                    last_library = Instant::now();
                }
            }
            let snapshot = progress.clone();
            manager.update(true, |inner| inner.snapshot.progress = Some(snapshot));
        }
        conn.execute_batch("COMMIT")?;
        Ok(())
    })()
    .err()
    .map(|e| format!("{e:#}"));

    state.thumbs.wake();
    let _ = app.emit("library-changed", ());
    progress.current_file = None;
    let result = ImportResult { cancelled, fatal, error_files, elapsed_ms: start.elapsed().as_millis() as u64 };
    manager.update(false, |inner| {
        inner.snapshot.phase = Phase::Finished;
        inner.snapshot.progress = Some(progress);
        inner.snapshot.result = Some(result);
    });
}
