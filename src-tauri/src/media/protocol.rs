//! Protocole `media://` : sert le FICHIER ORIGINAL d'un média à la visionneuse (D-016).
//!
//! Adresse (sous Windows `http://media.localhost/…`) : `<id>/<hash>.<ext>`. Seuls les médias
//! de la bibliothèque sont servis : l'identifiant ET l'empreinte doivent correspondre.
//! Le contenu d'une adresse ne change donc jamais : la fenêtre peut le garder en cache
//! (préchargement des médias voisins).
//!
//! Vidéos et sons : lecture partielle (« requêtes Range ») — le lecteur ne demande que le
//! morceau dont il a besoin, avancer à la 40e minute d'un fichier de 4 Go est immédiat.

use std::cell::OnceCell;
use std::collections::VecDeque;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use rusqlite::{Connection, OptionalExtension};
use tauri::http::{Request, Response, StatusCode, header};
use tauri::{AppHandle, Manager, UriSchemeResponder};

use crate::ffmpeg::Ffmpeg;
use crate::{AppState, db, thumbs};

/// Taille d'un morceau quand le lecteur demande « la suite du fichier » sans fin précise.
const OPEN_CHUNK: u64 = 2 * 1024 * 1024;
/// Plus grand morceau servi d'un coup (le protocole renvoie tout en mémoire).
const MAX_CHUNK: u64 = 8 * 1024 * 1024;
/// Au-delà, un fichier demandé sans « Range » est tout de même servi par morceaux.
const WHOLE_FILE_MAX: u64 = 64 * 1024 * 1024;
/// Formats d'image que WebView2 n'affiche pas : convertis par ffmpeg (D-016, point 8).
const CONVERTED: [&str; 4] = ["tif", "tiff", "heic", "heif"];
/// Dernières images converties gardées en mémoire (retour sur l'image précédente…).
const CONVERTED_KEPT: usize = 4;

thread_local! {
    static READER: OnceCell<Option<Connection>> = const { OnceCell::new() };
}

static CONVERTED_CACHE: Mutex<VecDeque<(i64, Arc<Vec<u8>>)>> = Mutex::new(VecDeque::new());

struct Target {
    id: i64,
    path: PathBuf,
    ext: String,
}

pub fn handle(app: &AppHandle, request: Request<Vec<u8>>, responder: UriSchemeResponder) {
    let state = app.state::<AppState>();
    let db_path = state.paths.db.clone();
    let ffmpeg = state.thumbs.ffmpeg().cloned();
    let range = request.headers().get(header::RANGE).and_then(|v| v.to_str().ok()).map(str::to_string);
    let name = request.uri().path().trim_start_matches('/').to_string();
    // Lecture du disque hors du fil principal : la fenêtre n'attend jamais.
    tauri::async_runtime::spawn_blocking(move || {
        let response = match lookup(&db_path, &name) {
            Some(target) => serve(&target, range.as_deref(), ffmpeg.as_ref()),
            None => status(StatusCode::NOT_FOUND),
        };
        responder.respond(response);
    });
}

