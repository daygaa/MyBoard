//! État de l'import tel que l'interface le reçoit (`import-state`) : phase, progression, résultat.

use serde::Serialize;

use super::dups::DupGroup;
use super::scan::ScanSummary;
use super::undo::Undone;
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
    /// Médias dont le fichier avait disparu, retrouvés à un autre endroit (LIB-05).
    pub relocated: u64,
    pub errors: u64,
    /// Fichiers effacés pendant l'import (IMP-54).
    pub vanished: u64,
    /// Fichiers qu'aucun programme du PC ne sait lire, pas importés (IMP-87).
    pub unreadable: u64,
    /// « Les importer quand même » (IMP-87) : médias ajoutés par l'import précédent, défaits avec celui-ci (confirmation
    /// d'« Annuler l'import »).
    pub earlier_added: u64,
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
    /// Vidéos converties sans leurs sous-titres en images (non acceptés par le format choisi, IMP-73).
    pub videos_subtitles_lost: u64,
    /// Poids, en octets, des originaux et de leurs versions gardées (bilan : taux moyen, place gagnée, IMP-45).
    pub images_before: u64,
    pub images_after: u64,
    pub videos_before: u64,
    pub videos_after: u64,
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
    /// « Terminer ici » (IMP-42) : la suite de la liste est abandonnée.
    pub cancelled: bool,
    /// Erreur qui a interrompu tout l'import (base inaccessible…).
    pub fatal: Option<String>,
    pub error_files: Vec<FileError>,
    /// Fichiers effacés pendant l'import (IMP-54), les 200 premiers.
    pub vanished_files: Vec<String>,
    /// Fichiers illisibles sur ce PC (IMP-87), les 200 premiers, avec la raison ; tous restent proposés à « Les importer
    /// quand même ».
    pub unreadable_files: Vec<FileError>,
    /// « Annuler l'import » (IMP-43) : ce qui a été défait.
    pub undone: Option<Undone>,
    pub elapsed_ms: u64,
    /// Médias réimportés dont les données sont en réserve (DEL-05) ; vidé une fois la pop-in réglée.
    pub restorable: Vec<RestoreCandidate>,
    /// Doublons trouvés pendant l'import, par média (IMP-91) ; « Supprimer les doublons » les retire.
    pub duplicate_groups: Vec<DupGroup>,
    /// Bilan fermé (IMP-45) : la pop-in de restauration peut s'ouvrir, et le bilan ne revient plus.
    pub reported: bool,
}

/// Import en pause (IMP-42) ; `offline` : pause automatique, cet emplacement est devenu inaccessible (IMP-54).
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Paused {
    pub offline: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub phase: Phase,
    /// Lignes de la liste : fichiers et dossiers ajoutés (bouton ou glisser-déposer, IMP-88) ; `list_version` change à
    /// chaque changement de la liste.
    pub lines: u64,
    pub list_version: u64,
    /// Case « Sous-dossiers inclus par défaut » : choix des nouveaux dossiers (IMP-88, réponse Q26 A).
    pub recursive: bool,
    /// Ajouts refusés, déjà dans la liste (Q42 A) : « Déjà dans la liste » s'affiche à chaque hausse.
    pub already_listed: u64,
    pub scan: Option<ScanSummary>,
    pub progress: Option<Progress>,
    pub result: Option<ImportResult>,
    pub paused: Option<Paused>,
    /// « Annuler l'import » possible pour l'import en cours (grisé sinon, réponses Q2, Q3 du 11/11).
    pub undoable: bool,
}

impl Snapshot {
    /// Page à son état de départ : rien de choisi.
    pub fn idle(recursive: bool) -> Self {
        Self {
            phase: Phase::Idle,
            lines: 0,
            list_version: 0,
            recursive,
            already_listed: 0,
            scan: None,
            progress: None,
            result: None,
            paused: None,
            undoable: false,
        }
    }
}
