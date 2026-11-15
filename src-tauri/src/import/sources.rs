//! Liste des fichiers choisis, par source (IMP-88 ; réponses Q20 B, Q26 A du 14/11, Q40 A à Q42 A du 15/11) : chaque
//! fichier ou dossier glissé ou choisi par les boutons s'AJOUTE à la liste. Un dossier = une ligne (nombre de fichiers,
//! sa case « sous-dossiers », dépliable, retiré en entier par sa croix) ; un fichier choisi seul = une ligne simple. La
//! case générale (« Sous-dossiers inclus par défaut ») ne sert qu'aux nouveaux dossiers. Ce qui est déjà dans la liste
//! (même fichier, même dossier, dossier dont tous les fichiers y sont déjà) n'est pas ajouté : « Déjà dans la liste ».
//! Les sources à parcourir le sont dans un fil à part ; tout changement pendant un parcours le relance avec ce qui
//! reste à parcourir (un parcours remplacé s'arrête, son résultat est oublié).

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use super::scan::{self, ScanEntry, ScanFile, ScanSummary};
use super::{ImportManager, Inner, Phase, Snapshot};
use crate::AppState;

/// Un fichier ou un dossier ajouté à la liste.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Source {
    pub id: u64,
    pub path: String,
    pub folder: bool,
    /// Dossier : ses sous-dossiers sont parcourus aussi.
    pub recursive: bool,
    /// Fichiers retenus et leur poids.
    pub files: u64,
    pub bytes: u64,
    /// Pas encore parcouru (ajout, ou case « sous-dossiers » changée).
    pub scanning: bool,
    /// Ajouté par le dernier choix, jamais parcouru : retiré s'il n'apporte rien de nouveau.
    #[serde(skip)]
    fresh: bool,
    #[serde(skip)]
    ignored: u64,
    #[serde(skip)]
    inaccessible: u64,
}

impl Source {
    pub fn new(id: u64, path: String, folder: bool, recursive: bool) -> Self {
        Self { id, path, folder, recursive: folder && recursive, files: 0, bytes: 0, scanning: true, fresh: true, ignored: 0, inaccessible: 0 }
    }

    /// Ligne affichée : un dossier, ou un fichier pris en charge (un fichier ignoré n'est que compté).
    fn shown(&self) -> bool {
        self.folder || self.scanning || self.files > 0
    }
}

impl Inner {
    fn next_id(&mut self) -> u64 {
        self.version += 1;
        self.version
    }

    /// Résumé, compteurs de chaque source et nombre de lignes recalculés après un changement de la liste. Un fichier
    /// d'un format non pris en charge n'a pas de ligne mais reste compté (« 1 fichier ignoré »).
    pub(super) fn summarize(&mut self) {
        let mut per: HashMap<u64, (u64, u64)> = HashMap::new();
        let mut summary = ScanSummary::default();
        for f in &self.files {
            summary.count(f);
            let e = per.entry(f.source).or_default();
            e.0 += 1;
            e.1 += f.size;
        }
        for s in &mut self.sources {
            (s.files, s.bytes) = per.get(&s.id).copied().unwrap_or_default();
            summary.ignored += s.ignored;
            summary.inaccessible += s.inaccessible;
        }
        self.snapshot.lines = self.sources.iter().filter(|s| s.shown()).count() as u64;
        self.snapshot.scan = Some(summary);
        self.snapshot.list_version = self.next_id();
    }

    /// Après un retrait (croix, menu du clic droit) : plus aucune ligne, la page revient à son état de départ.
    pub(super) fn after_removal(&mut self) {
        self.summarize();
        if self.snapshot.lines == 0 {
            self.reset();
        }
    }

    /// Liste vide, page à son état de départ (« Tout vider », IMP-51 ; dernière ligne retirée).
    pub(super) fn reset(&mut self) {
        self.files.clear();
        self.sources.clear();
        let (recursive, already) = (self.snapshot.recursive, self.snapshot.already_listed);
        self.snapshot = Snapshot::idle(recursive);
        self.snapshot.already_listed = already;
        self.snapshot.list_version = self.next_id();
    }

