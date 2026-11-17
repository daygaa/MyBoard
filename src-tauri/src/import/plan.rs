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
    /// Réponse « Oui » de la pop-in des fichiers qu'on ne peut pas compresser (IMP-85) : une vidéo que « Compresser les
    /// vidéos » laisserait telle quelle (ancien format, conteneur non pris en charge) est convertie dans ce format.
    pub fallback: Option<VideoTarget>,
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
    /// HEIF / HEIC (IMP-82) : lus par `photos.rs`.
    Heif,
    /// Lot R7 (IMP-89, réponse Q53 A) : TGA et QOI, peu compressés ou peu lus ailleurs : comme BMP.
    Tga,
    Qoi,
    /// JPEG XL : compressé par ffmpeg (libjxl), gardé s'il est au moins 5 % plus léger (réponse Q56 A du 17/11) ;
    /// converti par « Convertir en ».
    Jxl,
    /// « Originaux de travail » : RAW d'appareils photo, DNG, EXR, HDR, SVG (et PSD, devenu un document : Q55 A) ;
    /// ICO (réponse Q57 A du 17/11). Jamais compressés ni convertis. Réglage pour l'autoriser plus tard : SET-21.
    Work,
}

impl Family {
    /// Compressée dans son format par « Compresser les images » (AVIF : réponse Q7 B du 13/11, IMP-85 ; JPEG XL : Q56 A).
    fn compressible(self) -> bool {
        matches!(self, Family::Jpeg | Family::Webp | Family::Png | Family::Avif | Family::Jxl)
    }

    /// Ne peut pas être compressée dans son format : citée par la pop-in d'IMP-85, convertie si on y répond « Oui ».
    /// Pas le GIF (réponse Q7 du 13/11 : laissé tel quel, sans le dire).
    fn uncompressible(self) -> bool {
        matches!(self, Family::Bmp | Family::Tiff | Family::Heif | Family::Tga | Family::Qoi)
    }
}

fn family_of(ext: &str) -> Option<Family> {
    Some(match ext {
        "jpg" | "jpeg" | "jpe" | "jfif" => Family::Jpeg,
        "png" => Family::Png,
        "webp" => Family::Webp,
        "gif" => Family::Gif,
        "bmp" => Family::Bmp,
        "tif" | "tiff" => Family::Tiff,
        // Lues par ffmpeg (AVIF) ou `photos.rs` (HEIF, DNG) : IMP-82, IMP-85.
        "avif" => Family::Avif,
        "heic" | "heif" => Family::Heif,
        // Lot R7 (IMP-89, réponse Q53 A).
        "tga" => Family::Tga,
        "qoi" => Family::Qoi,
        "jxl" => Family::Jxl,
        "dng" | "psd" | "exr" | "hdr" | "svg" | "ico" => Family::Work,
        _ if crate::decode::raw::EXTENSIONS.contains(&ext) => Family::Work,
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
    /// Réponse « Oui » de la pop-in d'IMP-85 : format des images que « Compresser les images » laisserait telles quelles.
    pub fallback: Option<Target>,
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
        if source == Family::Work {
            return None;
        }
        match self.convert {
            Some(target) if target.family() != source => Some(Action::Convert {
                target,
                quality: self.quality.unwrap_or(CONVERT_QUALITY),
                compressed: self.quality.is_some(),
            }),
            _ => match self.quality {
                Some(quality) if source.compressible() => Some(Action::Compress(quality)),
                Some(quality) if source.uncompressible() => self.fallback.map(|target| Action::Convert { target, quality, compressed: true }),
                _ => None,
            },
        }
    }

    /// Image que « Compresser les images » laisserait telle quelle faute de savoir la compresser (pop-in d'IMP-85).
    pub fn uncompressible_image(&self, ext: &str) -> bool {
        let Some(source) = family_of(ext) else { return false };
        self.quality.is_some() && source.uncompressible() && !self.convert.is_some_and(|t| t.family() != source)
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
#[derive(Default, Deserialize)]
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
    /// Réponses « Oui » de la pop-in d'IMP-85 (format choisi), `None` pour « Non » ou sans pop-in.
    #[serde(default)]
    pub convert_uncompressible: Option<Target>,
    #[serde(default)]
    pub convert_uncompressible_videos: Option<VideoTarget>,
    /// « Les importer quand même » (IMP-87) : fichiers illisibles sur ce PC importés tels quels ; jamais envoyé par
    /// l'interface.
    #[serde(skip)]
    pub accept_unreadable: bool,
}

impl ImportOptions {
    /// « Annuler l'import » possible : aucun fichier n'est effacé du disque pendant cet import (réponses Q2, Q3 du 11/11).
    pub fn undoable(&self) -> bool {
        !self.delete_originals && !self.delete_pair_files
    }

    pub fn process(&self) -> Option<Process> {
        let quality = self.compress_quality.map(|q| q.clamp(20, 95));
        let video = VideoRequest {
            quality: self.video_quality.map(|q| q.min(4)),
            convert: self.convert_videos_to,
            fallback: self.convert_uncompressible_videos,
            playable: false,
        };
        (quality.is_some() || self.convert_to.is_some() || video.quality.is_some() || video.convert.is_some()).then_some(Process {
            quality,
            convert: self.convert_to,
            fallback: self.convert_uncompressible,
            existing: self.process_existing,
            video,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn process(quality: Option<u8>, convert: Option<Target>, fallback: Option<Target>) -> Process {
        let video = VideoRequest { quality: None, convert: None, fallback: None, playable: false };
        Process { quality, convert, fallback, existing: false, video }
    }

    /// Lot R7 (IMP-89, réponse Q53 A) : ce que deviennent les nouveaux formats.
    #[test]
    fn formats_du_lot_r7() {
        let compress = process(Some(50), None, None);
        let convert = process(None, Some(Target::Webp), None);
        // « Originaux de travail » et ICO (Q57 A) : jamais compressés ni convertis, jamais dans la pop-in.
        for ext in ["dng", "cr2", "nef", "psd", "exr", "hdr", "svg", "ico"] {
            assert!(!compress.uncompressible_image(ext), "{ext}");
            assert!(compress.image_action(ext).is_none(), "{ext}");
            assert!(convert.image_action(ext).is_none(), "{ext}");
            assert!(process(Some(50), Some(Target::Webp), Some(Target::Jpg)).image_action(ext).is_none(), "{ext}");
        }
        // TGA, QOI : comme BMP.
        for ext in ["tga", "qoi", "bmp"] {
            assert!(compress.uncompressible_image(ext), "{ext}");
            assert!(convert.image_action(ext).is_some(), "{ext}");
        }
        // JPEG XL (Q56 A) : compressé dans son format, converti par « Convertir en ».
        assert!(!compress.uncompressible_image("jxl"));
        assert!(matches!(compress.image_action("jxl"), Some(Action::Compress(50))));
        assert!(convert.image_action("jxl").is_some());
        // PSD (Q55 A) : un document, jamais traité.
        assert_eq!(crate::formats::kind_of_ext("psd"), Some(Kind::Document));
        assert!(compress.action(Kind::Document, "psd").is_none());
    }
}
