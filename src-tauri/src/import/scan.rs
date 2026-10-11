//! Parcours de ce que l'utilisateur a choisi ou déposé : fichiers et dossiers mélangés
//! (IMP-01, IMP-02, IMP-03, IMP-04, IMP-05).

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use serde::Serialize;
use walkdir::WalkDir;

use crate::formats::{self, Kind};

pub struct ScanFile {
    pub path: PathBuf,
    pub kind: Kind,
    pub ext: String,
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
    seen: HashSet<PathBuf>,
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
            return; // fichier déposé ET présent dans un dossier déposé
        }
        match kind {
            Kind::Image => self.summary.images += 1,
            Kind::Video => self.summary.videos += 1,
            Kind::Audio => self.summary.audio += 1,
            Kind::Document => self.summary.documents += 1,
        }
        self.summary.total += 1;
        self.summary.bytes += size;
        self.files.push(ScanFile { path, kind, ext });
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
            if entry.file_type().is_file() {
                // Sous Windows, la taille vient de la lecture du dossier : pas d'accès disque en plus.
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                self.add(entry.into_path(), size);
            }
        }
        true
    }
}

/// Parcourt les fichiers et dossiers choisis ; `stop()` permet d'abandonner,
/// `progress` est appelé ~10 fois par seconde.
pub fn scan(
    roots: &[PathBuf],
    recursive: bool,
    stop: impl Fn() -> bool,
    mut progress: impl FnMut(&ScanSummary),
) -> Option<(Vec<ScanFile>, ScanSummary)> {
    let mut collector = Collector {
        files: Vec::new(),
        seen: HashSet::new(),
        summary: ScanSummary::default(),
        last: Instant::now(),
        progress: &mut progress,
    };
    for root in roots {
        match std::fs::metadata(root) {
            Ok(meta) if meta.is_dir() => {
                if !collector.walk(root, recursive, &stop) {
                    return None;
                }
            }
            Ok(meta) => collector.add(root.clone(), meta.len()),
            Err(_) => collector.summary.inaccessible += 1,
        }
    }
    Some((collector.files, collector.summary))
}
