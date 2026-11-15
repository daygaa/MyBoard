//! Photos HEIF / HEIC et RAW DNG (IMP-80, IMP-82 ; réponses Q2 A et Q5 A du 13/11), lues en entier, bien tournées.
//! - HEIF / HEIC : par ffmpeg 8.1 ou plus seulement (IMP-83), qui assemble seul la grille de carreaux des photos d'iPhone
//!   et applique leur rotation. Plus de secours par le décodeur HEIF de Windows (décision du 14/11, IMP-82 : ffmpeg est
//!   toujours fourni avec MyBoard).
//! - DNG : par le décodeur DNG de Windows seulement (intégré à Windows 10 et 11 ; ffmpeg ne lit pas les DNG de l'iPhone :
//!   « format non pris en charge »). Il rend l'image du capteur sans la tourner : la rotation de l'étiquette TIFF 274 est
//!   appliquée ici (photos d'essai en portrait, orientation 6).
//! - Sans le programme qui les lit (ffmpeg récent, décodeur DNG) : `missing_decoder` donne la raison ; l'import ne les
//!   prend pas (IMP-87).
//!
//! Interrupteur d'essai MYBOARD_PHOTOS : `ffmpeg` = décodeur de Windows ignoré (DNG illisibles), `windows` = ffmpeg
//! ignoré pour les photos (HEIF illisibles) : essayer chaque cas sans toucher au PC (demandes du 13/11 et du 14/11).

use std::io::Read;
use std::path::Path;

use anyhow::bail;
use image::DynamicImage;
use image::metadata::Orientation;

use crate::ffmpeg::Ffmpeg;

/// Extensions lues ici.
pub const EXTENSIONS: [&str; 3] = ["heic", "heif", "dng"];

/// Raisons affichées dans le bilan de l'import (réponse Q30 A du 15/11).
const NO_FFMPEG: &str = "Photo HEIF : il faut ffmpeg 8.1 ou plus";
const NO_DNG_DECODER: &str = "Aucun décodeur DNG de Windows sur ce PC";

fn ext(path: &Path) -> String {
    path.extension().map(|e| e.to_string_lossy().to_ascii_lowercase()).unwrap_or_default()
}

pub fn is_photo(path: &Path) -> bool {
    EXTENSIONS.contains(&ext(path).as_str())
}

fn switch() -> String {
    std::env::var("MYBOARD_PHOTOS").unwrap_or_default().trim().to_ascii_lowercase()
}

/// ffmpeg qui sait lire les HEIF / HEIC (8.1 ou plus), sauf interrupteur d'essai.
fn heif_reader(ff: Option<&Ffmpeg>) -> Option<&Ffmpeg> {
    ff.filter(|f| f.recent && switch() != "windows")
}

/// Ce PC n'a pas le programme qui lit ce format : la raison (IMP-87). `None` : lisible, ou pas une photo de ce module.
pub fn missing_decoder(ff: Option<&Ffmpeg>, path: &Path) -> Option<&'static str> {
    match ext(path).as_str() {
        "heic" | "heif" => heif_reader(ff).is_none().then_some(NO_FFMPEG),
        "dng" => (switch() == "ffmpeg" || !wic::has_decoder_for(".dng")).then_some(NO_DNG_DECODER),
        _ => None,
    }
}

/// La photo entière, rotation appliquée.
pub fn open(ff: Option<&Ffmpeg>, path: &Path) -> anyhow::Result<DynamicImage> {
    if ext(path) == "dng" {
        return by_windows(path);
    }
    crate::thumbs::decode(&heif_jpeg(ff, path)?)
}

/// La photo entière en JPEG (visionneuse, copie : D-016) : celui de ffmpeg tel quel, ou l'image de Windows encodée.
pub fn full_jpeg(ff: Option<&Ffmpeg>, path: &Path) -> anyhow::Result<Vec<u8>> {
    if ext(path) != "dng" {
        return heif_jpeg(ff, path);
    }
    let img = by_windows(path)?.into_rgb8();
    let mut out = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 92).encode_image(&img)?;
    Ok(out)
}

