//! Options de l'import (carte « Options d'import », IMP-30) et ce qu'elles font d'un média : rien, compresser une image
//! dans son format (IMP-20, IMP-62) ou la convertir (IMP-21) ; compresser ou convertir une vidéo (IMP-69, IMP-22 : ce
//! qui est fait dépend de son codec, lu par ffprobe, `video::plan`). Réponses de l'utilisateur : SPEC IMP-21, IMP-69.

use serde::Deserialize;

use crate::formats::Kind;

/// Format choisi dans « Convertir les images en » (IMP-21) ; JFIF = JPEG sous un autre nom.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Target {
    Jpg,
    Jfif,
    Png,
    Webp,
    Avif,
}

impl Target {
    pub fn ext(self) -> &'static str {
        match self {
            Target::Jpg => "jpg",
            Target::Jfif => "jfif",
            Target::Png => "png",
            Target::Webp => "webp",
            Target::Avif => "avif",
        }
    }

    fn family(self) -> Family {
        match self {
            Target::Jpg | Target::Jfif => Family::Jpeg,
            Target::Png => Family::Png,
            Target::Webp => Family::Webp,
            Target::Avif => Family::Avif,
        }
    }
}

/// Format de « Convertir les vidéos en » (IMP-22) : MP4 standard (H.264, défaut), MP4 H.265, WebM (VP9), AV1 (en MP4).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VideoTarget {
    H264,
    H265,
    Webm,
    Av1,
}

/// Demande pour une vidéo : cran de qualité de « Compresser les vidéos » (0 Minimale … 4 Maximale, IMP-24) et format de
/// « Convertir les vidéos en ».
#[derive(Clone, Copy, Debug)]
pub struct VideoRequest {
    pub quality: Option<u8>,
    pub convert: Option<VideoTarget>,
    /// Conversion d'une vidéo illisible depuis la visionneuse (VIEW-25) : le résultat doit être lu par MyBoard.
    pub playable: bool,
}

/// Format réel d'une image, d'après son extension (les variantes de JPEG n'en font qu'un).
#[derive(Clone, Copy, PartialEq, Eq)]
enum Family {
    Jpeg,
    Png,
    Webp,
    Gif,
    Bmp,
    Tiff,
    Avif,
}

fn family_of(ext: &str) -> Option<Family> {
    Some(match ext {
        "jpg" | "jpeg" | "jpe" | "jfif" => Family::Jpeg,
        "png" => Family::Png,
        "webp" => Family::Webp,
        "gif" => Family::Gif,
        "bmp" => Family::Bmp,
        "tif" | "tiff" => Family::Tiff,
        // AVIF, HEIC comme sources : pas encore (IMP-53, lot 12).
        _ => return None,
    })
}

/// Que faire d'une image dont le contenu sera relu (animation vérifiée à ce moment-là).
#[derive(Clone, Copy, Debug)]
pub enum Action {
    /// Même format, à la qualité choisie (JPEG, WebP ; PNG : IMP-62).
    Compress(u8),
    /// Autre format ; `compressed` : « Compresser les images » cochée (nom « _c », règles PNG d'IMP-62).
    Convert { target: Target, quality: u8, compressed: bool },
    /// Vidéo : compresser et / ou convertir, selon son codec (IMP-69, IMP-22).
    Video(VideoRequest),
}

/// Qualité d'une conversion sans compression : la plus haute (IMP-70, réponse Q1 du 11/11 ; 90 jusqu'au lot 5).
const CONVERT_QUALITY: u8 = 100;

/// Traitement demandé pour l'import.
#[derive(Clone, Copy)]
pub struct Process {
    /// Qualité si « Compresser les images » est cochée (20 à 95).
    pub quality: Option<u8>,
    pub convert: Option<Target>,
    /// Réponse « Compresser aussi » / « Convertir aussi » de la pop-in : médias déjà dans la bibliothèque (IMP-60).
    pub existing: bool,
    pub video: VideoRequest,
}

impl Process {
    /// Ce qu'il faut faire d'un média de ce type et de cette extension ; `None` : rien.
    pub fn action(&self, kind: Kind, ext: &str) -> Option<Action> {
        match kind {
            Kind::Image => self.image_action(ext),
            Kind::Video => (self.video.quality.is_some() || self.video.convert.is_some()).then_some(Action::Video(self.video)),
            _ => None,
        }
    }

    fn image_action(&self, ext: &str) -> Option<Action> {
        let source = family_of(ext)?;
        match self.convert {
            Some(target) if target.family() != source => Some(Action::Convert {
                target,
                quality: self.quality.unwrap_or(CONVERT_QUALITY),
                compressed: self.quality.is_some(),
            }),
            _ => self.quality.filter(|_| matches!(source, Family::Jpeg | Family::Webp | Family::Png)).map(Action::Compress),
        }
    }
}

/// Choix de la pop-in des paires (IMP-64) : originaux ET versions compressées dans la même liste.
#[derive(Clone, Copy, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PairChoice {
    /// « Importer les deux ».
    #[default]
    Both,
    /// « Supprimer les doublons » : seuls les originaux sont importés.
    Originals,
    /// « Supprimer les originaux » : seules les versions compressées sont importées.
    Versions,
}

/// Options envoyées au lancement de l'import.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportOptions {
    pub compress_quality: Option<u8>,
    pub convert_to: Option<Target>,
    pub process_existing: bool,
    /// « Supprimer les originaux » (IMP-28), confirmé deux fois.
    pub delete_originals: bool,
    #[serde(default)]
    pub pairs: PairChoice,
    /// « Supprimer du stockage » de la pop-in des paires, confirmé deux fois (IMP-64).
    #[serde(default)]
    pub delete_pair_files: bool,
    /// Cran de « Compresser les vidéos » si elle est cochée (IMP-69, 0 à 4).
    #[serde(default)]
    pub video_quality: Option<u8>,
    #[serde(default)]
    pub convert_videos_to: Option<VideoTarget>,
}

impl ImportOptions {
    /// « Annuler l'import » possible : aucun fichier n'est effacé du disque pendant cet import (réponses Q2, Q3 du 11/11).
    pub fn undoable(&self) -> bool {
        !self.delete_originals && !self.delete_pair_files
    }

    pub fn process(&self) -> Option<Process> {
        let quality = self.compress_quality.map(|q| q.clamp(20, 95));
        let video = VideoRequest { quality: self.video_quality.map(|q| q.min(4)), convert: self.convert_videos_to, playable: false };
        (quality.is_some() || self.convert_to.is_some() || video.quality.is_some() || video.convert.is_some()).then_some(Process {
            quality,
            convert: self.convert_to,
            existing: self.process_existing,
            video,
        })
    }
}
