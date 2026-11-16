//! SVG (dessin), JPEG XL et PSD (IMP-89).

use std::path::Path;
use std::sync::{Arc, OnceLock};

use anyhow::Context;
use image::{DynamicImage, RgbaImage};
use resvg::{tiny_skia, usvg};

/// Côté le plus long d'un SVG dessiné : au moins 2 048 px (une icône de 24 px reste nette dans la visionneuse), au
/// plus 8 192 px.
const SVG_MIN_SIDE: f32 = 2048.0;
const SVG_MAX_SIDE: f32 = 8192.0;

/// Polices de Windows, chargées une fois (textes des SVG).
fn fonts() -> Arc<usvg::fontdb::Database> {
    static FONTS: OnceLock<Arc<usvg::fontdb::Database>> = OnceLock::new();
    FONTS
        .get_or_init(|| {
            let mut db = usvg::fontdb::Database::new();
            db.load_system_fonts();
            Arc::new(db)
        })
        .clone()
}

/// SVG dessiné en pixels, transparence gardée. Aucun dossier de ressources : le dessin ne lit aucun autre fichier.
pub fn svg(path: &Path) -> anyhow::Result<DynamicImage> {
    let data = std::fs::read(path)?;
    let options = usvg::Options { fontdb: fonts(), ..Default::default() };
    let tree = usvg::Tree::from_data(&data, &options).context("SVG illisible")?;
    let size = tree.size();
    let long = size.width().max(size.height()).max(1.0);
    let scale = long.clamp(SVG_MIN_SIDE, SVG_MAX_SIDE) / long;
    let (w, h) = (((size.width() * scale).round() as u32).max(1), ((size.height() * scale).round() as u32).max(1));
    let mut pixmap = tiny_skia::Pixmap::new(w, h).context("SVG trop grand")?;
    resvg::render(&tree, tiny_skia::Transform::from_scale(scale, scale), &mut pixmap.as_mut());
    // tiny-skia garde les couleurs « prémultipliées » par la transparence : on les remet telles quelles.
    let mut out = RgbaImage::new(w, h);
    for (src, dst) in pixmap.pixels().iter().zip(out.pixels_mut()) {
        let c = src.demultiply();
        *dst = image::Rgba([c.red(), c.green(), c.blue(), c.alpha()]);
    }
    Ok(DynamicImage::ImageRgba8(out))
}

/// JPEG XL entier.
pub fn jxl(path: &Path) -> anyhow::Result<DynamicImage> {
    let file = std::io::BufReader::new(std::fs::File::open(path)?);
    let decoder = jxl_oxide::integration::JxlDecoder::new(file).context("JPEG XL illisible")?;
    Ok(DynamicImage::from_decoder(decoder)?)
}

/// PSD : l'image aplatie enregistrée par Photoshop (calques ignorés).
pub fn psd(path: &Path) -> anyhow::Result<DynamicImage> {
    let psd = psd::Psd::from_bytes(&std::fs::read(path)?).map_err(|e| anyhow::anyhow!("PSD illisible : {e}"))?;
    let img = RgbaImage::from_raw(psd.width(), psd.height(), psd.rgba()).context("PSD : taille incohérente")?;
    Ok(DynamicImage::ImageRgba8(img))
}
