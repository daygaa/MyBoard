//! Options de l'import (carte « Options d'import », IMP-30) et ce qu'elles font d'une image : rien, la compresser
//! dans son format (IMP-20, IMP-62) ou la convertir (IMP-21). Réponses de l'utilisateur du 10/11 : SPEC IMP-21.

use serde::Deserialize;

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
}

/// Qualité d'une conversion sans compression (réponse Q5 du 10/11).
const CONVERT_QUALITY: u8 = 90;

/// Traitement demandé pour l'import.
#[derive(Clone, Copy)]
pub struct Process {
    /// Qualité si « Compresser les images » est cochée (20 à 95).
    pub quality: Option<u8>,
    pub convert: Option<Target>,
    /// Réponse « Compresser aussi » / « Convertir aussi » de la pop-in : images déjà dans la bibliothèque (IMP-60).
    pub existing: bool,
}

impl Process {
    /// Ce qu'il faut faire d'une image de cette extension ; `None` : rien.
    pub fn action(&self, ext: &str) -> Option<Action> {
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
}

impl ImportOptions {
    pub fn process(&self) -> Option<Process> {
        let quality = self.compress_quality.map(|q| q.clamp(20, 95));
        (quality.is_some() || self.convert_to.is_some()).then_some(Process {
            quality,
            convert: self.convert_to,
            existing: self.process_existing,
        })
    }
}
