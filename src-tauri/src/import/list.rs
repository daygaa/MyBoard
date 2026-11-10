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

/// Médias de la liste à proposer dans la pop-in, par type : son texte s'accorde (« images », « vidéos », « médias »…).
#[derive(Default, Serialize)]
pub struct KindCounts {
    pub images: u64,
    pub videos: u64,
    pub audio: u64,
    pub documents: u64,
}

/// Médias de la liste déjà dans la bibliothèque au même endroit et jamais traités (aujourd'hui : des images) que les
/// options demandées (compression, conversion) changeraient : la pop-in « Compresser aussi » ne s'ouvre que s'il y en
/// a (IMP-60). Une recherche par chemin (index) par fichier, hors de la fenêtre. L'original d'une paire (IMP-64, IMP-68)
/// n'est jamais retraité : pas compté (réponse Q2 du 10/11).
#[tauri::command]
pub async fn count_compressible_existing(
    app: tauri::AppHandle,
    compress_quality: Option<u8>,
    convert_to: Option<super::plan::Target>,
    video_quality: Option<u8>,
    convert_videos_to: Option<super::plan::VideoTarget>,
) -> Result<KindCounts, String> {
    use crate::formats::Kind;
    use tauri::Manager;
    let counts = tauri::async_runtime::spawn_blocking(move || -> anyhow::Result<KindCounts> {
        let state = app.state::<AppState>();
        let (files, all): (Vec<(String, Kind)>, Vec<ScanFile>) = {
            let inner = state.import.inner.lock().unwrap();
            let video = super::plan::VideoRequest { quality: video_quality, convert: convert_videos_to };
            let process = super::plan::Process { quality: compress_quality, convert: convert_to, existing: true, video };
            // Vidéos : comptées d'après leur extension ; celles déjà au bon format seront laissées telles quelles.
            let eligible = |f: &&ScanFile| process.action(f.kind, &f.ext).is_some();
            let files = inner.files.iter().filter(eligible).filter_map(|f| Some((f.path.to_str()?.to_owned(), f.kind))).collect();
            (files, inner.files.clone())
        };
        let conn = crate::db::open(&state.paths.db)?;
        let paired: std::collections::HashSet<String> =
            super::pairs::find(&all, &conn)?.into_iter().map(|p| p.original.to_string_lossy().to_lowercase()).collect();
        let mut known = conn.prepare("SELECT 1 FROM media WHERE path = ?1 AND original_hash IS NULL")?;
        let mut counts = KindCounts::default();
        for (path, kind) in &files {
            // Une image animée ne sera jamais traitée : pas comptée (lue seulement si elle est déjà connue).
            if paired.contains(&path.to_lowercase()) || !known.exists([path])? || super::compress::animated(Path::new(path)) {
                continue;
            }
            *match kind {
                Kind::Image => &mut counts.images,
                Kind::Video => &mut counts.videos,
                Kind::Audio => &mut counts.audio,
                Kind::Document => &mut counts.documents,
            } += 1;
        }
        Ok(counts)
    });
    counts.await.map_err(|e| e.to_string())?.map_err(|e| format!("{e:#}"))
}