    /// Fichiers de la liste rangés dans l'ordre de leurs sources (ordre de l'import, comme celui de l'affichage).
    fn sort_files(&mut self) {
        let rank: HashMap<u64, usize> = self.sources.iter().enumerate().map(|(i, s)| (s.id, i)).collect();
        self.files.sort_by_key(|f| rank.get(&f.source).copied().unwrap_or(usize::MAX));
    }

    /// « Les importer quand même » (IMP-87) : chaque fichier devient sa propre ligne, affichée pendant l'import.
    pub(super) fn list_alone(&mut self, files: &mut [ScanFile]) {
        self.sources.clear();
        for f in files.iter_mut() {
            f.source = self.next_id();
            let mut s = Source::new(f.source, f.path.display().to_string(), false, false);
            (s.scanning, s.fresh) = (false, false);
            self.sources.push(s);
        }
        self.files = files.to_vec();
        self.summarize();
    }
}

/// Ajoute des fichiers et des dossiers à la liste (glisser-déposer, boutons). `recursive` : case générale, choix des
/// nouveaux dossiers. Après un import (ou au départ), la liste repart de zéro.
#[tauri::command]
pub fn scan_paths(app: AppHandle, state: State<'_, AppState>, paths: Vec<String>, recursive: bool) -> Result<(), String> {
    let manager = &state.import;
    let phase = manager.snapshot().phase;
    if phase == Phase::Importing {
        return Err("Un import est déjà en cours.".into());
    }
    if paths.is_empty() {
        return Err("Aucun fichier choisi.".into());
    }
    let fresh_start = !matches!(phase, Phase::Scanning | Phase::Ready);
    if fresh_start {
        // Nouveau choix de fichiers : « Annuler l'import » du dernier import n'est plus possible.
        *manager.last.lock().unwrap() = None;
    }
    let kinds: Vec<(String, bool)> = paths.into_iter().map(|p| {
        let folder = Path::new(&p).is_dir();
        (p, folder)
    }).collect();
    manager.update(false, |inner| {
        if fresh_start {
            inner.unreadable.clear();
            inner.reset();
        }
        inner.snapshot.recursive = recursive;
        let mut known: HashSet<String> = inner.sources.iter().map(|s| s.path.to_lowercase()).collect();
        known.extend(inner.files.iter().map(|f| f.path.to_string_lossy().to_lowercase()));
        let mut refused = false;
        let mut added = false;
        for (path, folder) in kinds {
            if !known.insert(path.to_lowercase()) {
                refused = true;
                continue;
            }
            let id = inner.next_id();
            inner.sources.push(Source::new(id, path, folder, recursive));
            added = true;
        }
        if refused {
            inner.snapshot.already_listed += 1;
        }
        if added {
            inner.snapshot.phase = Phase::Scanning;
            inner.snapshot.result = None;
            inner.snapshot.progress = None;
            inner.snapshot.undoable = false;
            if inner.snapshot.scan.is_none() {
                inner.snapshot.scan = Some(ScanSummary::default());
            }
            inner.summarize();
        }
    });
    rescan(&app, manager);
    Ok(())
}

