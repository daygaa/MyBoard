//! Fichiers qu'aucun programme du PC ne sait lire (IMP-87, réponses Q15 A du 14/11 et Q29 A du 15/11) : pas importés,
//! listés dans le bilan avec « Les importer quand même ».
//! - Images : seulement les formats lus par un programme qui peut manquer : HEIF / HEIC (ffmpeg 8.1 ou plus), DNG
//!   (décodeur de Windows). Les autres sont lus par MyBoard lui-même ; l'AVIF, que la visionneuse lit elle-même, n'est
//!   jamais compté illisible.
//! - Vidéos : lues par ffprobe (une lecture faite avant l'import est réutilisée). Vérifié le 15/11 : les 828 vidéos de
//!   l'échantillon (15 extensions) sont toutes lues ; le lecteur intégré ouvre lui-même les vidéos avec FFmpeg. Sans
//!   ffmpeg du tout : pas de vérification, la vidéo est importée comme avant.
//!
//! Un fichier abîmé d'un format lisible n'est découvert qu'à sa miniature, après l'import : il reste importé (carte
//! « illisible » de la visionneuse, VIEW-59).

use super::scan::ScanFile;
use super::video::{checks, probe};
use crate::formats::Kind;

/// Raison affichée dans le bilan (réponse Q30 A du 15/11).
const VIDEO: &str = "ffmpeg ne sait pas lire cette vidéo";

/// La raison, si aucun programme du PC ne sait lire ce fichier.
pub fn unreadable(file: &ScanFile) -> Option<String> {
    let ff = crate::ffmpeg::shared();
    match file.kind {
        Kind::Image => crate::photos::missing_decoder(ff, &file.path).map(String::from),
        Kind::Video => {
            let ff = ff?;
            let readable = checks::cached(&file.path, file.size).is_some_and(|p| !p.streams.is_empty())
                || probe::probe(&ff.ffprobe, &file.path).is_ok_and(|p| !p.streams.is_empty());
            (!readable).then(|| VIDEO.to_owned())
        }
        _ => None,
    }
}
