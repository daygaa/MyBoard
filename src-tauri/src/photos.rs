//! Photos HEIF / HEIC et RAW DNG (IMP-80, IMP-82 ; réponses Q2 A et Q5 A du 13/11), lues en entier, bien tournées.
//! - HEIF / HEIC : par ffmpeg 8.1 ou plus (IMP-83), qui assemble seul la grille de carreaux des photos d'iPhone, environ
//!   deux fois plus vite que Windows (mesure du 13/11 : 0,27 à 0,39 s contre 0,49 à 1 s) ; sinon (ffmpeg absent, trop
//!   ancien ou en échec) par le décodeur HEIF de Windows (extensions « HEIF » et « HEVC »). Les deux appliquent la
//!   rotation de la photo.
//! - DNG : par le décodeur DNG de Windows seulement (intégré à Windows 10 et 11 ; ffmpeg ne lit pas les DNG de l'iPhone :
//!   « format non pris en charge »). Il rend l'image du capteur sans la tourner : la rotation de l'étiquette TIFF 274 est
//!   appliquée ici (photos d'essai en portrait, orientation 6).
//!
//! Interrupteur d'essai MYBOARD_PHOTOS : `ffmpeg` = décodeur de Windows ignoré, `windows` = ffmpeg ignoré (essayer chaque
//! chemin sans toucher au PC, demande du 13/11).

use std::io::Read;
use std::path::Path;

use anyhow::bail;
use image::DynamicImage;
use image::metadata::Orientation;

use crate::ffmpeg::Ffmpeg;

/// Extensions lues ici.
pub const EXTENSIONS: [&str; 3] = ["heic", "heif", "dng"];

fn ext(path: &Path) -> String {
    path.extension().map(|e| e.to_string_lossy().to_ascii_lowercase()).unwrap_or_default()
}

pub fn is_photo(path: &Path) -> bool {
    EXTENSIONS.contains(&ext(path).as_str())
}

fn switch() -> String {
    std::env::var("MYBOARD_PHOTOS").unwrap_or_default().trim().to_ascii_lowercase()
}

/// L'image entière en JPEG par ffmpeg ; `None` : chemin ffmpeg pas possible pour ce fichier.
fn by_ffmpeg(ff: Option<&Ffmpeg>, path: &Path) -> Option<anyhow::Result<Vec<u8>>> {
    let ff = ff.filter(|f| f.recent)?;
    if ext(path) == "dng" || switch() == "windows" {
        return None;
    }
    Some(crate::thumbs::photo_jpeg(ff, path))
}

/// La photo entière, rotation appliquée.
pub fn open(ff: Option<&Ffmpeg>, path: &Path) -> anyhow::Result<DynamicImage> {
    let first = match by_ffmpeg(ff, path) {
        Some(Ok(jpeg)) => match crate::thumbs::decode(&jpeg) {
            Ok(img) => return Ok(img),
            Err(e) => Some(e),
        },
        Some(Err(e)) => Some(e),
        None => None,
    };
    by_windows(path).map_err(|e| match first {
        Some(f) => e.context(format!("ffmpeg : {f:#}")),
        None => e,
    })
}

/// La photo entière en JPEG (visionneuse, copie : D-016) : celui de ffmpeg tel quel, sinon l'image de Windows encodée.
pub fn full_jpeg(ff: Option<&Ffmpeg>, path: &Path) -> anyhow::Result<Vec<u8>> {
    if let Some(Ok(jpeg)) = by_ffmpeg(ff, path) {
        return Ok(jpeg);
    }
    let img = by_windows(path)?.into_rgb8();
    let mut out = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 92).encode_image(&img)?;
    Ok(out)
}

