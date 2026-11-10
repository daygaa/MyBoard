//! Import sur place de fichiers et de dossiers (IMP-01, IMP-02, IMP-03, IMP-04, IMP-40,
//! IMP-41, IMP-42 « Arrêter », IMP-44), avec tags par défaut (IMP-30, IMP-31). Un fichier supprimé
//! de la bibliothèque il y a moins d'un mois et réimporté : la fin de l'import propose de remettre
//! ses données (DEL-05, `reserve.rs`).
//!
//! Options (compression, conversion, suppression des originaux, paires) : `plan.rs` ; déroulement : `run.rs`.
//!
//! L'état de l'import vit ici, côté Rust : l'interface reçoit une photo complète de
//! cet état (`import-state`) à chaque changement. Changer de page puis revenir, ou
//! redémarrer l'interface, ne perd donc jamais la progression.

mod avif_meta;
mod compress;
mod convert;
mod encode;
mod index;
pub mod list;
pub mod pairs;
mod plan;
mod png_out;
pub mod preview;
mod run;
mod scan;
mod state;
mod versions;
mod video;

use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager, State};

use crate::AppState;
use crate::tags::NewTag;
pub use plan::ImportOptions;
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
        .spawn(move || run::run_import(&app, files, default_tags, options))
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Bouton « Arrêter » : l'import s'arrête proprement après le fichier en cours.
#[tauri::command]
pub fn cancel_import(state: State<'_, AppState>) {
    state.import.cancel.store(true, Ordering::SeqCst);
}
