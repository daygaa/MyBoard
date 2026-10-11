//! Parcours d'un dossier : liste des fichiers pris en charge (IMP-02, IMP-04, IMP-05).

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

/// Parcourt `root` ; `stop()` permet d'abandonner, `progress` est appelé ~10 fois par seconde.
pub fn scan(
    root: &Path,
    recursive: bool,
    stop: impl Fn() -> bool,
    mut progress: impl FnMut(&ScanSummary),
) -> Option<(Vec<ScanFile>, ScanSummary)> {
    let mut files = Vec::new();
    let mut summary = ScanSummary::default();
    let mut last = Instant::now();

    let walker = WalkDir::new(root)
        .max_depth(if recursive { usize::MAX } else { 1 })
        .follow_links(false)
        .sort_by_file_name()
        .into_iter()
        .filter_entry(|e| !(e.file_type().is_dir() && is_system_dir(&e.file_name().to_string_lossy())));

    for entry in walker {
        if stop() {
            return None;
        }
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => {
                summary.inaccessible += 1;
                continue;
            }
        };
        if !entry.file_type().is_file() {
            continue;
        }
        // Sous Windows, la taille vient de la lecture du dossier : pas d'accès disque en plus.
        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
        let path = entry.into_path();
        let Some((kind, ext)) = formats::extension(&path).and_then(|ext| formats::kind_of_ext(&ext).map(|k| (k, ext)))
        else {
            summary.ignored += 1;
            continue;
        };
        match kind {
            Kind::Image => summary.images += 1,
            Kind::Video => summary.videos += 1,
            Kind::Audio => summary.audio += 1,
            Kind::Document => summary.documents += 1,
        }
        summary.total += 1;
        summary.bytes += size;
        files.push(ScanFile { path, kind, ext });

        if last.elapsed() > Duration::from_millis(100) {
            progress(&summary);
            last = Instant::now();
        }
    }
    Some((files, summary))
}
