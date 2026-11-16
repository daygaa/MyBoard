//! Liste des fichiers choisis, par source (IMP-88 ; réponses Q20 B, Q26 A du 14/11, Q40 A à Q42 A du 15/11) : chaque
//! fichier ou dossier glissé ou choisi par les boutons s'AJOUTE à la liste. Un dossier = une ligne (nombre de fichiers,
//! sa case « sous-dossiers », dépliable, retiré en entier par sa croix) ; un fichier choisi seul = une ligne simple. La
//! case générale (« Sous-dossiers inclus par défaut ») ne sert qu'aux nouveaux dossiers. Ce qui est déjà dans la liste
//! (même fichier, même dossier, dossier dont tous les fichiers y sont déjà) n'est pas ajouté : « Déjà dans la liste ».
//! Les sources à parcourir le sont dans un fil à part (`rescan`).
//!
//! 2e tour (retours du 16/11) : un dossier dont la case « Sous-dossiers » est cochée MET DE CÔTÉ les autres sources
//! placées sous lui (`absorbed_by`) : elles n'ont plus de ligne, il reprend leurs fichiers ; sa case décochée, elles
//! reviennent à leur place ; lui retiré, elles partent avec lui (réponse Q45 B).
//!
//! 3e tour (retours du 16/11) : un fichier retiré par sa croix ne revient plus (`Inner.removed`, retouche 9), sauf s'il
//! est ajouté de nouveau, seul ou avec un dossier au-dessus de lui. Un dossier déjà dans la liste ajouté de nouveau = un
//! nouvel ajout (Q47 B). Un fichier ou un sous-dossier ajouté sous un dossier coché devient sa propre ligne s'il rend des
//! fichiers retirés (Q48), sans être mis de côté par ce dossier tant que sa case ne change pas.

use std::collections::{HashMap, HashSet};
use std::path::Path;

use serde::Serialize;
use tauri::{AppHandle, State};

use super::rescan::rescan;
use super::scan::{ScanFile, ScanSummary};
use super::{Inner, Phase, Refused, Snapshot};
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
    /// Dossier qui contient au moins un dossier : sa case « Sous-dossiers » s'affiche (retouche 7) ; connu après son
    /// premier parcours, gardé pendant les suivants.
    pub subfolders: bool,
    /// Fichiers retenus et leur poids.
    pub files: u64,
    pub bytes: u64,
    /// Pas encore parcouru (ajout, ou case « sous-dossiers » changée).
    pub scanning: bool,
    /// Ajouté par le dernier choix, jamais parcouru : retiré s'il n'apporte rien de nouveau.
    #[serde(skip)]
    pub(super) fresh: bool,
    #[serde(skip)]
    pub(super) ignored: u64,
    #[serde(skip)]
    pub(super) inaccessible: u64,
    /// Mise de côté par ce dossier « Sous-dossiers » coché, placé au-dessus d'elle (IMP-88, retouche 4) : pas de ligne,
    /// aucun fichier (le dossier a repris les siens).
    #[serde(skip)]
    pub(super) absorbed_by: Option<u64>,
}