fn by_windows(path: &Path) -> anyhow::Result<DynamicImage> {
    if switch() == "ffmpeg" {
        bail!("décodeur de Windows désactivé (MYBOARD_PHOTOS=ffmpeg)");
    }
    let mut img = wic::decode(path)?;
    if ext(path) == "dng"
        && let Some(o) = tiff_orientation(path).and_then(Orientation::from_exif)
    {
        img.apply_orientation(o);
    }
    Ok(img)
}

/// Étiquette TIFF 274 (orientation) du premier répertoire d'un DNG.
fn tiff_orientation(path: &Path) -> Option<u8> {
    let mut head = Vec::new();
    std::fs::File::open(path).ok()?.take(256 * 1024).read_to_end(&mut head).ok()?;
    let big = match head.get(..2)? {
        b"MM" => true,
        b"II" => false,
        _ => return None,
    };
    let u16_at = |p: usize| head.get(p..p + 2).map(|b| if big { u16::from_be_bytes([b[0], b[1]]) } else { u16::from_le_bytes([b[0], b[1]]) });
    let u32_at = |p: usize| head.get(p..p + 4).map(|b| if big { u32::from_be_bytes([b[0], b[1], b[2], b[3]]) } else { u32::from_le_bytes([b[0], b[1], b[2], b[3]]) });
    let ifd = u32_at(4)? as usize;
    let count = u16_at(ifd)? as usize;
    (0..count).find_map(|i| {
        let entry = ifd + 2 + 12 * i;
        (u16_at(entry)? == 274).then(|| u16_at(entry + 8)).flatten().and_then(|v| u8::try_from(v).ok())
    })
}

#[cfg(windows)]
mod wic {
    use std::path::Path;

    use anyhow::Context;
    use image::{DynamicImage, RgbImage};
    use windows::Win32::Foundation::GENERIC_READ;
    use windows::Win32::Graphics::Imaging::{
        CLSID_WICImagingFactory, GUID_WICPixelFormat24bppRGB, IWICImagingFactory, IWICPalette, WICBitmapDitherTypeNone,
        WICBitmapPaletteTypeCustom, WICDecodeMetadataCacheOnDemand,
    };
    use windows::Win32::System::Com::{CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx};
    use windows::core::HSTRING;

    /// Décodage par WIC (Windows Imaging Component) : le décodeur installé pour ce format, image entière en RGB.
    pub fn decode(path: &Path) -> anyhow::Result<DynamicImage> {
        // SAFETY : appels COM ordinaires ; le tampon a la taille annoncée (largeur × 3 × hauteur).
        unsafe {
            // Déjà initialisé sur ce fil (autre mode) : sans conséquence, WIC fonctionne dans les deux.
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            let factory: IWICImagingFactory = CoCreateInstance(&CLSID_WICImagingFactory, None, CLSCTX_INPROC_SERVER)?;
            let decoder = factory
                .CreateDecoderFromFilename(&HSTRING::from(path), None, GENERIC_READ, WICDecodeMetadataCacheOnDemand)
                .context("aucun décodeur de Windows pour ce fichier")?;
            let frame = decoder.GetFrame(0)?;
            let converter = factory.CreateFormatConverter()?;
            converter.Initialize(&frame, &GUID_WICPixelFormat24bppRGB, WICBitmapDitherTypeNone, None::<&IWICPalette>, 0.0, WICBitmapPaletteTypeCustom)?;
            let (mut width, mut height) = (0u32, 0u32);
            converter.GetSize(&mut width, &mut height)?;
            let stride = width.checked_mul(3).context("image trop grande")?;
            let mut pixels = vec![0u8; stride as usize * height as usize];
            converter.CopyPixels(std::ptr::null(), stride, &mut pixels)?;
            Ok(DynamicImage::ImageRgb8(RgbImage::from_raw(width, height, pixels).context("image de Windows incomplète")?))
        }
    }
}

#[cfg(not(windows))]
mod wic {
    pub fn decode(_: &std::path::Path) -> anyhow::Result<image::DynamicImage> {
        anyhow::bail!("décodeur de Windows absent")
    }
}
