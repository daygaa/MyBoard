//! Protocole `media://` : sert le FICHIER ORIGINAL d'un média à la visionneuse (D-016).
//!
//! Adresse (sous Windows `http://media.localhost/…`) : `<id>/<hash>.<ext>`. Seuls les médias
//! de la bibliothèque sont servis : l'identifiant ET l'empreinte doivent correspondre.
//! Le contenu d'une adresse ne change donc jamais : la fenêtre peut le garder en cache
//! (préchargement des médias voisins).
//!
//! Vidéo d'un GIF (VIEW-54, `gif.rs`) : `gif/<id>/<hash>.mp4`, servie depuis le cache si elle y est.
//!
//! Image que la fenêtre n'a pas su afficher (VIEW-59, réponse Q34 A du 15/11) : `jpeg/<id>/<hash>.<ext>`, convertie en
//! JPEG par un décodeur de MyBoard (le sien, ffmpeg, ou celui des photos HEIF / DNG) ; échec : carte « Image illisible ».
//!
//! Lisible aussi par la page et ses fils à part (`fetch`, en-tête CORS) : copies des images à la taille de
//! l'écran (VIEW-53). Seule la fenêtre de MyBoard voit ce protocole.
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
/// Formats d'image que WebView2 n'affiche pas : convertis par ffmpeg (D-016, point 8) ; HEIF / HEIC et DNG par
/// `photos.rs` (IMP-80, IMP-82).
const CONVERTED: [&str; 5] = ["tif", "tiff", "heic", "heif", "dng"];
/// Dernières images converties gardées en mémoire (retour sur l'image précédente… ; 6 depuis le lot R7 : l'image
/// affichée et ses 3 voisines préparées d'avance, VIEW-63, plus de la marge).
const CONVERTED_KEPT: usize = 6;
/// Aperçu intégré d'un RAW (VIEW-63) : réduit à ce côté au plus, pour arriver vite.
const RAW_PREVIEW_SIDE: u32 = 2560;

thread_local! {
    static READER: OnceCell<Option<Connection>> = const { OnceCell::new() };
}

/// Gardées par numéro ET empreinte du média : un numéro libéré (média supprimé) peut être repris par un autre média
/// importé ensuite, qui recevait alors l'image de l'ancien (IMP-82, point 3, 13/11).
type Converted = ((i64, String), Arc<Vec<u8>>);
static CONVERTED_CACHE: Mutex<VecDeque<Converted>> = Mutex::new(VecDeque::new());

struct Target {
    id: i64,
    hash: String,
    path: PathBuf,
    ext: String,
}

pub fn handle(app: &AppHandle, request: Request<Vec<u8>>, responder: UriSchemeResponder) {
    let state = app.state::<AppState>();
    let db_path = state.paths.db.clone();
    let root = state.paths.root.clone();
    let ffmpeg = state.thumbs.ffmpeg().cloned();
    let range = request.headers().get(header::RANGE).and_then(|v| v.to_str().ok()).map(str::to_string);
    let name = request.uri().path().trim_start_matches('/').to_string();
    let app = app.clone();
    // Lecture du disque hors du fil principal : la fenêtre n'attend jamais.
    tauri::async_runtime::spawn_blocking(move || {
        // Fichier supprimé pendant la séance : le média passe « fichier introuvable » (VIEW-65).
        let lookup = |rest: &str| lookup(&db_path, rest).filter(|t| present(&app, t));
        let as_jpeg = name.starts_with("jpeg/");
        if let Some(rest) = name.strip_prefix("apercu/") {
            let response = match lookup(rest).and_then(|t| raw_preview(&t.path)) {
                Some(bytes) => ok(bytes, "image/jpeg"),
                None => status(StatusCode::NOT_FOUND),
            };
            responder.respond(response);
            return;
        }
        let target = if let Some(rest) = name.strip_prefix("gif/") {
            lookup(rest).filter(|t| t.ext == "gif").and_then(|t| gif_target(&root, t, rest))
        } else {
            lookup(name.strip_prefix("jpeg/").unwrap_or(&name))
        };
        let response = match target {
            Some(target) if as_jpeg => match converted(&target, ffmpeg.as_ref(), true) {
                Some(bytes) => ok(bytes.as_ref().clone(), image_type(&bytes)),
                None => status(StatusCode::UNSUPPORTED_MEDIA_TYPE),
            },
            Some(target) => serve(&target, range.as_deref(), ffmpeg.as_ref()),
            None => status(StatusCode::NOT_FOUND),
        };
        responder.respond(response);
    });
}

/// Le fichier du média est-il sur le disque ? Sinon, la marque « fichier introuvable » est posée (VIEW-65).
fn present(app: &AppHandle, target: &Target) -> bool {
    if target.path.exists() {
        return true;
    }
    if let Some(state) = app.try_state::<AppState>() {
        crate::library_check::found_missing(&state.db.lock().unwrap(), target.id, &target.path);
    }
    false
}

