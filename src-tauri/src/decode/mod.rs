//! Formats d'image ajoutés au lot R7 (IMP-89, réponse Q14 B) : TGA, ICO, QOI, EXR, HDR (crate `image`), SVG
//! (`resvg`), JPEG XL (`jxl-oxide`), PSD aplati (`psd`) et RAW d'appareils photo (`rawler`, module `raw`). Aucun n'est
//! affiché tel quel par la fenêtre : la visionneuse reçoit une image convertie (`media::protocol`), les miniatures
//! et les conversions passent par `open`.

pub mod raw;
mod vector;

use std::path::Path;

use image::{DynamicImage, ImageFormat, ImageReader};

/// Extensions lues par le crate `image` grâce à ses options (TGA n'a pas de signature : lu d'après l'extension).
const IMAGE_CRATE: [&str; 5] = ["tga", "ico", "qoi", "exr", "hdr"];
/// Extensions de ce module hors RAW.
const OTHERS: [&str; 3] = ["svg", "jxl", "psd"];

fn ext(path: &Path) -> String {
    path.extension().map(|e| e.to_string_lossy().to_ascii_lowercase()).unwrap_or_default()
}

/// Toutes les extensions de ce module (liste de `formats.rs`).
pub fn extensions() -> impl Iterator<Item = &'static str> {
    IMAGE_CRATE.into_iter().chain(OTHERS).chain(raw::EXTENSIONS)
}

/// Format de ce module : jamais affiché tel quel par la fenêtre (converti à la volée).
pub fn handles(path: &Path) -> bool {
    let e = ext(path);
    extensions().any(|x| x == e)
}

/// L'image entière, rotation appliquée ; `None` : pas un format de ce module.
pub fn open(path: &Path) -> Option<anyhow::Result<DynamicImage>> {
    let e = ext(path);
    Some(match e.as_str() {
        "svg" => vector::svg(path),
        "jxl" => vector::jxl(path),
        "psd" => vector::psd(path),
        "exr" | "hdr" => by_image_crate(path, &e).map(to_display),
        _ if IMAGE_CRATE.contains(&e.as_str()) => by_image_crate(path, &e),
        _ if raw::is_raw(path) => raw::develop(path),
        _ => return None,
    })
}

/// Lecture par le crate `image` : d'après le contenu, sinon d'après l'extension (TGA).
fn by_image_crate(path: &Path, ext: &str) -> anyhow::Result<DynamicImage> {
    let bytes = std::fs::read(path)?;
    match crate::thumbs::decode(&bytes) {
        Ok(img) => Ok(img),
        Err(e) => {
            let Some(format) = ImageFormat::from_extension(ext) else { return Err(e) };
            let mut reader = ImageReader::new(std::io::Cursor::new(bytes));
            reader.set_format(format);
            Ok(reader.decode()?)
        }
    }
}

/// EXR, HDR : lumières « linéaires », parfois plus fortes que le blanc. Écrêtées à 1, puis courbe sRGB : sans elle,
/// l'image paraît très sombre.
fn to_display(img: DynamicImage) -> DynamicImage {
    let alpha = img.color().has_alpha();
    let mut px = img.into_rgba32f();
    for p in px.pixels_mut() {
        for c in &mut p.0[..3] {
            *c = srgb(c.clamp(0.0, 1.0));
        }
    }
    let img = DynamicImage::ImageRgba32F(px);
    if alpha { DynamicImage::ImageRgba8(img.into_rgba8()) } else { DynamicImage::ImageRgb8(img.into_rgb8()) }
}

/// Courbe sRGB (valeur linéaire 0..1 → valeur affichée 0..1).
pub(crate) fn srgb(v: f32) -> f32 {
    if v <= 0.003_130_8 { v * 12.92 } else { 1.055 * v.powf(1.0 / 2.4) - 0.055 }
}

#[cfg(test)]
mod tests {
    /// Décode chaque fichier d'essai du lot R7 (dossier donné par MYBOARD_FORMATS_R7, RAW dans son sous-dossier
    /// `raw`) : `cargo test --release --lib decode -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn fichiers_du_lot_r7() {
        let dir = std::path::PathBuf::from(std::env::var("MYBOARD_FORMATS_R7").expect("MYBOARD_FORMATS_R7"));
        let mut files: Vec<_> = std::fs::read_dir(&dir).unwrap().chain(std::fs::read_dir(dir.join("raw")).unwrap()).map(|e| e.unwrap().path()).collect();
        files.retain(|p| p.is_file());
        files.sort();
        let mut failed = 0;
        for path in files {
            let t = std::time::Instant::now();
            let full = crate::thumbs::open_image(&path);
            let t_full = t.elapsed().as_secs_f32();
            let name = path.file_name().unwrap().to_string_lossy().into_owned();
            match full {
                Ok(img) => {
                    let mut line = format!("{name} : {}x{} {:?} en {t_full:.2} s", img.width(), img.height(), img.color());
                    if super::raw::is_raw(&path) {
                        let t = std::time::Instant::now();
                        let p = super::raw::preview(&path).unwrap();
                        line += &format!(" ; aperçu {}x{} en {:.2} s", p.width(), p.height(), t.elapsed().as_secs_f32());
                    }
                    println!("{line}");
                }
                Err(e) => {
                    failed += 1;
                    println!("{name} : ÉCHEC {e:#}");
                }
            }
        }
        assert_eq!(failed, 0);
    }
}
