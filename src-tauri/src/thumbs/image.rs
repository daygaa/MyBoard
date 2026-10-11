//! Miniatures d'images : décodage, recadrage carré, réduction, encodage WebP (LIB-06).

use std::io::Cursor;
use std::path::Path;

use fast_image_resize::{self as fir, IntoImageView};
use image::{DynamicImage, ImageDecoder, ImageReader, metadata::Orientation};

/// Côté des petites miniatures (D-011).
pub const THUMB_SIZE: u32 = 320;
/// Qualité WebP : bon compromis netteté / poids (~10–20 Ko par miniature).
const WEBP_QUALITY: f32 = 78.0;

/// Miniature encodée + dimensions réelles du média (rotation appliquée).
pub struct Thumb {
    pub webp: Vec<u8>,
    pub width: u32,
    pub height: u32,
}

/// Miniature d'un fichier image décodable par Rust (JPEG, PNG, GIF, WebP, BMP, TIFF).
pub fn from_image_file(path: &Path) -> anyhow::Result<Thumb> {
    let bytes = std::fs::read(path)?;
    let img = decode(&bytes)?;
    let (width, height) = (img.width(), img.height());
    Ok(Thumb { webp: encode_square(img)?, width, height })
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

/// Recadre au centre en carré (la vignette de la grille est carrée), réduit à
/// 320 px au plus (jamais agrandi), puis encode en WebP.
pub fn encode_square(img: DynamicImage) -> anyhow::Result<Vec<u8>> {
    let has_alpha = img.color().has_alpha();
    let img = if has_alpha {
        DynamicImage::ImageRgba8(img.into_rgba8())
    } else {
        DynamicImage::ImageRgb8(img.into_rgb8())
    };
    let side = img.width().min(img.height()).clamp(1, THUMB_SIZE);
    let pixel_type = img.pixel_type().ok_or_else(|| anyhow::anyhow!("format de pixel inconnu"))?;
    let mut dst = fir::images::Image::new(side, side, pixel_type);
    let options = fir::ResizeOptions::new()
        .resize_alg(fir::ResizeAlg::Convolution(fir::FilterType::CatmullRom))
        .fit_into_destination(None); // recadrage centré au format de la destination
    fir::Resizer::new().resize(&img, &mut dst, &options)?;

    let encoder = if has_alpha {
        webp::Encoder::from_rgba(dst.buffer(), side, side)
    } else {
        webp::Encoder::from_rgb(dst.buffer(), side, side)
    };
    Ok(encoder.encode(WEBP_QUALITY).to_vec())
}