/// Vidéo d'un GIF dans le cache (`<id>/<hash>.mp4`), si elle a été préparée.
fn gif_target(root: &Path, gif: Target, rest: &str) -> Option<Target> {
    let hash = rest.split_once('/')?.1.split('.').next()?;
    let path = super::gif::cached_video(root, hash);
    path.exists().then(|| Target { id: gif.id, hash: gif.hash, path, ext: "mp4".into() })
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
            .map(|(path, ext)| Target { id, hash: hash.to_owned(), path: PathBuf::from(path), ext })
    })
}

fn serve(target: &Target, range: Option<&str>, ffmpeg: Option<&Ffmpeg>) -> Response<Vec<u8>> {
    if CONVERTED.contains(&target.ext.as_str()) || crate::decode::handles(&target.path) {
        return match converted(target, ffmpeg, false) {
            Some(bytes) => ok(bytes.as_ref().clone(), image_type(&bytes)),
            None => status(StatusCode::UNSUPPORTED_MEDIA_TYPE),
        };
    }
    match read_part(&target.path, range) {
        Ok(Part { bytes, start, total, partial }) => {
            let mut builder = Response::builder()
                .header(header::CONTENT_TYPE, content_type(&target.ext))
                .header(header::ACCEPT_RANGES, "bytes")
                .header(header::CACHE_CONTROL, "public, max-age=31536000, immutable")
                .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*");
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

/// Image convertie en JPEG pleine résolution, gardée en mémoire pour les retours en arrière. `any` : image que la
/// fenêtre n'a pas su afficher (VIEW-59) : le décodeur de MyBoard d'abord, ffmpeg ensuite.
fn converted(target: &Target, ffmpeg: Option<&Ffmpeg>, any: bool) -> Option<Arc<Vec<u8>>> {
    let key = (target.id, target.hash.clone());
    if let Some((_, bytes)) = CONVERTED_CACHE.lock().unwrap().iter().find(|(k, _)| *k == key) {
        return Some(bytes.clone());
    }
    let jpeg = if crate::photos::is_photo(&target.path) {
        crate::photos::full_jpeg(ffmpeg, &target.path)
    } else if crate::decode::handles(&target.path) {
        displayed(&target.path)
    } else if any {
        decoded_jpeg(ffmpeg, &target.path)
    } else {
        thumbs::full_image_jpeg(ffmpeg?, &target.path)
    };
    let bytes = Arc::new(jpeg.ok()?);
    let mut cache = CONVERTED_CACHE.lock().unwrap();
    cache.push_back((key, bytes.clone()));
    if cache.len() > CONVERTED_KEPT {
        cache.pop_front();
    }
    Some(bytes)
}

/// Format du lot R7 (IMP-89) : JPEG, ou PNG s'il est transparent (SVG, ICO, PSD… : sinon fond noir).
fn displayed(path: &Path) -> anyhow::Result<Vec<u8>> {
    let img = thumbs::open_image(path)?;
    let mut out = Vec::new();
    if img.color().has_alpha() {
        img.into_rgba8().write_to(&mut std::io::Cursor::new(&mut out), image::ImageFormat::Png)?;
    } else {
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 92).encode_image(&img.into_rgb8())?;
    }
    Ok(out)
}

/// Aperçu JPEG intégré à un RAW, réduit (VIEW-63) ; `None` : pas un RAW, ou illisible.
fn raw_preview(path: &Path) -> Option<Vec<u8>> {
    if !crate::decode::raw::is_raw(path) {
        return None;
    }
    // Sans aperçu lisible (Olympus ORF…) : rien ; la miniature reste jusqu'à l'image décodée (retour 64.1).
    let mut img = crate::decode::raw::embedded(path).ok()??;
    if img.width().max(img.height()) > RAW_PREVIEW_SIDE {
        img = img.thumbnail(RAW_PREVIEW_SIDE, RAW_PREVIEW_SIDE);
    }
    let mut out = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 88).encode_image(&img.into_rgb8()).ok()?;
    Some(out)
}

/// Type d'une image convertie, d'après sa signature (PNG ou JPEG).
fn image_type(bytes: &[u8]) -> &'static str {
    if bytes.starts_with(b"\x89PNG") { "image/png" } else { "image/jpeg" }
}

/// L'image par le décodeur de MyBoard, encodée en JPEG ; sinon par ffmpeg.
fn decoded_jpeg(ffmpeg: Option<&Ffmpeg>, path: &Path) -> anyhow::Result<Vec<u8>> {
    match thumbs::open_image(path) {
        Ok(img) => {
            let mut out = Vec::new();
            image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 92).encode_image(&img.into_rgb8())?;
            Ok(out)
        }
        Err(e) => match ffmpeg {
            Some(ff) => thumbs::full_image_jpeg(ff, path),
            None => Err(e),
        },
    }
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
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(bytes)
        .unwrap_or_else(|_| status(StatusCode::INTERNAL_SERVER_ERROR))
}

fn status(code: StatusCode) -> Response<Vec<u8>> {
    Response::builder().status(code).body(Vec::new()).unwrap_or_else(|_| Response::new(Vec::new()))
}
