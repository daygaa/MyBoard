//! RAW d'appareils photo par `rawler` (IMP-89, réponses Q14 B, Q51 A ; VIEW-63, Q54 A). Les DNG restent lus par le
//! décodeur de Windows (`photos.rs`). Deux lectures :
//! - l'aperçu JPEG rangé dans le fichier par l'appareil (rapide : affiché à l'ouverture dans la visionneuse) ;
//! - le décodage complet des données du capteur (environ 1 s) : l'image « réelle », sans les réglages de l'appareil
//!   ni la correction de ses objectifs (voulu : réponse du 16/11), pour la visionneuse et les miniatures.

use std::path::Path;
use std::sync::Mutex;

use anyhow::{Context, anyhow};
use image::metadata::Orientation;
use image::{DynamicImage, RgbImage};
use rawler::decoders::{Decoder, RawDecodeParams};
use rawler::imgop::develop::{Intermediate, ProcessingStep, RawDevelop};
use rawler::imgop::matrix::{multiply, normalize, pseudo_inverse};
use rawler::imgop::xyz::{Illuminant, SRGB_TO_XYZ_D65};
use rawler::rawsource::RawSource;
use rayon::prelude::*;

/// Extensions lues par `rawler` (sa liste, sans DNG (Windows), ni « .raw » (nom trop courant pour d'autres
/// fichiers), ni les formats de caméras de cinéma ARI, CRM).
pub const EXTENSIONS: [&str; 23] = [
    "arw", "cr2", "cr3", "crw", "dcr", "dcs", "erf", "iiq", "kdc", "mef", "mos", "mrw", "nef", "nrw", "orf", "ori",
    "pef", "raf", "rw2", "rwl", "srw", "3fr", "fff",
];

/// Un seul décodage complet à la fois : chacun occupe déjà tous les cœurs et jusqu'à ~1 Go de mémoire.
static DEVELOP: Mutex<()> = Mutex::new(());

pub fn is_raw(path: &Path) -> bool {
    let e = path.extension().map(|e| e.to_string_lossy().to_ascii_lowercase()).unwrap_or_default();
    EXTENSIONS.contains(&e.as_str())
}

fn open(path: &Path) -> anyhow::Result<(RawSource, Box<dyn Decoder>, Orientation)> {
    let src = RawSource::new(path)?;
    let decoder = rawler::get_decoder(&src).map_err(|e| anyhow!("RAW illisible : {e}"))?;
    let orientation = decoder
        .raw_metadata(&src, &RawDecodeParams::default())
        .ok()
        .and_then(|m| m.exif.orientation)
        .and_then(|o| u8::try_from(o).ok())
        .and_then(Orientation::from_exif)
        .unwrap_or(Orientation::NoTransforms);
    Ok((src, decoder, orientation))
}

/// L'aperçu de l'appareil, tourné ; sans aperçu (certains Olympus) : le décodage complet.
pub fn preview(path: &Path) -> anyhow::Result<DynamicImage> {
    let (src, decoder, orientation) = open(path)?;
    let params = RawDecodeParams::default();
    let found = match decoder.full_image(&src, &params) {
        Ok(Some(img)) => Some(img),
        _ => decoder.preview_image(&src, &params).ok().flatten(),
    };
    match found {
        Some(mut img) => {
            img.apply_orientation(orientation);
            Ok(img)
        }
        None => develop(path),
    }
}

/// Décodage complet des données du capteur, tourné.
pub fn develop(path: &Path) -> anyhow::Result<DynamicImage> {
    let _one = DEVELOP.lock().unwrap_or_else(|e| e.into_inner());
    let (src, decoder, orientation) = open(path)?;
    let raw = decoder.raw_image(&src, &RawDecodeParams::default(), false).map_err(|e| anyhow!("RAW illisible : {e}"))?;
    let mut img = match bayer_rgb(&raw) {
        Some(img) => DynamicImage::ImageRgb8(img),
        // Capteurs à 4 couleurs, noir et blanc… : le développement de `rawler` tel quel.
        None => RawDevelop::default()
            .develop_intermediate(&raw)
            .map_err(|e| anyhow!("RAW illisible : {e}"))?
            .to_dynamic_image()
            .context("RAW : conversion impossible")?,
    };
    img.apply_orientation(orientation);
    Ok(img)
}

/// Développement des capteurs à 3 couleurs, comme celui de `rawler` sauf pour les zones saturées : la balance des
/// blancs est ramenée à un minimum de 1 et chaque couleur écrêtée à 1 AVANT la matrice de couleurs. Sans cela, ces
/// zones virent au rose et « bavent » (Canon EOS 6D, comparé à l'application Photos le 16/11).
fn bayer_rgb(raw: &rawler::RawImage) -> Option<RgbImage> {
    use ProcessingStep as S;
    let steps = [S::Rescale, S::Demosaic, S::FujiRotate, S::CropActiveArea, S::CropDefault];
    let Intermediate::ThreeColor(px) = RawDevelop::new_with(&steps).develop_intermediate(raw).ok()? else { return None };
    let (illuminant, m) = raw.color_matrix_find_first([Illuminant::D65])?;
    if illuminant != Illuminant::D65 || m.len() != 9 {
        return None;
    }
    let mut xyz2cam = [[0.0f32; 3]; 4];
    for (i, row) in xyz2cam.iter_mut().take(3).enumerate() {
        row.copy_from_slice(&m[i * 3..i * 3 + 3]);
    }
    let cam2rgb = pseudo_inverse(normalize(multiply(&xyz2cam, &SRGB_TO_XYZ_D65)));
    let wb = if raw.wb_coeffs[..3].iter().any(|c| !c.is_finite() || *c <= 0.0) {
        [1.0; 3]
    } else {
        [raw.wb_coeffs[0], raw.wb_coeffs[1], raw.wb_coeffs[2]]
    };
    let min = wb.iter().copied().fold(f32::MAX, f32::min);
    let wb = wb.map(|c| c / min);
    let bytes: Vec<u8> = px
        .data
        .par_iter()
        .flat_map_iter(|p| {
            let c = [0, 1, 2].map(|i| (p[i] * wb[i]).min(1.0));
            [0, 1, 2].map(|i| {
                let v = (cam2rgb[i][0] * c[0] + cam2rgb[i][1] * c[1] + cam2rgb[i][2] * c[2]).clamp(0.0, 1.0);
                (super::srgb(v) * 255.0 + 0.5) as u8
            })
        })
        .collect();
    RgbImage::from_raw(px.width as u32, px.height as u32, bytes)
}
