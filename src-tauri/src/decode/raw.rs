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

/// Un seul décodage complet à la fois : chacun occupe déjà les fils de calcul (`compute_pool`) et jusqu'à ~1 Go de
/// mémoire.
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
    let reference = camera_luminance(&src, decoder.as_ref());
    let mut img = match bayer_rgb(&raw, reference.as_deref()) {
        Some((img, _)) => DynamicImage::ImageRgb8(img),
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
/// zones virent au rose et « bavent » (Canon EOS 6D, comparé à l'application Photos le 16/11). Puis courbe de tons
/// (`Tone`), calée sur la luminance de l'aperçu de l'appareil `reference` quand il y en a un.
fn bayer_rgb(raw: &rawler::RawImage, reference: Option<&[f32]>) -> Option<(RgbImage, Tone)> {
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
    // Couleurs du capteur → sRGB linéaire (0..1).
    let to_rgb = |p: &[f32; 3]| {
        let c = [0, 1, 2].map(|i| (p[i] * wb[i]).min(1.0));
        [0, 1, 2].map(|i| (cam2rgb[i][0] * c[0] + cam2rgb[i][1] * c[1] + cam2rgb[i][2] * c[2]).clamp(0.0, 1.0))
    };
    let (w, h) = (px.width, px.height);
    let tone = reference.map_or(Tone::DEFAULT, |r| Tone::fit(&samples(&px.data, w, h, &to_rgb), r));
    let lut = tone.lut();
    let bytes: Vec<u8> = px
        .data
        .par_iter()
        .flat_map_iter(|p| to_rgb(p).map(|v| lut[(v * LUT_MAX as f32 + 0.5) as usize]))
        .collect();
    Some((RgbImage::from_raw(w as u32, h as u32, bytes)?, tone))
}

const LUT_MAX: usize = 65_535;

/// Courbe de tons (retouche 89.3 du 17/11) : sans elle, l'image était plus sombre et plus terne que celle de
/// l'application Photos, dont le décodeur reproduit le rendu de chaque appareil (Canon EOS 6D, Nikon D750 : même
/// luminance que leur aperçu intégré). Puissance `power` (contraste des ombres), gain `gain`, puis une épaule à partir de
/// `shoulder` : les hautes lumières sont adoucies au lieu d'être coupées, et le blanc reste blanc. Appliquée à chaque
/// couleur, comme le font les appareils : les couleurs gagnent aussi en vivacité.
#[derive(Clone, Copy, Debug)]
struct Tone {
    gain: f32,
    power: f32,
    shoulder: f32,
}

/// Points mesurés sur le grand côté de l'image pour chercher la courbe (chacun : moyenne de 3 × 3 pixels).
const FIT_SIDE: usize = 200;

impl Tone {
    /// Sans aperçu de l'appareil (certains Olympus) : médiane des courbes des 7 RAW d'essai qui en ont un (17/11).
    const DEFAULT: Tone = Tone { gain: 4.25, power: 1.36, shoulder: 0.22 };

    fn raw_curve(self, y: f32) -> f32 {
        let s = self.shoulder;
        if y <= s { y } else { s + (1.0 - s) * (1.0 - (-(y - s) / (1.0 - s)).exp()) }
    }

    fn apply(self, x: f32) -> f32 {
        self.raw_curve(self.gain * x.max(0.0).powf(self.power)) / self.raw_curve(self.gain)
    }

    /// Valeur linéaire (0..1, en `max` + 1 pas) → valeur affichée (0..1) : courbe de tons, puis courbe sRGB.
    fn table(self, max: usize) -> impl Iterator<Item = f32> {
        (0..=max).map(move |i| super::srgb(self.apply(i as f32 / max as f32).clamp(0.0, 1.0)))
    }

    /// Table finale, sur 8 bits.
    fn lut(self) -> Vec<u8> {
        self.table(LUT_MAX).map(|v| (v * 255.0 + 0.5) as u8).collect()
    }

    /// La courbe dont le résultat (courbe appliquée à chaque couleur, comme dans `bayer_rgb`) a la luminance la plus
    /// proche de celle de l'aperçu, quantile par quantile : gain de 1 à 20, puissance de 0,8 à 2,2, épaule de 0,1 à
    /// 0,9 ; d'abord à gros pas, puis plus finement autour du meilleur.
    fn fit(samples: &[[f32; 3]], reference: &[f32]) -> Tone {
        let error = |tone: Tone| {
            let table: Vec<f32> = tone.table(4_095).collect();
            let shown = |v: f32| table[(v * 4_095.0 + 0.5) as usize];
            quantiles(samples.iter().map(|p| luminance(p.map(shown)))).map_or(f32::MAX, |q| q.iter().zip(reference).map(|(a, b)| (a - b).abs()).sum())
        };
        let best = |gains: Vec<f32>, powers: Vec<f32>, shoulders: Vec<f32>| {
            let mut tones = Vec::new();
            for &gain in &gains {
                for &power in &powers {
                    tones.extend(shoulders.iter().map(|&shoulder| Tone { gain, power, shoulder }));
                }
            }
            tones.into_par_iter().map(|t| (error(t), t)).min_by(|a, b| a.0.total_cmp(&b.0)).map_or(Tone::DEFAULT, |(_, t)| t)
        };
        let around = |v: f32, step: f32, low: f32, high: f32| (-3..=3).map(|i| (v + i as f32 * step).clamp(low, high)).collect();
        let rough = best(
            (0..16).map(|i| 1.0 + i as f32 * 1.25).collect(),
            (0..8).map(|i| 0.8 + i as f32 * 0.2).collect(),
            (0..5).map(|i| 0.1 + i as f32 * 0.2).collect(),
        );
        best(around(rough.gain, 0.25, 1.0, 20.0), around(rough.power, 0.04, 0.8, 2.2), around(rough.shoulder, 0.04, 0.05, 0.95))
    }
}

/// Luminance d'une couleur affichée (sRGB 0..1).
fn luminance(rgb: [f32; 3]) -> f32 {
    0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

/// Valeurs (0..1) aux quantiles 2 à 98 %, lues sur un histogramme de 4 096 cases (bien plus rapide qu'un tri : la
/// recherche de la courbe en lit un millier) ; `None` : trop peu de valeurs.
fn quantiles(values: impl Iterator<Item = f32>) -> Option<Vec<f32>> {
    const BINS: usize = 4_096;
    let mut histogram = vec![0usize; BINS];
    let mut count = 0;
    for v in values {
        histogram[(v.clamp(0.0, 1.0) * (BINS - 1) as f32 + 0.5) as usize] += 1;
        count += 1;
    }
    if count < 1_000 {
        return None;
    }
    let (mut below, mut bin) = (0, 0);
    let mut out = Vec::with_capacity(97);
    for k in 2..=98 {
        let rank = (count - 1) * k / 100;
        while below + histogram[bin] <= rank {
            below += histogram[bin];
            bin += 1;
        }
        out.push(bin as f32 / (BINS - 1) as f32);
    }
    Some(out)
}

/// Points de mesure : grille de `FIT_SIDE` points sur le grand côté d'une image `w` × `h`, coin haut gauche du carré de
/// 3 × 3 pixels de chacun.
fn grid(w: usize, h: usize) -> impl Iterator<Item = (usize, usize)> {
    let step = (w.max(h) / FIT_SIDE).max(1);
    let (xs, ys) = (w.saturating_sub(2), h.saturating_sub(2));
    (step / 2..ys).step_by(step).flat_map(move |y| (step / 2..xs).step_by(step).map(move |x| (x, y)))
}

/// Luminance de l'aperçu de l'appareil aux points de mesure, en quantiles ; `None` sans aperçu d'au moins 320 px.
fn camera_luminance(src: &RawSource, decoder: &dyn Decoder) -> Option<Vec<f32>> {
    let params = RawDecodeParams::default();
    let big_enough = |img: &DynamicImage| img.width().max(img.height()) >= 320;
    let preview = decoder
        .preview_image(src, &params)
        .ok()
        .flatten()
        .filter(big_enough)
        .or_else(|| decoder.full_image(src, &params).ok().flatten().filter(big_enough))?
        .into_rgb8();
    let (w, h) = (preview.width() as usize, preview.height() as usize);
    let raw = preview.as_raw();
    quantiles(grid(w, h).map(|(x, y)| {
        let mut sum = [0.0f32; 3];
        for row in y..y + 3 {
            for p in raw[(row * w + x) * 3..(row * w + x + 3) * 3].as_chunks::<3>().0 {
                sum.iter_mut().zip(p).for_each(|(s, v)| *s += f32::from(*v));
            }
        }
        luminance(sum.map(|s| s / (9.0 * 255.0)))
    }))
}

/// Le décodage sans courbe aux points de mesure, en sRGB linéaire.
fn samples(data: &[[f32; 3]], w: usize, h: usize, to_rgb: &impl Fn(&[f32; 3]) -> [f32; 3]) -> Vec<[f32; 3]> {
    grid(w, h)
        .map(|(x, y)| {
            let mut sum = [0.0f32; 3];
            for row in y..y + 3 {
                for p in &data[row * w + x..row * w + x + 3] {
                    sum.iter_mut().zip(p).for_each(|(s, v)| *s += v);
                }
            }
            to_rgb(&sum.map(|s| s / 9.0))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    /// Courbe choisie pour chaque RAW d'essai (dossier MYBOARD_FORMATS_R7, sous-dossier `raw`), et durée de la
    /// recherche : `cargo test --release --lib courbe -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn courbe_des_raw_d_essai() {
        let dir = std::path::PathBuf::from(std::env::var("MYBOARD_FORMATS_R7").expect("MYBOARD_FORMATS_R7")).join("raw");
        let mut files: Vec<_> = std::fs::read_dir(dir).unwrap().map(|e| e.unwrap().path()).filter(|p| super::is_raw(p)).collect();
        files.sort();
        for path in files {
            let (src, decoder, _) = super::open(&path).unwrap();
            let raw = decoder.raw_image(&src, &super::RawDecodeParams::default(), false).unwrap();
            let t = std::time::Instant::now();
            let reference = super::camera_luminance(&src, decoder.as_ref());
            let t_ref = t.elapsed().as_secs_f32();
            let t = std::time::Instant::now();
            let tone = super::bayer_rgb(&raw, reference.as_deref()).map(|(_, tone)| tone);
            println!("{} : {tone:?} ; aperçu lu en {t_ref:.2} s, développé en {:.2} s", path.file_name().unwrap().to_string_lossy(), t.elapsed().as_secs_f32());
        }
    }
}
