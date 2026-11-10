//! État de l'import tel que l'interface le reçoit (`import-state`) : phase, progression, résultat.

use serde::Serialize;

use super::scan::ScanSummary;
use crate::reserve::RestoreCandidate;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Phase {
    Idle,
    Scanning,
    Ready,
    Importing,
    Finished,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub total: u64,
    pub processed: u64,
    pub imported: u64,
    pub updated: u64,
    pub already_present: u64,
    pub duplicates: u64,
    pub errors: u64,
    /// Compression des images (IMP-20) : versions compressées gardées ; originaux gardés faute d'au moins 5 % de
    /// gain ; compressions impossibles (original importé tel quel).
    pub compressed: u64,
    /// Converties dans le format choisi (IMP-21).
    pub converted: u64,
    pub not_smaller: u64,
    pub compress_failed: u64,
    /// Fichiers écartés d'une paire original + version (IMP-64).
    pub set_aside: u64,
    /// Fichiers effacés du disque (originaux, IMP-28 ; fichiers écartés, IMP-64) et effacements impossibles.
    pub deleted: u64,
    pub delete_failed: u64,
    /// Vidéos compressées (IMP-69), converties (IMP-22), et dans un ancien format, jamais compressées.
    pub videos_compressed: u64,
    pub videos_converted: u64,
    pub videos_unsupported: u64,
    pub current_file: Option<String>,
    /// Vidéo en cours de traitement : son chemin (miniature) et son avancement, de 0 à 1 (IMP-41).
    pub current_path: Option<String>,
    pub file_progress: Option<f32>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileError {
    pub path: String,
    pub message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub cancelled: bool,
    /// Erreur qui a interrompu tout l'import (base inaccessible…).
    pub fatal: Option<String>,
    pub error_files: Vec<FileError>,
    pub elapsed_ms: u64,
    /// Médias réimportés dont les données sont en réserve (DEL-05) ; vidé une fois la pop-in réglée.
    pub restorable: Vec<RestoreCandidate>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub phase: Phase,
    /// Fichiers et dossiers choisis (bouton ou glisser-déposer).
    pub sources: Vec<String>,
    pub recursive: bool,
    pub scan: Option<ScanSummary>,
    pub progress: Option<Progress>,
    pub result: Option<ImportResult>,
}