/// HEIF / HEIC entier en JPEG, par ffmpeg récent.
fn heif_jpeg(ff: Option<&Ffmpeg>, path: &Path) -> anyhow::Result<Vec<u8>> {
    match heif_reader(ff) {
        Some(ff) => crate::thumbs::photo_jpeg(ff, path),
        None if switch() == "windows" => bail!("ffmpeg ignoré pour les photos (MYBOARD_PHOTOS=windows)"),
        None => bail!("{NO_FFMPEG}"),
    }
}

fn by_windows(path: &Path) -> anyhow::Result<DynamicImage> {
    if switch() == "ffmpeg" {
        bail!("décodeur de Windows désactivé (MYBOARD_PHOTOS=ffmpeg)");
    }
    let mut img = wic::decode(path)?;
    if let Some(o) = tiff_orientation(path).and_then(Orientation::from_exif) {
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
    use std::sync::OnceLock;

    use anyhow::Context;
    use image::{DynamicImage, RgbImage};
    use windows::Win32::Foundation::GENERIC_READ;
    use windows::Win32::Graphics::Imaging::{
        CLSID_WICImagingFactory, GUID_WICPixelFormat24bppRGB, IWICBitmapCodecInfo, IWICImagingFactory, IWICPalette,
        WICBitmapDitherTypeNone, WICBitmapPaletteTypeCustom, WICComponentEnumerateDefault, WICDecodeMetadataCacheOnDemand,
        WICDecoder,
    };
    use windows::Win32::System::Com::{CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx};
    use windows::core::{HSTRING, Interface};

    fn factory() -> anyhow::Result<IWICImagingFactory> {
        // SAFETY : appels COM ordinaires. Déjà initialisé sur ce fil (autre mode) : sans conséquence, WIC fonctionne
        // dans les deux.
        unsafe {
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
            Ok(CoCreateInstance(&CLSID_WICImagingFactory, None, CLSCTX_INPROC_SERVER)?)
        }
    }

    /// Décodage par WIC (Windows Imaging Component) : le décodeur installé pour ce format, image entière en RGB.
    pub fn decode(path: &Path) -> anyhow::Result<DynamicImage> {
        let factory = factory()?;
        // SAFETY : appels COM ordinaires ; le tampon a la taille annoncée (largeur × 3 × hauteur).
        unsafe {
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

    /// Un décodeur de Windows est installé pour cette extension (« .dng ») ; liste lue une fois par lancement (IMP-87).
    pub fn has_decoder_for(ext: &str) -> bool {
        static FOUND: OnceLock<Vec<String>> = OnceLock::new();
        FOUND.get_or_init(|| decoder_extensions().unwrap_or_default()).iter().any(|e| e.eq_ignore_ascii_case(ext))
    }

    /// Extensions de tous les décodeurs de WIC installés (« .jpg », « .dng »…).
    fn decoder_extensions() -> anyhow::Result<Vec<String>> {
        let factory = factory()?;
        let mut out = Vec::new();
        // SAFETY : appels COM ordinaires ; chaque tampon a la longueur que WIC a donnée juste avant.
        unsafe {
            let list = factory.CreateComponentEnumerator(WICDecoder.0 as u32, WICComponentEnumerateDefault.0 as u32)?;
            loop {
                let mut item = [None];
                let mut fetched = 0u32;
                if list.Next(&mut item, Some(&mut fetched)).is_err() || fetched == 0 {
                    break;
                }
                let Some(info) = item[0].take().and_then(|u| u.cast::<IWICBitmapCodecInfo>().ok()) else { continue };
                let mut len = 0u32;
                let _ = info.GetFileExtensions(&mut [], &mut len);
                let mut text = vec![0u16; len as usize];
                if len > 0 && info.GetFileExtensions(&mut text, &mut len).is_ok() {
                    let text = String::from_utf16_lossy(&text[..(len as usize).saturating_sub(1)]);
                    out.extend(text.split(',').map(|e| e.trim().to_string()));
                }
            }
        }
        Ok(out)
    }
}

#[cfg(not(windows))]
mod wic {
    pub fn decode(_: &std::path::Path) -> anyhow::Result<image::DynamicImage> {
        anyhow::bail!("décodeur de Windows absent")
    }

    pub fn has_decoder_for(_: &str) -> bool {
        false
    }
}