/// `<id>/<hash>.<ext>` → le média correspondant, s'il existe avec cette empreinte.
fn lookup(db_path: &Path, name: &str) -> Option<Target> {
    let (id, file) = name.split_once('/')?;
    let id: i64 = id.parse().ok()?;
    let hash = file.split('.').next()?;
    READER.with(|cell| {
        let conn = cell.get_or_init(|| db::open(db_path).ok()).as_ref()?;
        conn.prepare_cached("SELECT path, ext FROM media WHERE id = ?1 AND hash = ?2")
            .ok()?
            .query_row(rusqlite::params![id, hash], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
            .optional()
            .ok()
            .flatten()
            .map(|(path, ext)| Target { id, path: PathBuf::from(path), ext })
    })
}

fn serve(target: &Target, range: Option<&str>, ffmpeg: Option<&Ffmpeg>) -> Response<Vec<u8>> {
    if CONVERTED.contains(&target.ext.as_str()) {
        return match converted(target, ffmpeg) {
            Some(bytes) => ok(bytes.as_ref().clone(), "image/jpeg"),
            None => status(StatusCode::UNSUPPORTED_MEDIA_TYPE),
        };
    }
    match read_part(&target.path, range) {
        Ok(Part { bytes, start, total, partial }) => {
            let mut builder = Response::builder()
                .header(header::CONTENT_TYPE, content_type(&target.ext))
                .header(header::ACCEPT_RANGES, "bytes")
                .header(header::CACHE_CONTROL, "public, max-age=31536000, immutable");
            if partial {
                let end = start + bytes.len() as u64 - 1;
                builder = builder
                    .status(StatusCode::PARTIAL_CONTENT)
                    .header(header::CONTENT_RANGE, format!("bytes {start}-{end}/{total}"));
            } else {
                builder = builder.status(StatusCode::OK);
            }
            builder.body(bytes).unwrap_or_else(|_| status(StatusCode::INTERNAL_SERVER_ERROR))
        }
        Err(PartError::Missing) => status(StatusCode::NOT_FOUND),
        Err(PartError::BadRange(total)) => Response::builder()
            .status(StatusCode::RANGE_NOT_SATISFIABLE)
            .header(header::CONTENT_RANGE, format!("bytes */{total}"))
            .body(Vec::new())
            .unwrap_or_else(|_| status(StatusCode::INTERNAL_SERVER_ERROR)),
    }
}

struct Part {
    bytes: Vec<u8>,
    start: u64,
    total: u64,
    partial: bool,
}

enum PartError {
    Missing,
    BadRange(u64),
}

/// Lit le morceau demandé (`bytes=début-fin`, `bytes=début-` ou `bytes=-taille`).
fn read_part(path: &Path, range: Option<&str>) -> Result<Part, PartError> {
    let mut file = File::open(path).map_err(|_| PartError::Missing)?;
    let total = file.metadata().map_err(|_| PartError::Missing)?.len();
    let (start, end, partial) = match range.and_then(|r| r.strip_prefix("bytes=")) {
        Some(spec) => {
            let (a, b) = spec.split(',').next().unwrap_or("").split_once('-').ok_or(PartError::BadRange(total))?;
            let (start, end) = match (a.trim().parse::<u64>().ok(), b.trim().parse::<u64>().ok()) {
                (Some(s), Some(e)) => (s, e.min(total.saturating_sub(1)).min(s + MAX_CHUNK - 1)),
                (Some(s), None) => (s, (s + OPEN_CHUNK - 1).min(total.saturating_sub(1))),
                (None, Some(n)) => (total.saturating_sub(n), total.saturating_sub(1)),
                (None, None) => return Err(PartError::BadRange(total)),
            };
            if start >= total || start > end {
                return Err(PartError::BadRange(total));
            }
            (start, end, true)
        }
        // Gros fichier demandé d'un bloc : on sert le début, le lecteur demandera la suite.
        None if total > WHOLE_FILE_MAX => (0, OPEN_CHUNK.min(total) - 1, true),
        None => (0, total.saturating_sub(1), false),
    };
    let len = if total == 0 { 0 } else { end - start + 1 };
    let mut bytes = vec![0; len as usize];
    file.seek(SeekFrom::Start(start)).map_err(|_| PartError::Missing)?;
    file.read_exact(&mut bytes).map_err(|_| PartError::Missing)?;
    Ok(Part { bytes, start, total, partial })
}

/// Image convertie en JPEG pleine résolution, gardée en mémoire pour les retours en arrière.
fn converted(target: &Target, ffmpeg: Option<&Ffmpeg>) -> Option<Arc<Vec<u8>>> {
    if let Some((_, bytes)) = CONVERTED_CACHE.lock().unwrap().iter().find(|(id, _)| *id == target.id) {
        return Some(bytes.clone());
    }
    let bytes = Arc::new(thumbs::full_image_jpeg(ffmpeg?, &target.path).ok()?);
    let mut cache = CONVERTED_CACHE.lock().unwrap();
    cache.push_back((target.id, bytes.clone()));
    if cache.len() > CONVERTED_KEPT {
        cache.pop_front();
    }
    Some(bytes)
}

/// Type annoncé à la fenêtre. Les `.mov` sont annoncés en MP4 : c'est la même famille de
/// conteneur, et WebView2 refuse le type « quicktime » alors qu'il sait souvent les lire.
fn content_type(ext: &str) -> &'static str {
    match ext {
        "jpg" | "jpeg" | "jpe" | "jfif" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "avif" => "image/avif",
        "mp4" | "m4v" | "mov" => "video/mp4",
        "webm" => "video/webm",
        "mkv" => "video/x-matroska",
        "ogv" => "video/ogg",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "flac" => "audio/flac",
        "ogg" | "oga" | "opus" => "audio/ogg",
        "m4a" | "aac" => "audio/mp4",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    }
}

fn ok(bytes: Vec<u8>, content_type: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .body(bytes)
        .unwrap_or_else(|_| status(StatusCode::INTERNAL_SERVER_ERROR))
}

fn status(code: StatusCode) -> Response<Vec<u8>> {
    Response::builder().status(code).body(Vec::new()).unwrap_or_else(|_| Response::new(Vec::new()))
}
