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
    pub current_file: Option<String>,
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
