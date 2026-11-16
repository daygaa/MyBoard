//! Parcours de ce que l'utilisateur a choisi ou déposé : fichiers et dossiers mélangés
//! (IMP-01, IMP-02, IMP-03, IMP-04, IMP-05), une source (fichier ou dossier ajouté, IMP-88) à la fois.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use serde::Serialize;
use walkdir::WalkDir;

use crate::formats::{self, Kind};

#[derive(Clone)]
pub struct ScanFile {
    pub path: PathBuf,
    pub kind: Kind,
    pub ext: String,
    /// Poids, lu avec le dossier (liste avant l'import, IMP-10).
    pub size: u64,
    /// Fichier ou dossier ajouté qui l'a apporté (liste groupée, IMP-88).
    pub source: u64,
}

/// Une ligne de la liste des fichiers avant l'import (IMP-10).
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanEntry {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub ext: String,
    pub kind: &'static str,
}

impl ScanFile {
    pub fn entry(&self) -> ScanEntry {
        ScanEntry {
            path: self.path.display().to_string(),
            name: self.path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
            size: self.size,
            ext: self.ext.clone(),
            kind: self.kind.as_str(),
        }
    }
}

impl ScanSummary {
    /// Un fichier de plus dans la liste : les compteurs suivent.
    pub fn count(&mut self, file: &ScanFile) {
        match file.kind {
            Kind::Image => self.images += 1,
            Kind::Video => self.videos += 1,
            Kind::Audio => self.audio += 1,
            Kind::Document => self.documents += 1,
        }
        self.total += 1;
        self.bytes += file.size;
    }

    /// Résumé de la liste pendant un parcours : ce qui y était déjà, plus ce que le parcours a trouvé.
    pub fn plus(&self, other: &ScanSummary) -> ScanSummary {
        ScanSummary {
            total: self.total + other.total,
            images: self.images + other.images,
            videos: self.videos + other.videos,
            audio: self.audio + other.audio,
            documents: self.documents + other.documents,
            ignored: self.ignored + other.ignored,
            inaccessible: self.inaccessible + other.inaccessible,
            bytes: self.bytes + other.bytes,
        }
    }
}

/// Résumé affiché avant de lancer l'import.
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSummary {
    pub total: u64,
    pub images: u64,
    pub videos: u64,
    pub audio: u64,
    pub documents: u64,
    /// Fichiers d'un format non pris en charge (IMP-05 : « X fichiers ignorés »).
    pub ignored: u64,
    /// Dossiers ou fichiers illisibles (droits d'accès…).
    pub inaccessible: u64,
    pub bytes: u64,
}

/// Dossiers système Windows à ne jamais parcourir.
fn is_system_dir(name: &str) -> bool {
    name.eq_ignore_ascii_case("$RECYCLE.BIN") || name.eq_ignore_ascii_case("System Volume Information")
}

struct Collector<'a> {
    files: Vec<ScanFile>,
    seen: &'a mut HashSet<PathBuf>,
    source: u64,
    /// Fichiers pris en charge déjà dans la liste (« Déjà dans la liste », IMP-88).
    already: u64,
    /// Au moins un dossier sous la racine, même sans fichier pris en charge (IMP-88, retouche 7).
    subfolders: bool,
    summary: ScanSummary,
    last: Instant,
    progress: &'a mut dyn FnMut(&ScanSummary),
}

impl Collector<'_> {
    /// Retient un fichier s'il est d'un format pris en charge (une seule fois par chemin).
    fn add(&mut self, path: PathBuf, size: u64) {
        let Some((kind, ext)) = formats::extension(&path).and_then(|ext| formats::kind_of_ext(&ext).map(|k| (k, ext)))
        else {
            self.summary.ignored += 1;
            return;
        };
        if !self.seen.insert(path.clone()) {
            self.already += 1; // déjà apporté par un autre fichier ou dossier ajouté
            return;
        }
        let file = ScanFile { path, kind, ext, size, source: self.source };
        self.summary.count(&file);
        self.files.push(file);
        if self.last.elapsed() > Duration::from_millis(100) {
            (self.progress)(&self.summary);
            self.last = Instant::now();
        }
    }

    /// Parcourt un dossier ; `false` si le parcours a été abandonné.
    fn walk(&mut self, root: &Path, recursive: bool, stop: &dyn Fn() -> bool) -> bool {
        let walker = WalkDir::new(root)
            .max_depth(if recursive { usize::MAX } else { 1 })
            .follow_links(false)
            .sort_by_file_name()
            .into_iter()
            .filter_entry(|e| !(e.file_type().is_dir() && is_system_dir(&e.file_name().to_string_lossy())));
        for entry in walker {
            if stop() {
                return false;
            }
            let Ok(entry) = entry else {
                self.summary.inaccessible += 1;
                continue;
            };
            if entry.depth() > 0 && entry.file_type().is_dir() {
                self.subfolders = true;
            } else if entry.file_type().is_file() {
                // Sous Windows, la taille vient de la lecture du dossier : pas d'accès disque en plus.
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                self.add(entry.into_path(), size);
            }
        }
        true
    }
}

/// Ce qu'a trouvé le parcours d'une source.
pub struct Found {
    pub files: Vec<ScanFile>,
    pub summary: ScanSummary,
    pub already: u64,
    /// La racine contient au moins un dossier (hors dossiers système) : case « Sous-dossiers » affichée.
    pub subfolders: bool,
}

/// Parcourt un fichier ou un dossier ajouté (`source`) ; `seen` : chemins déjà dans la liste (jamais deux fois) ;
/// `stop()` permet d'abandonner, `progress` est appelé ~10 fois par seconde.
pub fn scan(
    root: &Path,
    recursive: bool,
    source: u64,
    seen: &mut HashSet<PathBuf>,
    stop: impl Fn() -> bool,
    mut progress: impl FnMut(&ScanSummary),
) -> Option<Found> {
    let mut collector = Collector {
        files: Vec::new(),
        seen,
        source,
        already: 0,
        subfolders: false,
        summary: ScanSummary::default(),
        last: Instant::now(),
        progress: &mut progress,
    };
    match std::fs::metadata(root) {
        Ok(meta) if meta.is_dir() => {
            if !collector.walk(root, recursive, &stop) {
                return None;
            }
        }
        Ok(meta) => collector.add(root.to_path_buf(), meta.len()),
        Err(_) => collector.summary.inaccessible += 1,
    }
    Some(Found { files: collector.files, summary: collector.summary, already: collector.already, subfolders: collector.subfolders })
}
