//! L'image d'un média, au-delà de son fichier (menus du clic droit de la visionneuse) :
//! - « Copier l'image » (CTX-06) : l'image elle-même dans le presse-papiers, à coller dans Paint,
//!   une conversation… ;
//! - « Utiliser comme fond d'écran du bureau » (CTX-06) ;
//! - « Enregistrer une capture d'écran » d'une vidéo (CTX-07) : l'image affichée au moment du clic,
//!   pleine résolution, extraite par ffmpeg, enregistrée en .jpg là où l'utilisateur le choisit
//!   (fenêtre « Enregistrer sous » de Windows).

use std::path::{Path, PathBuf};

use image::{DynamicImage, ImageDecoder, ImageReader, metadata::Orientation};
use tauri::{AppHandle, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

use super::{OpenFailure, clipboard, existing_path};
use crate::AppState;
use crate::thumbs;

/// Images par seconde supposées si ffprobe ne les donne pas (comme la visionneuse, VIEW-29).
const DEFAULT_FPS: f64 = 30.0;
/// Formats que Windows prend tels quels comme fond d'écran.
const WALLPAPER_FORMATS: [&str; 4] = ["jpg", "jpeg", "png", "bmp"];

fn failure(e: impl std::fmt::Display) -> OpenFailure {
    OpenFailure::new(None, e.to_string())
}

fn ffmpeg_missing() -> OpenFailure {
    OpenFailure::new(None, "ffmpeg est introuvable : installez ffmpeg, puis relancez MyBoard.")
}

/// Image telle qu'affichée (orientation de l'appareil photo appliquée). Formats que Rust ne lit
/// pas (HEIC…) : convertie par ffmpeg, comme dans la visionneuse.
fn load(state: &AppState, path: &Path) -> Result<DynamicImage, OpenFailure> {
    let bytes = std::fs::read(path)?;
    if let Ok(image) = thumbs::decode(&bytes) {
        return Ok(image);
    }
    let ffmpeg = state.thumbs.ffmpeg().ok_or_else(ffmpeg_missing)?;
    thumbs::decode(&thumbs::full_image_jpeg(ffmpeg, path).map_err(failure)?).map_err(failure)
}

#[tauri::command]
pub async fn copy_image(state: State<'_, AppState>, id: i64) -> Result<(), OpenFailure> {
    let path = existing_path(&state, id)?;
    clipboard::copy_image(&load(&state, &path)?)
}

/// Fichier à donner à Windows : l'original s'il le prend tel quel et qu'il n'est pas à tourner ;
/// sinon une copie convertie dans le dossier de données de MyBoard (remplacée à chaque fois).
fn wallpaper_file(state: &AppState, path: &Path) -> Result<PathBuf, OpenFailure> {
    let ext = path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    let rotated = || {
        let mut decoder = ImageReader::open(path).ok()?.with_guessed_format().ok()?.into_decoder().ok()?;
        decoder.orientation().ok().map(|o| o != Orientation::NoTransforms)
    };
    if WALLPAPER_FORMATS.contains(&ext.as_str()) && rotated() == Some(false) {
        return Ok(path.to_path_buf());
    }
    let copy = state.paths.root.join("fond-ecran.png");
    load(state, path)?.save(&copy).map_err(failure)?;
    Ok(copy)
}

#[tauri::command]
pub async fn set_wallpaper(state: State<'_, AppState>, id: i64) -> Result<(), OpenFailure> {
    let path = existing_path(&state, id)?;
    apply_wallpaper(&wallpaper_file(&state, &path)?)
}

#[cfg(windows)]
fn apply_wallpaper(path: &Path) -> Result<(), OpenFailure> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::WindowsAndMessaging::{SPI_SETDESKWALLPAPER, SPIF_SENDCHANGE, SPIF_UPDATEINIFILE, SystemParametersInfoW};

    let mut wide: Vec<u16> = path.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
    // SAFETY : chemin terminé par 0, lu par Windows pendant l'appel seulement. Le réglage est
    // enregistré (fond d'écran gardé au redémarrage) et annoncé aux autres programmes.
    let done = unsafe { SystemParametersInfoW(SPI_SETDESKWALLPAPER, 0, wide.as_mut_ptr().cast(), SPIF_UPDATEINIFILE | SPIF_SENDCHANGE) };
    if done == 0 {
        return Err(std::io::Error::last_os_error().into());
    }
    Ok(())
}

#[cfg(not(windows))]
fn apply_wallpaper(_path: &Path) -> Result<(), OpenFailure> {
    Err(OpenFailure::new(None, "Le fond d'écran ne peut être changé que sous Windows."))
}

/// `date` : date du jour fournie par l'interface, « JJ-MM-AA ». Rien n'est enregistré si
/// l'utilisateur ferme la fenêtre « Enregistrer sous ».
#[tauri::command]
pub async fn save_video_frame(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, AppState>,
    id: i64,
    seconds: f64,
    date: String,
) -> Result<(), OpenFailure> {
    let path = existing_path(&state, id)?;
    let ffmpeg = state.thumbs.ffmpeg().cloned().ok_or_else(ffmpeg_missing)?;
    let jpeg = thumbs::frame_jpeg_at(&ffmpeg, &path, seconds).map_err(failure)?;
    let fps = thumbs::frame_rate(&ffmpeg, &path).unwrap_or(DEFAULT_FPS);
    let frame = (seconds.max(0.0) * fps).round() as u64;
    let stem = path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
    let date: String = date.chars().filter(|c| c.is_ascii_digit() || *c == '-').collect();
    let name = format!("Screenshot_{stem}_{frame}_{date}.jpg");
    let chosen = app
        .dialog()
        .file()
        .set_parent(&window)
        .set_title("Enregistrer la capture d'écran")
        .set_file_name(name)
        .add_filter("Image JPEG", &["jpg"])
        .blocking_save_file();
    let Some(target) = chosen else { return Ok(()) };
    std::fs::write(target.into_path().map_err(failure)?, jpeg)?;
    Ok(())
}
