//! Originaux ET versions compressées dans la même liste (IMP-64) : après une suppression de la bibliothèque, un
//! réimport du dossier ajouterait les deux. Une paire (réponse Q9b du 10/11) : « photo.jpg » et « photo_c.jpg »
//! (ou « photo_c (1).webp »…) dans le même dossier, mêmes dimensions d'image, aucun des deux dans la bibliothèque.
//! Les numéros « (1) » d'un original sont gardés : « photo (1).jpg » va avec « photo (1)_c.jpg ».

use std::collections::HashMap;
use std::path::PathBuf;

use rusqlite::Connection;

use super::scan::ScanFile;
use crate::formats::Kind;

pub struct Pair {
    pub original: PathBuf,
    pub version: PathBuf,
}

/// Nom de base d'une version : « photo_c » ou « photo_c (2) » → « photo ».
fn base_of(stem: &str) -> Option<&str> {
    let stem = match stem.strip_suffix(')').and_then(|s| s.rsplit_once(" (")) {
        Some((head, n)) if !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()) => head,
        _ => stem,
    };
    stem.strip_suffix("_c").filter(|b| !b.is_empty())
}

pub fn find(files: &[ScanFile], conn: &Connection) -> rusqlite::Result<Vec<Pair>> {
    let images: Vec<&ScanFile> = files.iter().filter(|f| f.kind == Kind::Image).collect();
    // (dossier, nom sans extension) en minuscules → fichiers.
    let mut by_name: HashMap<(String, String), Vec<&ScanFile>> = HashMap::new();
    for f in &images {
        let dir = f.path.parent().map(|p| p.to_string_lossy().to_lowercase()).unwrap_or_default();
        let stem = f.path.file_stem().map(|s| s.to_string_lossy().to_lowercase()).unwrap_or_default();
        by_name.entry((dir, stem)).or_default().push(f);
    }
    let mut known = conn.prepare_cached("SELECT 1 FROM media WHERE path = ?1")?;
    let mut in_library = |f: &ScanFile| known.exists([f.path.to_string_lossy()]).unwrap_or(false);
    let mut pairs = Vec::new();
    for version in &images {
        let stem = version.path.file_stem().map(|s| s.to_string_lossy().to_lowercase()).unwrap_or_default();
        let Some(base) = base_of(&stem) else { continue };
        let dir = version.path.parent().map(|p| p.to_string_lossy().to_lowercase()).unwrap_or_default();
        let Some(candidates) = by_name.get(&(dir, base.to_owned())) else { continue };
        let Ok(size) = imagesize::size(&version.path) else { continue };
        let original = candidates
            .iter()
            .find(|o| o.path != version.path && imagesize::size(&o.path).is_ok_and(|s| (s.width, s.height) == (size.width, size.height)));
        if let Some(original) = original
            && !in_library(version)
            && !in_library(original)
        {
            pairs.push(Pair { original: original.path.clone(), version: version.path.clone() });
        }
    }
    Ok(pairs)
}

/// Nombre de paires de la liste en cours : la pop-in d'IMP-64 ne s'ouvre que s'il y en a.
#[tauri::command]
pub async fn count_pairs(app: tauri::AppHandle) -> Result<usize, String> {
    use tauri::Manager;
    let count = tauri::async_runtime::spawn_blocking(move || -> anyhow::Result<usize> {
        let state = app.state::<crate::AppState>();
        let files = state.import.inner.lock().unwrap().files.clone();
        let conn = crate::db::open(&state.paths.db)?;
        Ok(find(&files, &conn)?.len())
    });
    count.await.map_err(|e| e.to_string())?.map_err(|e| format!("{e:#}"))
}
