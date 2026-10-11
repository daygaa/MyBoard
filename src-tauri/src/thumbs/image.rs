//! Miniatures d'images : décodage, recadrage carré, réduction, encodage WebP (LIB-06, LIB-09, LIB-12).

use std::io::Cursor;
use std::path::Path;

use fast_image_resize::{self as fir, IntoImageView};
use image::{DynamicImage, ImageDecoder, ImageReader, metadata::Orientation};

/// Côté des miniatures (D-011, D-015).
pub const THUMB_SIZE: u32 = 320;
pub const SMALL_SIZE: u32 = 128;
pub const PREVIEW_SIZE: u32 = 640;
/// Qualité WebP : bon compromis netteté / poids (~10–20 Ko par miniature 320 px).
const WEBP_QUALITY: f32 = 78.0;

/// Miniatures 320 et 128 px encodées + dimensions réelles du média (rotation appliquée).
pub struct Thumb {
    pub webp: Vec<u8>,
    pub small: Vec<u8>,
    pub width: u32,
    pub height: u32,
}

/// Décode un fichier image lisible par Rust (JPEG, PNG, GIF, WebP, BMP, TIFF).
pub fn open_image(path: &Path) -> anyhow::Result<DynamicImage> {
    decode(&std::fs::read(path)?)
}

/// Les deux miniatures d'une image (un seul décodage de l'original).
pub fn thumbs_of(img: DynamicImage) -> anyhow::Result<Thumb> {
    let (width, height) = (img.width(), img.height());
    let normal = square(img, THUMB_SIZE)?;
    let small = square(normal.clone(), SMALL_SIZE)?;
    Ok(Thumb { webp: encode(&normal), small: encode(&small), width, height })
}

/// Miniature 128 px seule (rattrapage à partir d'une miniature 320 px, LIB-12).
pub fn small_of(img: DynamicImage) -> anyhow::Result<Vec<u8>> {
    Ok(encode(&square(img, SMALL_SIZE)?))
}

/// Grand aperçu 640 px (LIB-09).
pub fn preview_of(img: DynamicImage) -> anyhow::Result<Vec<u8>> {
    Ok(encode(&square(img, PREVIEW_SIZE)?))
}

/// Décode en se fiant au contenu (pas à l'extension) et applique la rotation EXIF :
/// une photo de téléphone prise en portrait doit apparaître en portrait.
pub fn decode(bytes: &[u8]) -> anyhow::Result<DynamicImage> {
    let mut decoder = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()?
        .into_decoder()?;
    let orientation = decoder.orientation().unwrap_or(Orientation::NoTransforms);
    let mut img = DynamicImage::from_decoder(decoder)?;
    img.apply_orientation(orientation);
    Ok(img)
}

/// Recadre au centre en carré (la vignette de la grille est carrée) et réduit à `max_side`
/// au plus (jamais agrandi). Le résultat est en RGB, ou RGBA si l'image a de la transparence.
fn square(img: DynamicImage, max_side: u32) -> anyhow::Result<DynamicImage> {
    let img = if img.color().has_alpha() {
        DynamicImage::ImageRgba8(img.into_rgba8())
    } else {
        DynamicImage::ImageRgb8(img.into_rgb8())
    };
    let side = img.width().min(img.height()).clamp(1, max_side);
    let pixel_type = img.pixel_type().ok_or_else(|| anyhow::anyhow!("format de pixel inconnu"))?;
    let mut dst = fir::images::Image::new(side, side, pixel_type);
    let options = fir::ResizeOptions::new()
        .resize_alg(fir::ResizeAlg::Convolution(fir::FilterType::CatmullRom))
        .fit_into_destination(None); // recadrage centré au format de la destination
    fir::Resizer::new().resize(&img, &mut dst, &options)?;
    let buffer = dst.into_vec();
    Ok(if img.color().has_alpha() {
        DynamicImage::ImageRgba8(image::RgbaImage::from_raw(side, side, buffer).ok_or_else(|| anyhow::anyhow!("taille"))?)
    } else {
        DynamicImage::ImageRgb8(image::RgbImage::from_raw(side, side, buffer).ok_or_else(|| anyhow::anyhow!("taille"))?)
    })
}

fn encode(img: &DynamicImage) -> Vec<u8> {
    let (w, h) = (img.width(), img.height());
    let encoder = match img {
        DynamicImage::ImageRgba8(rgba) => webp::Encoder::from_rgba(rgba.as_raw(), w, h),
        other => webp::Encoder::from_rgb(other.as_bytes(), w, h),
    };
    encoder.encode(WEBP_QUALITY).to_vec()
}