impl Source {
    pub fn new(id: u64, path: String, folder: bool, recursive: bool) -> Self {
        Self {
            id,
            path,
            folder,
            recursive: folder && recursive,
            subfolders: false,
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
    pub(super) fn shown(&self) -> bool {
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

    /// Le parcours de ce dossier compte déjà les fichiers ignorés ou illisibles de `other` : un fichier placé dans le
    /// dossier, une ligne à part sous un dossier coché (Q48).
    fn counts_also(&self, other: &Source) -> bool {
        if other.folder {
            self.takes_all() && is_under(&other.path, &self.path)
        } else {
            self.covers(Path::new(&other.path))
        }
    }
}

/// `path` est placé sous le dossier `folder` (lui-même exclu ; sans compter la casse, comme Windows).
fn is_under(path: &str, folder: &str) -> bool {
    let (path, folder) = (path.to_lowercase(), folder.to_lowercase());
    let (path, folder) = (Path::new(&path), Path::new(&folder));
    path != folder && path.starts_with(folder)
}

/// Chemin d'un fichier tel que le garde la liste des fichiers retirés (sans la casse, comme Windows).
pub(super) fn removed_key(path: &Path) -> String {
    path.to_string_lossy().to_lowercase()
}

impl Inner {
    pub(super) fn next_id(&mut self) -> u64 {
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
        // Fichiers ignorés ou illisibles comptés une seule fois, même vus par deux lignes.
        let folders: Vec<&Source> = self.sources.iter().filter(|s| s.folder && s.absorbed_by.is_none()).collect();
        let twice: HashSet<u64> = self.sources.iter().filter(|s| folders.iter().any(|f| f.id != s.id && f.counts_also(s))).map(|s| s.id).collect();
        for s in &mut self.sources {
            (s.files, s.bytes) = per.get(&s.id).copied().unwrap_or_default();
            if !twice.contains(&s.id) {
                summary.ignored += s.ignored;
                summary.inaccessible += s.inaccessible;
            }
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
        self.removed.clear();
        self.refusing = Refused::default();
        let (recursive, already, detail) = (self.snapshot.recursive, self.snapshot.already_listed, self.snapshot.already);
        self.snapshot = Snapshot::idle(recursive);
        (self.snapshot.already_listed, self.snapshot.already) = (already, detail);
        self.snapshot.list_version = self.next_id();
    }

    /// Ajout refusé, déjà dans la liste : le badge bref s'affiche (Q42 A, IMP-88, retouche 8).
    pub(super) fn refuse(&mut self, refused: Refused) {
        if refused.folders + refused.files > 0 {
            self.snapshot.already = refused;
            self.snapshot.already_listed += 1;
        }
    }

    /// Fichiers de la liste rangés dans l'ordre de leurs sources (ordre de l'import, comme celui de l'affichage).
    pub(super) fn sort_files(&mut self) {
        let rank: HashMap<u64, usize> = self.sources.iter().enumerate().map(|(i, s)| (s.id, i)).collect();
        self.files.sort_by_key(|f| rank.get(&f.source).copied().unwrap_or(usize::MAX));
    }

    /// Le dossier `id`, « Sous-dossiers » coché, met de côté les autres sources placées sous lui (IMP-88, retouche 4) :
    /// leurs fichiers deviennent les siens tout de suite (les chiffres ne bougent pas), son parcours le confirme.
    /// `false` : aucune source sous lui.
    fn absorb_under(&mut self, id: u64) -> bool {
        let Some(root) = self.sources.iter().find(|s| s.id == id && s.takes_all()).map(|s| s.path.clone()) else { return false };
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
            return false;
        }
        for f in self.files.iter_mut().filter(|f| taken.contains(&f.source)) {
            f.source = id;
        }
        if let Some(s) = self.sources.iter_mut().find(|s| s.id == id) {
            s.ignored += ignored;
            s.inaccessible += inaccessible;
        }
        self.sort_files();
        true
    }

    /// Case « Sous-dossiers » du dossier `id` décochée : les sources qu'il avait mises de côté reviennent, à leur place,
    /// avec leurs fichiers (repris tout de suite, leur parcours le confirme). Chaque fichier va à la ligne la plus proche
    /// qui le couvre, placée SOUS lui : aussi une ligne restée à part (sous-dossier ou fichier ajouté de nouveau, Q48) ;
    /// jamais un dossier au-dessus de lui (retouche 11) : un fichier qu'il ne couvre plus quitte la liste à son parcours.
    fn release(&mut self, id: u64) {
        for s in self.sources.iter_mut().filter(|s| s.absorbed_by == Some(id)) {
            s.absorbed_by = None;
            (s.scanning, s.fresh) = (true, false);
        }
        let Some(root) = self.sources.iter().find(|s| s.id == id).map(|s| s.path.clone()) else { return };
        let lines: Vec<Source> = self.sources.iter().filter(|s| s.absorbed_by.is_none() && is_under(&s.path, &root)).cloned().collect();
        for f in self.files.iter_mut().filter(|f| f.source == id) {
            if let Some(s) = lines.iter().filter(|s| s.covers(&f.path)).max_by_key(|s| s.path.len()) {
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

    /// Oublie le retrait des fichiers que `source` apporte : il est ajouté de nouveau (Q47 B, Q48 C). `true` s'il y en
    /// avait.
    fn forget_removed(&mut self, source: &Source) -> bool {
        let before = self.removed.len();
        self.removed.retain(|p| !source.covers(Path::new(p)));
        self.removed.len() != before
    }

    /// Dossier qui a déjà sa ligne, ajouté de nouveau (Q47 B) : comme un nouvel ajout, sa case prend la valeur de la case
    /// générale et ses fichiers retirés reviennent (ceux de ses sous-dossiers si elle est cochée) ; coché, il reprend les
    /// lignes placées sous lui (Q48). `false` : rien ne change, déjà dans la liste.
    fn readd(&mut self, id: u64, recursive: bool) -> bool {
        let Some(i) = self.sources.iter().position(|s| s.id == id) else { return false };
        let was = std::mem::replace(&mut self.sources[i].recursive, recursive);
        let probe = self.sources[i].clone();
        let restored = self.forget_removed(&probe);
        let absorbed = recursive && self.absorb_under(id);
        if was == recursive && !restored && !absorbed {
            return false;
        }
        self.sources[i].scanning = true;
        if was && !recursive {
            self.release(id);
        }
        true
    }

    /// Ajoute un fichier ou un dossier à la liste (`listed` : fichiers de la liste, sans la casse) ; `false` : déjà dans
    /// la liste, rien ne change.
    fn add_path(&mut self, path: String, folder: bool, recursive: bool, listed: &HashSet<String>) -> bool {
        let low = path.to_lowercase();
        let same = |s: &Source| s.path.to_lowercase() == low;
        if let Some(s) = self.sources.iter().find(|s| s.absorbed_by.is_none() && same(s)) {
            // Un dossier qui a sa ligne : comme un nouvel ajout (Q47 B) ; un fichier qui a la sienne : déjà là.
            let (id, folder) = (s.id, s.folder);
            return folder && self.readd(id, recursive);
        }
        if !folder && listed.contains(&low) {
            return false;
        }
        // Placé sous un dossier coché (ou mis de côté par lui) : seulement s'il rend des fichiers retirés de la liste,
        // qui deviennent sa propre ligne (Q48) ; sinon déjà dans la liste (Q42 A).
        let probe = Source::new(0, path, folder, recursive);
        let covered = self.sources.iter().any(|s| s.takes_all() && is_under(&probe.path, &s.path));
        if covered && !self.removed.iter().any(|p| probe.covers(Path::new(p))) {
            return false;
        }
        self.forget_removed(&probe);
        let id = if let Some(i) = self.sources.iter().position(|s| s.absorbed_by.is_some() && same(s)) {
            // Source mise de côté : elle retrouve sa ligne, à sa place ; celles qu'elle avait mises de côté restent avec
            // le dossier coché au-dessus d'elle.
            let s = &mut self.sources[i];
            let (id, parent) = (s.id, s.absorbed_by.take());
            s.recursive = probe.recursive;
            (s.scanning, s.fresh) = (true, true);
            for c in self.sources.iter_mut().filter(|c| c.absorbed_by == Some(id)) {
                c.absorbed_by = parent;
            }
            id
        } else {
            let id = self.next_id();
            self.sources.push(Source { id, ..probe });
            id
        };
        // Lui-même n'est pas mis de côté par le dossier coché au-dessus de lui (Q48), mais il reprend ce qui est sous lui.
        self.absorb_under(id);
        true
    }

    /// Croix d'une ligne de dossier : il part avec les sources qu'il avait mises de côté (réponse Q45 B). Ses fichiers
    /// qu'une autre ligne reprendrait à son prochain parcours (sous-dossier ajouté de nouveau sous un dossier coché, Q48)
    /// restent retirés ; les autres retraits placés sous lui sont oubliés (retouche 9).
    fn remove_source(&mut self, id: u64) {
        let gone = self.with_absorbed(id);
        let (gone_sources, kept): (Vec<Source>, Vec<Source>) = self.sources.drain(..).partition(|s| gone.contains(&s.id));
        self.sources = kept;
        let lines: Vec<&Source> = self.sources.iter().filter(|s| s.absorbed_by.is_none()).collect();
        let still = |p: &Path| lines.iter().any(|s| s.covers(p));
        let back: Vec<String> = self.files.iter().filter(|f| gone.contains(&f.source) && still(&f.path)).map(|f| removed_key(&f.path)).collect();
        self.removed.retain(|p| still(Path::new(p)) || !gone_sources.iter().any(|g| g.covers(Path::new(p))));
        self.removed.extend(back);
        self.files.retain(|f| !gone.contains(&f.source));
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
    let mut added = false;
    manager.update(false, |inner| {
        if fresh_start {
            inner.unreadable.clear();
            inner.reset();
        }
        inner.snapshot.recursive = recursive;
        let listed: HashSet<String> = inner.files.iter().map(|f| removed_key(&f.path)).collect();
        let mut batch: HashSet<String> = HashSet::new();
        let mut refused = Refused::default();
        for (path, folder) in kinds {
            if !batch.insert(path.to_lowercase()) || !inner.add_path(path, folder, recursive, &listed) {
                refused.add(folder);
                continue;
            }
            added = true;
        }
        if !added {
            inner.refuse(refused);
            return;
        }
        // Un seul badge pour tout l'ajout, à la fin de son parcours (un dossier peut encore s'avérer déjà là).
        inner.refusing.plus(refused);
        inner.snapshot.phase = Phase::Scanning;
        inner.snapshot.result = None;
        inner.snapshot.progress = None;
        inner.snapshot.undoable = false;
        if inner.snapshot.scan.is_none() {
            inner.snapshot.scan = Some(ScanSummary::default());
        }
        inner.summarize();
    });
    if added {
        rescan(&app, manager);
    }
    Ok(())
}

/// Croix d'une ligne de dossier : le dossier et tous ses fichiers quittent la liste.
#[tauri::command]
pub fn remove_scan_source(app: AppHandle, state: State<'_, AppState>, id: u64) {
    let manager = &state.import;
    manager.update(false, |inner| {
        if !matches!(inner.snapshot.phase, Phase::Scanning | Phase::Ready) {
            return;
        }
        inner.remove_source(id);
        inner.after_removal();
    });
    if manager.snapshot().phase == Phase::Scanning {
        rescan(&app, manager);
    }
    super::video::checks::changed();
}

/// Case « sous-dossiers » d'une ligne de dossier : il est parcouru de nouveau, avec ou sans ses sous-dossiers, en
/// gardant ses anciens fichiers jusqu'à la fin du parcours. Cochée : il met de côté les sources placées sous lui ;
/// décochée : elles reviennent (IMP-88, retouche 4). Ses fichiers retirés ne reviennent pas (retouche 9).
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
#[path = "sources_tests.rs"]
mod tests;
