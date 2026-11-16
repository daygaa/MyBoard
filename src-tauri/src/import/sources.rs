//! Liste des fichiers choisis, par source (IMP-88 ; réponses Q20 B, Q26 A du 14/11, Q40 A à Q42 A du 15/11) : chaque
//! fichier ou dossier glissé ou choisi par les boutons s'AJOUTE à la liste. Un dossier = une ligne (nombre de fichiers,
//! sa case « sous-dossiers », dépliable, retiré en entier par sa croix) ; un fichier choisi seul = une ligne simple. La
//! case générale (« Sous-dossiers inclus par défaut ») ne sert qu'aux nouveaux dossiers. Ce qui est déjà dans la liste
//! (même fichier, même dossier, dossier dont tous les fichiers y sont déjà) n'est pas ajouté : « Déjà dans la liste ».
//! Les sources à parcourir le sont dans un fil à part ; tout changement pendant un parcours le relance avec ce qui
//! reste à parcourir (un parcours remplacé s'arrête, son résultat est oublié).
//!
//! 2e tour (retours du 16/11) : un dossier dont la case « Sous-dossiers » est cochée MET DE CÔTÉ les autres sources
//! placées sous lui (`absorbed_by`) : elles n'ont plus de ligne, il reprend leurs fichiers ; sa case décochée, elles
//! reviennent à leur place ; lui retiré, elles partent avec lui (réponse Q45 B). Un dossier parcouru de nouveau garde
//! ses anciens fichiers jusqu'à la fin de son parcours, qui les remplace d'un coup : les chiffres passent directement
//! de l'ancien au nouveau (pas de progression envoyée pendant un tel parcours).

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
    /// Mise de côté par ce dossier « Sous-dossiers » coché, placé au-dessus d'elle (IMP-88, retouche 4) : pas de ligne,
    /// aucun fichier (le dossier a repris les siens).
    #[serde(skip)]
    absorbed_by: Option<u64>,
}

impl Source {
    pub fn new(id: u64, path: String, folder: bool, recursive: bool) -> Self {
        Self {
            id,
            path,
            folder,
            recursive: folder && recursive,
            files: 0,
            bytes: 0,
            scanning: true,
            fresh: true,
            ignored: 0,
            inaccessible: 0,
            absorbed_by: None,
        }
    }

    /// Ligne affichée : un dossier, ou un fichier pris en charge (un fichier ignoré n'est que compté) ; jamais une
    /// source mise de côté.
    fn shown(&self) -> bool {
        self.absorbed_by.is_none() && (self.folder || self.scanning || self.files > 0)
    }

    /// Dossier coché qui couvre tout ce qui est placé sous lui.
    fn takes_all(&self) -> bool {
        self.folder && self.recursive && self.absorbed_by.is_none()
    }

    /// Le fichier `file` revient à cette source quand elle est parcourue (chemins comparés sans la casse, comme Windows).
    fn covers(&self, file: &Path) -> bool {
        let file = file.to_string_lossy();
        if !self.folder {
            return file.to_lowercase() == self.path.to_lowercase();
        }
        if self.recursive {
            return is_under(&file, &self.path);
        }
        Path::new(&file.to_lowercase()).parent() == Some(Path::new(&self.path.to_lowercase()))
    }
}

