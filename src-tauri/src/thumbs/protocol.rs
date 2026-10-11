//! Protocole `thumb://` : sert les miniatures (lues dans `thumbs.db`) à l'interface.
//!
//! Sous Windows l'adresse devient `http://thumb.localhost/<hash>.webp`. Comparé le
//! 11/10/2026 à un serveur HTTP local, ce protocole est 2,5 fois plus rapide dans la
//! fenêtre (≈400 ms contre ≈1 100 ms pour une page de 500 vignettes) : voir D-014.

use std::cell::OnceCell;
use std::path::{Path, PathBuf};

use rusqlite::Connection;
use tauri::http::{Request, Response, StatusCode, header};
use tauri::{AppHandle, Manager, UriSchemeResponder};

use super::store;
use crate::AppState;
use crate::paths;

thread_local! {
    /// Une connexion en lecture par fil de travail, ouverte à la première demande.
    static READER: OnceCell<Option<Connection>> = const { OnceCell::new() };
}

pub fn handle(app: &AppHandle, request: Request<Vec<u8>>, responder: UriSchemeResponder) {
    let name = request.uri().path().trim_start_matches('/').to_string();
    let thumbs_db = app.state::<AppState>().paths.thumbs_db.clone();
    // Lecture hors du fil principal : la fenêtre n'attend jamais le disque.
    tauri::async_runtime::spawn_blocking(move || responder.respond(respond(&thumbs_db, &name)));
}

fn respond(thumbs_db: &Path, name: &str) -> Response<Vec<u8>> {
    let body = name
        .strip_suffix(".webp")
        .filter(|hash| paths::is_valid_hash(hash))
        .and_then(|hash| read(thumbs_db.to_path_buf(), hash));
    match body {
        // Le contenu d'une miniature ne change jamais pour un même hash.
        Some(bytes) => Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "image/webp")
            .header(header::CACHE_CONTROL, "public, max-age=31536000, immutable")
            .body(bytes),
        None => Response::builder().status(StatusCode::NOT_FOUND).body(Vec::new()),
    }
    .unwrap_or_else(|_| Response::new(Vec::new()))
}

fn read(thumbs_db: PathBuf, hash: &str) -> Option<Vec<u8>> {
    READER.with(|cell| {
        let conn = cell.get_or_init(|| store::open_reader(&thumbs_db).ok()).as_ref()?;
        store::get(conn, hash).ok().flatten()
    })
}
