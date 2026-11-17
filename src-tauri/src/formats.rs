//! Formats de fichiers acceptés à l'import (IMP-05, IMP-07) et leur type.

use std::path::Path;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    Image,
    Video,
    Audio,
    Document,
}

impl Kind {
    /// Valeur stockée en base (colonne `media.kind`).
    pub fn as_str(self) -> &'static str {
        match self {
            Kind::Image => "image",
            Kind::Video => "video",
            Kind::Audio => "audio",
            Kind::Document => "document",
        }
    }
}

const IMAGES: &[&str] = &[
    "jpg", "jpeg", "jpe", "jfif", "png", "gif", "webp", "bmp", "tif", "tiff", "avif", "heic", "heif", "dng",
];
// Plus ceux du lot R7 (IMP-89) : TGA, ICO, QOI, EXR, HDR, SVG, JPEG XL, RAW d'appareils photo (`decode` ; le PSD,
// aussi lu par `decode`, est un document).
const VIDEOS: &[&str] = &[
    "mp4", "m4v", "mov", "webm", "mkv", "avi", "wmv", "flv", "mpg", "mpeg", "ts", "m2ts", "mts",
    "3gp", "ogv",
];
const AUDIO: &[&str] = &["mp3", "wav", "flac", "ogg", "oga", "m4a", "aac", "opus", "wma"];
const DOCUMENTS: &[&str] = &[
    // PDF
    "pdf",
    // PowerPoint. Les raccourcis .gslides / .gsheet de Google Drive (sans contenu sur le PC : ils
    // ouvrent la page Google dans le navigateur) sont ignorés depuis le 09/11 (IMP-05).
    "ppt", "pptx", "pps", "ppsx", "odp",
    // Excel
    "xls", "xlsx", "xlsm", "ods", "csv",
    // Word (ajouté le 11/10/2026, IMP-07)
    "doc", "docx", "odt",
    // Photoshop (lot R7, réponse Q55 A du 17/11) : un document de travail, jamais compressé ni converti ; sa miniature
    // et la visionneuse montrent son image aplatie (`decode`, `is_picture`).
    "psd",
];

/// Document montré comme une image (miniature, visionneuse) : le PSD (réponse Q55 A).
pub fn is_picture(path: &Path) -> bool {
    extension(path).as_deref() == Some("psd")
}

/// Extension en minuscules, sans le point.
pub fn extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
}

/// Type du fichier d'après son extension ; `None` = format non pris en charge.
pub fn kind_of_ext(ext: &str) -> Option<Kind> {
    if DOCUMENTS.contains(&ext) {
        Some(Kind::Document)
    } else if IMAGES.contains(&ext) || crate::decode::extensions().any(|e| e == ext) {
        Some(Kind::Image)
    } else if VIDEOS.contains(&ext) {
        Some(Kind::Video)
    } else if AUDIO.contains(&ext) {
        Some(Kind::Audio)
    } else {
        None
    }
}

/// Toutes les extensions acceptées, pour le filtre de la fenêtre « Importer des fichiers » :
/// la liste n'existe qu'ici, l'interface la demande au cœur Rust.
#[tauri::command]
pub fn supported_extensions() -> Vec<&'static str> {
    let mut images = IMAGES.to_vec();
    images.extend(crate::decode::extensions().filter(|e| !DOCUMENTS.contains(e)));
    [images.as_slice(), VIDEOS, AUDIO, DOCUMENTS].concat()
}

/// Extensions des RAW d'appareils photo (IMP-89) : la visionneuse montre leur aperçu intégré en attendant l'image
/// décodée (VIEW-63).
#[tauri::command]
pub fn raw_extensions() -> Vec<&'static str> {
    crate::decode::raw::EXTENSIONS.to_vec()
}
