//! Import sur place de fichiers et de dossiers (IMP-01, IMP-02, IMP-03, IMP-04, IMP-40,
//! IMP-41, IMP-42 « Arrêter », IMP-44), avec tags par défaut (IMP-30, IMP-31). Un fichier supprimé
//! de la bibliothèque il y a moins d'un mois et réimporté : la fin de l'import propose de remettre
//! ses données (DEL-05, `reserve.rs`).
//!
//! L'état de l'import vit ici, côté Rust : l'interface reçoit une photo complète de
//! cet état (`import-state`) à chaque changement. Changer de page puis revenir, ou
//! redémarrer l'interface, ne perd donc jamais la progression.

mod compress;
mod encode;
mod index;
pub mod list;
pub mod preview;
mod scan;
mod state;

use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager, State};

use crate::reserve;
use crate::tagging::{Tagger, Target, resolve_or_create};
use crate::tags::NewTag;
use crate::{AppState, db};
pub use compress::ImportOptions;
use compress::{Compress, Squeeze};
use index::{Indexer, Outcome};
pub use scan::ScanSummary;
use scan::ScanFile;
pub use state::{FileError, ImportResult, Phase, Progress, Snapshot};

/// Un lot de fichiers est validé en base toutes les 200 entrées ou 300 ms.
const COMMIT_EVERY: usize = 200;
const COMMIT_INTERVAL: Duration = Duration::from_millis(300);
/// Rythme des notifications vers l'interface.
const PROGRESS_INTERVAL: Duration = Duration::from_millis(100);
const LIBRARY_INTERVAL: Duration = Duration::from_millis(1000);
/// Nombre maximal de fichiers en erreur listés dans le résumé.
const MAX_LISTED_ERRORS: usize = 200;

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
                    sources: Vec::new(),
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

    /// La pop-in de restauration a reçu sa réponse (DEL-05) : elle ne revient plus.
    pub fn clear_restorable(&self) {
        self.update(false, |inner| {
            if let Some(result) = &mut inner.snapshot.result {
                result.restorable.clear();
            }
        });
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

/// Parcourt les fichiers et dossiers choisis et prépare la liste des fichiers à importer.
#[tauri::command]
pub fn scan_paths(app: AppHandle, state: State<'_, AppState>, paths: Vec<String>, recursive: bool) -> Result<(), String> {
    let manager = &state.import;
    if manager.snapshot().phase == Phase::Importing {
        return Err("Un import est déjà en cours.".into());
    }
    if paths.is_empty() {
        return Err("Aucun fichier choisi.".into());
    }
    let generation = manager.generation.fetch_add(1, Ordering::SeqCst) + 1;
    manager.update(false, |inner| {
        inner.files.clear();
        inner.snapshot = Snapshot {
            phase: Phase::Scanning,
            sources: paths.clone(),
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
            let roots: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
            let found = scan::scan(&roots, recursive, || !current(), |summary| {
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

/// Lance l'import des fichiers trouvés par le dernier parcours. `default_tags` : ajoutés à
/// tous les fichiers de l'import, y compris ceux déjà présents dans la bibliothèque (IMP-30) ; `options` : compression
/// des images (IMP-20, IMP-60).
#[tauri::command]
pub fn start_import(
    app: AppHandle,
    state: State<'_, AppState>,
    default_tags: Vec<NewTag>,
    options: ImportOptions,
) -> Result<(), String> {
    let manager = &state.import;
    let files = {
        let inner = manager.inner.lock().unwrap();
        if inner.snapshot.phase != Phase::Ready || inner.files.is_empty() {
            return Err("Aucun fichier prêt à importer.".into());
        }
        // La liste reste affichée pendant l'import (IMP-10) ; vidée à la fin.
        inner.files.clone()
    };
    manager.cancel.store(false, Ordering::SeqCst);
    let total = files.len() as u64;
    manager.update(false, |inner| {
        inner.snapshot.phase = Phase::Importing;
        inner.snapshot.progress = Some(Progress { total, ..Progress::default() });
    });

    std::thread::Builder::new()
        .name("import".into())
        .spawn(move || run_import(&app, files, default_tags, options.compress()))
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Bouton « Arrêter » : l'import s'arrête proprement après le fichier en cours.
#[tauri::command]
pub fn cancel_import(state: State<'_, AppState>) {
    state.import.cancel.store(true, Ordering::SeqCst);
}

fn run_import(app: &AppHandle, files: Vec<ScanFile>, default_tags: Vec<NewTag>, compress: Option<Compress>) {
    let state = app.state::<AppState>();
    let manager = &state.import;
    let start = Instant::now();
    let mut progress = Progress { total: files.len() as u64, ..Progress::default() };
    let mut error_files = Vec::new();
    let mut cancelled = false;
    let mut restorable = Vec::new();

    let fatal = (|| -> anyhow::Result<()> {
        let mut conn = db::open(&state.paths.db)?;
        // Tags par défaut : créés une fois au départ (ceux qui existent gardent leur catégorie ; un
        // synonyme donne son tag principal, TAGM-15). Les parents suivent à chaque média (TAGM-16).
        let targets: Vec<Target> = {
            let tx = conn.transaction()?;
            let mut found = Vec::new();
            for tag in &default_tags {
                found.extend(resolve_or_create(&tx, tag, db::now_ms())?);
            }
            tx.commit()?;
            found
        };
        let tagger = Tagger::load(&conn)?;
        let mut indexer = Indexer::new();
        // Médias nouveaux dont les données sont en réserve (DEL-05).
        let mut found = Vec::new();
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
            let outcome = indexer.index(&conn, file, db::now_ms(), compress);
            match indexer.squeeze {
                Some(Squeeze::Done) => progress.compressed += 1,
                Some(Squeeze::NotSmaller) => progress.not_smaller += 1,
                Some(Squeeze::Failed) => progress.compress_failed += 1,
                None => {}
            }
            if let Ok(Outcome::Imported(id) | Outcome::Updated(id) | Outcome::AlreadyPresent(id) | Outcome::Duplicate(id)) =
                &outcome
            {
                for target in &targets {
                    tagger.attach(&conn, *id, *target)?;
                }
            }
            if let Ok(Outcome::Imported(id)) = &outcome
                && reserve::has_kept(&conn, *id)?
            {
                found.push(*id);
            }
            match outcome {
                Ok(Outcome::Imported(_)) => progress.imported += 1,
                Ok(Outcome::Updated(_)) => progress.updated += 1,
                Ok(Outcome::AlreadyPresent(_)) => progress.already_present += 1,
                Ok(Outcome::Duplicate(_)) => progress.duplicates += 1,
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
        restorable = reserve::candidates(&conn, &found)?;
        Ok(())
    })()
    .err()
    .map(|e| format!("{e:#}"));

    state.thumbs.wake();
    let _ = app.emit("library-changed", ());
    progress.current_file = None;
    let result = ImportResult { cancelled, fatal, error_files, elapsed_ms: start.elapsed().as_millis() as u64, restorable };
    manager.update(false, |inner| {
        inner.files.clear();
        inner.snapshot.phase = Phase::Finished;
        inner.snapshot.progress = Some(progress);
        inner.snapshot.result = Some(result);
    });
}
