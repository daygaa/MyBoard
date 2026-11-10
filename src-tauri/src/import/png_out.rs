//! PNG écrits par MyBoard : compression d'un PNG (IMP-62) et conversion vers PNG (IMP-21). Règles choisies par
//! l'utilisateur le 10/11, « Compresser les images » cochée : optimisation sans perte toujours (même à 95) ; 16 → 8 bits
//! par couleur à 75 ou moins ; 256 couleurs à 50 ou moins. Profil de couleurs et EXIF gardés.

use std::borrow::Cow;
use std::time::Duration;

use image::codecs::png::PngEncoder;
use image::{DynamicImage, ImageEncoder};

/// Informations de la photo recopiées dans le PNG.
#[derive(Default)]
pub struct Meta {
    pub icc: Option<Vec<u8>>,
    /// EXIF brut (en-tête TIFF, sans « Exif\0\0 »).
    pub exif: Option<Vec<u8>>,
}

/// PNG de `img` ; `quality` : compression cochée (règles d'IMP-62), sinon un PNG ordinaire.
pub fn encode(img: DynamicImage, meta: &Meta, quality: Option<u8>) -> anyhow::Result<Vec<u8>> {
    let img = if quality.is_some_and(|q| q <= 75) { to_8_bits(img) } else { img };
    let raw = if quality.is_some_and(|q| q <= 50) { palette(&img, meta)? } else { plain(&img, meta)? };
    match quality {
        Some(_) => optimize(&raw),
        None => Ok(raw),
    }
}

/// 16 bits (ou plus) par couleur → 8 : invisible sur un écran ordinaire, deux fois plus léger.
fn to_8_bits(img: DynamicImage) -> DynamicImage {
    match img {
        DynamicImage::ImageLuma16(_) => DynamicImage::ImageLuma8(img.to_luma8()),
        DynamicImage::ImageLumaA16(_) => DynamicImage::ImageLumaA8(img.to_luma_alpha8()),
        DynamicImage::ImageRgb16(_) | DynamicImage::ImageRgb32F(_) => DynamicImage::ImageRgb8(img.to_rgb8()),
        DynamicImage::ImageRgba16(_) | DynamicImage::ImageRgba32F(_) => DynamicImage::ImageRgba8(img.to_rgba8()),
        other => other,
    }
}

fn plain(img: &DynamicImage, meta: &Meta) -> anyhow::Result<Vec<u8>> {
    let mut out = Vec::new();
    let mut encoder = PngEncoder::new(&mut out);
    if let Some(icc) = &meta.icc {
        let _ = encoder.set_icc_profile(icc.clone());
    }
    if let Some(exif) = &meta.exif {
        let _ = encoder.set_exif_metadata(exif.clone());
    }
    encoder.write_image(img.as_bytes(), img.width(), img.height(), img.color().into())?;
    Ok(out)
}

/// 256 couleurs choisies pour l'image (NeuQuant), transparence comprise.
fn palette(img: &DynamicImage, meta: &Meta) -> anyhow::Result<Vec<u8>> {
    let rgba = img.to_rgba8();
    let quant = color_quant::NeuQuant::new(10, 256, rgba.as_raw());
    let map = quant.color_map_rgba();
    let indices: Vec<u8> = rgba.pixels().map(|p| quant.index_of(&p.0) as u8).collect();
    let rgb: Vec<u8> = map.as_chunks::<4>().0.iter().flat_map(|c| [c[0], c[1], c[2]]).collect();
    let alpha: Vec<u8> = map.as_chunks::<4>().0.iter().map(|c| c[3]).collect();

    let mut info = png::Info::with_size(img.width(), img.height());
    info.color_type = png::ColorType::Indexed;
    info.bit_depth = png::BitDepth::Eight;
    info.palette = Some(Cow::Owned(rgb));
    if alpha.iter().any(|&a| a < 255) {
        info.trns = Some(Cow::Owned(alpha));
    }
    info.icc_profile = meta.icc.clone().map(Cow::Owned);
    info.exif_metadata = meta.exif.clone().map(Cow::Owned);
    let mut out = Vec::new();
    {
        let mut writer = png::Encoder::with_info(&mut out, info)?.write_header()?;
        writer.write_image_data(&indices)?;
    }
    Ok(out)
}

/// Optimisation sans perte (oxipng) ; 15 s au plus pour une très grande image.
fn optimize(raw: &[u8]) -> anyhow::Result<Vec<u8>> {
    let options = oxipng::Options { timeout: Some(Duration::from_secs(15)), ..oxipng::Options::from_preset(2) };
    Ok(oxipng::optimize_from_memory(raw, &options)?)
}