/// Lance (ou relance) le parcours des sources pas encore parcourues ; rien à parcourir : la liste est prête.
pub(super) fn rescan(app: &AppHandle, manager: &ImportManager) {
    let generation = manager.generation.fetch_add(1, Ordering::SeqCst) + 1;
    let (todo, mut seen, base) = {
        let mut inner = manager.inner.lock().unwrap();
        let todo: Vec<(u64, PathBuf, bool)> = inner.sources.iter().filter(|s| s.scanning).map(|s| (s.id, PathBuf::from(&s.path), s.recursive)).collect();
        if todo.is_empty() {
            if inner.snapshot.phase == Phase::Scanning {
                inner.snapshot.phase = Phase::Ready;
            }
            drop(inner);
            manager.update(false, |_| {});
            return;
        }
        let seen: HashSet<PathBuf> = inner.files.iter().map(|f| f.path.clone()).collect();
        (todo, seen, inner.snapshot.scan.clone().unwrap_or_default())
    };
    let app = app.clone();
    let spawned = std::thread::Builder::new().name("import-parcours".into()).spawn(move || {
        let manager = &app.state::<AppState>().import;
        let current = || manager.generation.load(Ordering::SeqCst) == generation;
        let mut done: Vec<(u64, scan::Found)> = Vec::new();
        let mut so_far = base;
        for (id, root, recursive) in todo {
            let start = so_far.clone();
            let Some(found) = scan::scan(&root, recursive, id, &mut seen, || !current(), |partial| {
                let summary = start.plus(partial);
                manager.update(true, |inner| inner.snapshot.scan = Some(summary));
            }) else {
                return; // remplacé par un parcours plus récent
            };
            so_far = so_far.plus(&found.summary);
            done.push((id, found));
        }
        manager.update(false, |inner| {
            if !current() {
                return;
            }
            let mut refused = false;
            for (id, found) in done {
                let Some(i) = inner.sources.iter().position(|s| s.id == id) else { continue };
                // Rien de nouveau : un fichier ou un dossier dont tout est déjà dans la liste (Q42 A).
                if inner.sources[i].fresh && found.files.is_empty() && found.already > 0 {
                    inner.sources.remove(i);
                    refused = true;
                    continue;
                }
                let source = &mut inner.sources[i];
                (source.scanning, source.fresh) = (false, false);
                (source.ignored, source.inaccessible) = (found.summary.ignored, found.summary.inaccessible);
                inner.files.extend(found.files);
            }
            if refused {
                inner.snapshot.already_listed += 1;
            }
            inner.sort_files();
            inner.snapshot.phase = Phase::Ready;
            inner.summarize();
        });
        super::video::checks::changed();
    });
    if let Err(e) = spawned {
        eprintln!("[import] parcours : {e}");
    }
}

/// Une ligne de la liste : la source, et pour un fichier choisi seul, sa ligne de fichier.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanLine {
    #[serde(flatten)]
    pub source: Source,
    pub entry: Option<ScanEntry>,
}

#[derive(Serialize)]
pub struct LinePage {
    pub lines: Vec<ScanLine>,
    pub total: usize,
}

/// Lignes `offset` à `offset + limit` de la liste (1 000 au plus par appel), dans l'ordre des ajouts.
#[tauri::command]
pub fn scan_lines(state: State<'_, AppState>, offset: usize, limit: usize) -> LinePage {
    let inner = state.import.inner.lock().unwrap();
    let shown: Vec<&Source> = inner.sources.iter().filter(|s| s.shown()).collect();
    let page: Vec<&Source> = shown.iter().skip(offset).take(limit.min(1000)).copied().collect();
    let alone: HashSet<u64> = page.iter().filter(|s| !s.folder).map(|s| s.id).collect();
    let entries: HashMap<u64, ScanEntry> = inner.files.iter().filter(|f| alone.contains(&f.source)).map(|f| (f.source, f.entry())).collect();
    let lines = page.into_iter().map(|s| ScanLine { source: s.clone(), entry: entries.get(&s.id).cloned() }).collect();
    LinePage { lines, total: shown.len() }
}

/// Croix d'une ligne de dossier : le dossier et tous ses fichiers quittent la liste.
#[tauri::command]
pub fn remove_scan_source(app: AppHandle, state: State<'_, AppState>, id: u64) {
    let manager = &state.import;
    manager.update(false, |inner| {
        if !matches!(inner.snapshot.phase, Phase::Scanning | Phase::Ready) {
            return;
        }
        inner.sources.retain(|s| s.id != id);
        inner.files.retain(|f| f.source != id);
        inner.after_removal();
    });
    if manager.snapshot().phase == Phase::Scanning {
        rescan(&app, manager);
    }
    super::video::checks::changed();
}

/// Case « sous-dossiers » d'une ligne de dossier : il est parcouru de nouveau, avec ou sans ses sous-dossiers.
#[tauri::command]
pub fn set_source_recursive(app: AppHandle, state: State<'_, AppState>, id: u64, recursive: bool) {
    let manager = &state.import;
    let mut changed = false;
    manager.update(false, |inner| {
        if !matches!(inner.snapshot.phase, Phase::Scanning | Phase::Ready) {
            return;
        }
        let Some(source) = inner.sources.iter_mut().find(|s| s.id == id && s.folder) else { return };
        if source.recursive == recursive && !source.scanning {
            return;
        }
        (source.recursive, source.scanning) = (recursive, true);
        inner.files.retain(|f| f.source != id);
        inner.snapshot.phase = Phase::Scanning;
        inner.summarize();
        changed = true;
    });
    if changed {
        rescan(&app, manager);
        super::video::checks::changed();
    }
}
