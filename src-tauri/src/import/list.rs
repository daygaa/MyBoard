//! Liste des fichiers choisis, avant l'import (IMP-10, IMP-11, IMP-12) : lue par pages (100 lignes à la fois
//! dans l'interface, fluide même avec 100 000 fichiers choisis) ; retirer un fichier de la liste (croix, menu du
//! clic droit, CTX-14), tout vider (IMP-51), afficher un fichier dans l'Explorateur (CTX-14).

use std::path::Path;
use std::sync::atomic::Ordering;

use serde::Serialize;
use tauri::State;

use super::scan::{ScanEntry, ScanFile};
use super::{Phase, Snapshot};
use crate::AppState;

impl super::ImportManager {
    /// Ce chemin fait partie de la liste en cours (seuls ces fichiers ont un aperçu, `thumb://apercu`).
    pub fn has_file(&self, path: &str) -> bool {
        self.inner.lock().unwrap().files.iter().any(|f| f.path.as_os_str() == path)
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanPage {
    pub entries: Vec<ScanEntry>,
    pub total: usize,
}

/// Lignes `offset` à `offset + limit` de la liste (1 000 au plus par appel).
#[tauri::command]
pub fn scan_files(state: State<'_, AppState>, offset: usize, limit: usize) -> ScanPage {
    let inner = state.import.inner.lock().unwrap();
    ScanPage {
        entries: inner.files.iter().skip(offset).take(limit.min(1000)).map(ScanFile::entry).collect(),
        total: inner.files.len(),
    }
}

/// Retire un fichier de la liste (avant l'import seulement) ; le résumé et le bouton « Importer (N) » suivent.
#[tauri::command]
pub fn remove_scan_file(state: State<'_, AppState>, path: String) {
    state.import.update(false, |inner| {
        if inner.snapshot.phase != Phase::Ready {
            return;
        }
        if let Some(i) = inner.files.iter().position(|f| f.path.as_os_str() == path.as_str()) {
            let file = inner.files.remove(i);
            if let Some(scan) = &mut inner.snapshot.scan {
                scan.forget(&file);
            }
        }
    });
}

/// « Tout vider » (IMP-51) : la page revient à son état de départ ; un parcours en cours s'arrête.
#[tauri::command]
pub fn clear_scan(state: State<'_, AppState>) -> Result<(), String> {
    let manager = &state.import;
    if !matches!(manager.snapshot().phase, Phase::Scanning | Phase::Ready) {
        return Err("Rien à vider pendant un import.".into());
    }
    manager.generation.fetch_add(1, Ordering::SeqCst);
    manager.update(false, |inner| {
        inner.files.clear();
        let recursive = inner.snapshot.recursive;
        inner.snapshot = Snapshot { phase: Phase::Idle, sources: Vec::new(), recursive, scan: None, progress: None, result: None };
    });
    Ok(())
}

/// Explorateur ouvert sur un fichier de la liste ou de la liste des erreurs de l'import (CTX-14).
#[tauri::command]
pub fn reveal_scan_file(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let known = {
        let inner = state.import.inner.lock().unwrap();
        inner.files.iter().any(|f| f.path.as_os_str() == path.as_str())
            || inner.snapshot.result.as_ref().is_some_and(|r| r.error_files.iter().any(|e| e.path == path))
    };
    if !known {
        return Err("Ce fichier ne fait pas partie de l'import.".into());
    }
    crate::media::reveal(Path::new(&path)).map_err(|e| e.to_string())
}
