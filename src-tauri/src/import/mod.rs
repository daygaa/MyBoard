//! Import sur place de fichiers et de dossiers (IMP-01, IMP-02, IMP-03, IMP-04, IMP-40,
//! IMP-41, IMP-44), avec tags par défaut (IMP-30, IMP-31). Pause, « Reprendre », « Terminer ici » (IMP-42, `pause.rs`),
//! « Annuler l'import » (IMP-43, `undo.rs`), journal des fichiers en cours d'écriture (`journal.rs`), bilan (IMP-45). Un fichier supprimé
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
mod disk;
pub mod dups;
mod encode;
mod index;
pub mod journal;
pub mod list;
pub mod pairs;
mod pause;
mod plan;
mod readable;
mod png_out;
mod prefetch;
pub mod preview;
pub mod reconvert;
mod relocate;
mod run;
mod scan;
pub mod sources;
mod state;
mod tally;
pub mod undo;
mod versions;
pub mod video;

use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, State};

use crate::AppState;
use crate::tags::NewTag;
pub use plan::ImportOptions;
pub use scan::ScanSummary;
use scan::ScanFile;
pub use state::{FileError, ImportResult, Paused, Phase, Progress, Snapshot};

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
    /// Fichiers et dossiers ajoutés, dans l'ordre (liste groupée, IMP-88).
    sources: Vec<sources::Source>,
    /// Compteur des numéros de source et des versions de la liste (jamais remis à zéro).
    version: u64,
    /// Fichiers illisibles du dernier import et ses tags par défaut : « Les importer quand même » (IMP-87).
    unreadable: Vec<ScanFile>,
    last_tags: Vec<NewTag>,
    last_emit: Instant,
}

pub struct ImportManager {
    app: AppHandle,
    inner: Mutex<Inner>,
    /// Arrêt de l'import : « Terminer ici » (IMP-42) ou « Annuler l'import » (IMP-43, avec `undo`).
    cancel: AtomicBool,
    undo: AtomicBool,
    gate: pause::Gate,
    /// Changements du dernier import terminé : « Annuler l'import » après la fin (retour du 11/11).
    last: Mutex<Option<undo::Changes>>,
    /// Numéro du parcours en cours : un parcours remplacé par un autre s'arrête.
    generation: AtomicU64,
}

impl ImportManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            inner: Mutex::new(Inner {
                snapshot: Snapshot::idle(true),
                files: Vec::new(),
                sources: Vec::new(),
                version: 0,
                unreadable: Vec::new(),
                last_tags: Vec::new(),
                last_emit: Instant::now(),
            }),
            cancel: AtomicBool::new(false),
            undo: AtomicBool::new(false),
            gate: pause::Gate::new(),
            last: Mutex::new(None),
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

    /// Réponse à la pop-in de restauration (DEL-05) : réserve d'avant l'import et tags recréés par la restauration,
    /// notés pour « Annuler l'import » après la fin (réponse Q2 A du 12/11 : la réserve redevient celle d'avant).
    pub fn note_reserve(&self, rows: Vec<undo::Reserved>, created_tags: Vec<i64>) {
        if let Some(changes) = self.last.lock().unwrap().as_mut() {
            changes.reserve.extend(rows);
            changes.created_tags.extend(created_tags);
        }
    }

    /// Met l'import en pause (« Arrêter », ou emplacement devenu inaccessible : `offline`, IMP-54).
    fn pause(&self, offline: Option<String>) {
        self.gate.set(true);
        self.update(false, |inner| inner.snapshot.paused = Some(Paused { offline }));
    }

    /// Bilan fermé (IMP-45).
    pub fn set_reported(&self) {
        self.update(false, |inner| {
            if let Some(result) = &mut inner.snapshot.result {
                result.reported = true;
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
    begin(app, manager, files, default_tags, options, None)
}

/// « Les importer quand même » (IMP-87, réponse Q30 A du 15/11) : les fichiers illisibles du dernier import, avec ses
/// tags par défaut, gardés tels quels (ni compression ni conversion : impossibles pour eux). « Annuler l'import » défait
/// ensuite les deux imports.
#[tauri::command]
pub fn import_unreadable(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let manager = &state.import;
    let (files, tags) = {
        let mut inner = manager.inner.lock().unwrap();
        if inner.snapshot.phase != Phase::Finished || inner.unreadable.is_empty() {
            return Err("Aucun fichier illisible à importer.".into());
        }
        let mut files = std::mem::take(&mut inner.unreadable);
        inner.list_alone(&mut files);
        (files, inner.last_tags.clone())
    };
    let earlier = manager.last.lock().unwrap().take();
    begin(app, manager, files, tags, ImportOptions { accept_unreadable: true, ..ImportOptions::default() }, earlier)
}

/// Départ d'un import dans son propre fil.
fn begin(app: AppHandle, manager: &ImportManager, files: Vec<ScanFile>, default_tags: Vec<NewTag>, options: ImportOptions, earlier: Option<undo::Changes>) -> Result<(), String> {
    manager.cancel.store(false, Ordering::SeqCst);
    manager.undo.store(false, Ordering::SeqCst);
    manager.gate.set(false);
    let total = files.len() as u64;
    let undoable = options.undoable();
    manager.update(false, |inner| {
        inner.snapshot.phase = Phase::Importing;
        inner.snapshot.paused = None;
        inner.snapshot.undoable = undoable;
        inner.snapshot.progress = Some(Progress { total, ..Progress::default() });
    });

    std::thread::Builder::new()
        .name("import".into())
        .spawn(move || run::run_import(&app, files, default_tags, options, earlier))
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// « Arrêter » : pause immédiate, ffmpeg compris (IMP-42).
#[tauri::command]
pub fn pause_import(state: State<'_, AppState>) {
    let manager = &state.import;
    if manager.snapshot().phase == Phase::Importing && !manager.gate.is_paused() {
        manager.pause(None);
    }
}

/// « Reprendre » : l'import repart du fichier où il s'était arrêté.
#[tauri::command]
pub fn resume_import(state: State<'_, AppState>) {
    let manager = &state.import;
    manager.update(false, |inner| inner.snapshot.paused = None);
    manager.gate.set(false);
}

/// « Terminer ici » (réponse A du 11/11) : ce qui est fait est gardé, le fichier à moitié écrit est effacé, le reste
/// de la liste est abandonné, puis le bilan s'ouvre.
#[tauri::command]
pub fn finish_import(state: State<'_, AppState>) {
    let manager = &state.import;
    manager.cancel.store(true, Ordering::SeqCst);
    manager.gate.set(false);
}

/// Bilan de fin d'import fermé (IMP-45) : la restauration (DEL-05) peut suivre.
#[tauri::command]
pub fn import_report_seen(state: State<'_, AppState>) {
    state.import.set_reported();
}
