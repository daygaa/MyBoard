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
    "jpg", "jpeg", "jpe", "jfif", "png", "gif", "webp", "bmp", "tif", "tiff", "avif", "heic", "heif",
];
const VIDEOS: &[&str] = &[
    "mp4", "m4v", "mov", "webm", "mkv", "avi", "wmv", "flv", "mpg", "mpeg", "ts", "m2ts", "mts",
    "3gp", "ogv",
];
const AUDIO: &[&str] = &["mp3", "wav", "flac", "ogg", "oga", "m4a", "aac", "opus", "wma"];
const DOCUMENTS: &[&str] = &[
    // PDF
    "pdf",
    // PowerPoint / Slides
    "ppt", "pptx", "pps", "ppsx", "odp", "gslides",
    // Excel / Sheets
    "xls", "xlsx", "xlsm", "ods", "csv", "gsheet",
    // Word (ajouté le 11/10/2026, IMP-07)
    "doc", "docx", "odt",
];

/// Extension en minuscules, sans le point.
pub fn extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
}

/// Type du fichier d'après son extension ; `None` = format non pris en charge.
pub fn kind_of_ext(ext: &str) -> Option<Kind> {
    if IMAGES.contains(&ext) {
        Some(Kind::Image)
    } else if VIDEOS.contains(&ext) {
        Some(Kind::Video)
    } else if AUDIO.contains(&ext) {
        Some(Kind::Audio)
    } else if DOCUMENTS.contains(&ext) {
        Some(Kind::Document)
    } else {
        None
    }
}

/// Toutes les extensions acceptées, pour le filtre de la fenêtre « Importer des fichiers » :
/// la liste n'existe qu'ici, l'interface la demande au cœur Rust.
#[tauri::command]
pub fn supported_extensions() -> Vec<&'static str> {
    [IMAGES, VIDEOS, AUDIO, DOCUMENTS].concat()
}