/// `path` est placé sous le dossier `folder` (lui-même exclu ; sans compter la casse, comme Windows).
fn is_under(path: &str, folder: &str) -> bool {
    let (path, folder) = (path.to_lowercase(), folder.to_lowercase());
    let (path, folder) = (Path::new(&path), Path::new(&folder));
    path != folder && path.starts_with(folder)
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
        self.dropped.clear();
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

    /// Le dossier `id`, « Sous-dossiers » coché, met de côté les autres sources placées sous lui (IMP-88, retouche 4) :
    /// leurs fichiers deviennent les siens tout de suite (les chiffres ne bougent pas), son parcours le confirme.
    fn absorb_under(&mut self, id: u64) {
        let Some(root) = self.sources.iter().find(|s| s.id == id && s.takes_all()).map(|s| s.path.clone()) else { return };
        let mut taken: HashSet<u64> = HashSet::new();
        let (mut ignored, mut inaccessible) = (0, 0);
        for s in self.sources.iter_mut().filter(|s| s.id != id && s.absorbed_by.is_none() && is_under(&s.path, &root)) {
            s.absorbed_by = Some(id);
            (s.scanning, s.fresh) = (false, false);
            ignored += std::mem::take(&mut s.ignored);
            inaccessible += std::mem::take(&mut s.inaccessible);
            taken.insert(s.id);
        }
        if taken.is_empty() {
            return;
        }
        for f in self.files.iter_mut().filter(|f| taken.contains(&f.source)) {
            f.source = id;
        }
        if let Some(s) = self.sources.iter_mut().find(|s| s.id == id) {
            s.ignored += ignored;
            s.inaccessible += inaccessible;
        }
        self.sort_files();
    }

    /// Case « Sous-dossiers » du dossier `id` décochée : les sources qu'il avait mises de côté reviennent, à leur place,
    /// avec leurs fichiers (repris tout de suite, leur parcours le confirme).
    fn release(&mut self, id: u64) {
        let back: Vec<Source> = self.sources.iter().filter(|s| s.absorbed_by == Some(id)).cloned().collect();
        if back.is_empty() {
            return;
        }
        for s in self.sources.iter_mut().filter(|s| s.absorbed_by == Some(id)) {
            s.absorbed_by = None;
            (s.scanning, s.fresh) = (true, false);
        }
        for f in self.files.iter_mut().filter(|f| f.source == id) {
            if let Some(s) = back.iter().find(|s| s.covers(&f.path)) {
                f.source = s.id;
            }
        }
        self.sort_files();
    }

    /// La source `id` et celles qu'elle a mises de côté, directement ou non (elles partent avec elle, Q45 B).
    fn with_absorbed(&self, id: u64) -> HashSet<u64> {
        let mut all = HashSet::from([id]);
        loop {
            let before = all.len();
            for s in &self.sources {
                if s.absorbed_by.is_some_and(|p| all.contains(&p)) {
                    all.insert(s.id);
                }
            }
            if all.len() == before {
                return all;
            }
        }
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
            // Déjà source (même mise de côté), déjà fichier de la liste, ou placé sous un dossier coché (Q42 A).
            let covered = inner.sources.iter().any(|s| s.takes_all() && is_under(&path, &s.path));
            if covered || !known.insert(path.to_lowercase()) {
                refused = true;
                continue;
            }
            // Ajouté de nouveau : un fichier retiré pendant un parcours n'est plus écarté.
            inner.dropped.retain(|p| {
                let p = p.to_string_lossy();
                p.to_lowercase() != path.to_lowercase() && !is_under(&p, &path)
            });
            let id = inner.next_id();
            inner.sources.push(Source::new(id, path, folder, recursive));
            inner.absorb_under(id);
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
    let (todo, mut seen, base, quiet) = {
        let mut inner = manager.inner.lock().unwrap();
        let pending: Vec<&Source> = inner.sources.iter().filter(|s| s.scanning && s.absorbed_by.is_none()).collect();
        let todo: Vec<(u64, PathBuf, bool)> = pending.iter().map(|s| (s.id, PathBuf::from(&s.path), s.recursive)).collect();
        // Seulement des sources déjà parcourues (case changée, sources revenues) : pas de progression, les chiffres
        // passent d'un coup de l'ancien au nouveau (IMP-88, retouche 3).
        let quiet = pending.iter().all(|s| !s.fresh);
        if todo.is_empty() {
            if inner.snapshot.phase == Phase::Scanning {
                inner.snapshot.phase = Phase::Ready;
            }
            drop(inner);
            manager.update(false, |_| {});
            return;
        }
        // Les anciens fichiers des sources parcourues de nouveau restent dans la liste jusqu'à la fin du parcours, mais
        // ne comptent pas comme « déjà dans la liste » pour lui.
        let redo: HashSet<u64> = todo.iter().map(|t| t.0).collect();
        let mut base = ScanSummary::default();
        let mut seen: HashSet<PathBuf> = HashSet::new();
        for f in inner.files.iter().filter(|f| !redo.contains(&f.source)) {
            base.count(f);
            seen.insert(f.path.clone());
        }
        for s in inner.sources.iter().filter(|s| !redo.contains(&s.id)) {
            base.ignored += s.ignored;
            base.inaccessible += s.inaccessible;
        }
        (todo, seen, base, quiet)
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
                if quiet {
                    return;
                }
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
            // Les anciens fichiers des sources parcourues sont remplacés d'un coup ; ceux retirés par leur croix pendant
            // le parcours n'y reviennent pas.
            let redo: HashSet<u64> = done.iter().map(|d| d.0).collect();
            inner.files.retain(|f| !redo.contains(&f.source));
            let dropped = std::mem::take(&mut inner.dropped);
            let mut refused = false;
            for (id, mut found) in done {
                if !dropped.is_empty() {
                    found.files.retain(|f| !dropped.contains(&f.path));
                }
                let Some(i) = inner.sources.iter().position(|s| s.id == id) else { continue };
                // Rien de nouveau : un fichier ou un dossier dont tout est déjà dans la liste (Q42 A).
                let keeps = inner.sources.iter().any(|s| s.absorbed_by == Some(id));
                if inner.sources[i].fresh && found.files.is_empty() && found.already > 0 && !keeps {
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
        // Avec les sources qu'il avait mises de côté (réponse Q45 B).
        let gone = inner.with_absorbed(id);
        inner.sources.retain(|s| !gone.contains(&s.id));
        inner.files.retain(|f| !gone.contains(&f.source));
        inner.after_removal();
    });
    if manager.snapshot().phase == Phase::Scanning {
        rescan(&app, manager);
    }
    super::video::checks::changed();
}

/// Case « sous-dossiers » d'une ligne de dossier : il est parcouru de nouveau, avec ou sans ses sous-dossiers, en
/// gardant ses anciens fichiers jusqu'à la fin du parcours. Cochée : il met de côté les sources placées sous lui ;
/// décochée : elles reviennent (IMP-88, retouche 4).
#[tauri::command]
pub fn set_source_recursive(app: AppHandle, state: State<'_, AppState>, id: u64, recursive: bool) {
    let manager = &state.import;
    let mut changed = false;
    manager.update(false, |inner| {
        if !matches!(inner.snapshot.phase, Phase::Scanning | Phase::Ready) {
            return;
        }
        let Some(source) = inner.sources.iter_mut().find(|s| s.id == id && s.folder && s.absorbed_by.is_none()) else { return };
        if source.recursive == recursive && !source.scanning {
            return;
        }
        (source.recursive, source.scanning) = (recursive, true);
        if recursive {
            inner.absorb_under(id);
        } else {
            inner.release(id);
        }
        inner.snapshot.phase = Phase::Scanning;
        inner.summarize();
        changed = true;
    });
    if changed {
        rescan(&app, manager);
        super::video::checks::changed();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::formats::Kind;

    fn inner() -> Inner {
        Inner {
            snapshot: Snapshot::idle(true),
            files: Vec::new(),
            sources: Vec::new(),
            version: 0,
            unreadable: Vec::new(),
            last_tags: Vec::new(),
            last_emit: std::time::Instant::now(),
            dropped: Default::default(),
        }
    }

    fn add(inner: &mut Inner, path: &str, folder: bool, recursive: bool, files: &[&str]) -> u64 {
        let id = inner.next_id();
        let mut s = Source::new(id, path.into(), folder, recursive);
        (s.scanning, s.fresh) = (false, false);
        inner.sources.push(s);
        for f in files {
            inner.files.push(ScanFile { path: PathBuf::from(f), kind: Kind::Image, ext: "jpg".into(), size: 1, source: id });
        }
        id
    }

    fn owner(inner: &Inner, file: &str) -> u64 {
        inner.files.iter().find(|f| f.path == Path::new(file)).unwrap().source
    }

    #[test]
    fn sous_dossier_mis_de_cote_puis_rendu() {
        let mut inner = inner();
        let p = add(&mut inner, r"C:\a", true, false, &[r"C:\a\1.jpg"]);
        let s = add(&mut inner, r"C:\A\sous", true, false, &[r"C:\a\sous\2.jpg"]);
        let f = add(&mut inner, r"C:\a\x\3.jpg", false, false, &[r"C:\a\x\3.jpg"]);
        let other = add(&mut inner, r"C:\ab", true, true, &[r"C:\ab\4.jpg"]);
        inner.sources[0].recursive = true;
        inner.absorb_under(p);
        inner.summarize();
        assert_eq!(inner.snapshot.lines, 2, r"le dossier coché et C:\ab seulement");
        assert_eq!((owner(&inner, r"C:\a\sous\2.jpg"), owner(&inner, r"C:\a\x\3.jpg")), (p, p));
        assert_eq!(owner(&inner, r"C:\ab\4.jpg"), other);
        assert_eq!(inner.snapshot.scan.as_ref().unwrap().total, 4, "les chiffres ne bougent pas");

        inner.sources[0].recursive = false;
        inner.release(p);
        inner.summarize();
        assert_eq!(inner.snapshot.lines, 4);
        assert_eq!((owner(&inner, r"C:\a\sous\2.jpg"), owner(&inner, r"C:\a\x\3.jpg")), (s, f));
        assert_eq!(owner(&inner, r"C:\a\1.jpg"), p);
        assert!(inner.sources.iter().filter(|x| x.id != p && x.id != other).all(|x| x.scanning && !x.fresh));
    }

    #[test]
    fn retire_avec_ce_qu_il_a_mis_de_cote() {
        let mut inner = inner();
        let p = add(&mut inner, r"C:\a", true, true, &[]);
        let s = add(&mut inner, r"C:\a\b", true, true, &[]);
        let t = add(&mut inner, r"C:\a\b\c", true, false, &[]);
        let other = add(&mut inner, r"C:\z", true, true, &[]);
        inner.absorb_under(s);
        inner.absorb_under(p);
        assert_eq!(inner.sources.iter().find(|x| x.id == t).unwrap().absorbed_by, Some(s));
        assert_eq!(inner.with_absorbed(p), HashSet::from([p, s, t]));
        assert_eq!(inner.with_absorbed(other), HashSet::from([other]));
    }

    #[test]
    fn sous_un_dossier() {
        assert!(is_under(r"C:\A\b", r"c:\a"));
        assert!(is_under(r"C:\a\b\c.jpg", r"C:\a\"));
        assert!(!is_under(r"C:\ab", r"C:\a"));
        assert!(!is_under(r"C:\a", r"C:\a"));
    }
}
