//! Lecture de la bibliothèque pour la grille : pages, filtres, tris, recherche, statistiques.

use rusqlite::{Connection, params_from_iter, types::Value};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::ffmpeg::FfmpegStatus;
use crate::{AppState, search};

const KINDS: [&str; 4] = ["image", "video", "audio", "document"];

/// Demande d'une page de la grille. Filtres et tri sont indépendants des tags (FILT-02).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Types cochés (FILT-01) ; vide = tous.
    pub kinds: Vec<String>,
    /// Termes de la recherche par tags (SRCH-02 à SRCH-05) ; vide = toute la bibliothèque.
    #[serde(default)]
    pub terms: Vec<String>,
    pub sort: String,
    /// Graine du tri aléatoire : même graine = même ordre d'une page à l'autre.
    pub seed: u32,
    pub page: u32,
    pub page_size: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaItem {
    pub id: i64,
    pub hash: String,
    pub file_name: String,
    pub ext: String,
    pub kind: String,
    pub size: i64,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub duration_ms: Option<i64>,
    pub thumb_status: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListPage {
    pub items: Vec<MediaItem>,
    pub total: u64,
    /// Page réellement renvoyée : on ne peut jamais tomber sur une page inexistante (PAGE-01).
    pub page: u32,
    pub page_count: u32,
    /// Médias par page réellement utilisés : position d'un média = (page − 1) × page_size + rang.
    pub page_size: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Stats {
    pub total: u64,
    pub images: u64,
    pub videos: u64,
    pub audio: u64,
    pub documents: u64,
    pub tags: u64,
    pub thumbs_pending: u64,
}

/// Clause ORDER BY de chaque tri (FILT-04, FILT-05). L'id départage les égalités :
/// sans lui, deux pages pourraient montrer le même média.
fn order_by(sort: &str) -> &'static str {
    match sort {
        "oldest" => "id ASC",
        "created_desc" => "file_created_at DESC, id DESC",
        "created_asc" => "file_created_at IS NULL, file_created_at ASC, id ASC",
        "size_desc" => "size DESC, id DESC",
        "size_asc" => "size ASC, id ASC",
        "res_desc" => "pixels DESC, id DESC",
        "res_asc" => "pixels IS NULL, pixels ASC, id ASC",
        "tags_desc" => "tag_count DESC, id DESC",
        "tags_asc" => "tag_count ASC, id ASC",
        // Mélange reproductible : (id × grand nombre + graine) modulo un nombre premier.
        "random" => "(id * 2654435761 + ?) % 4294967291, id",
        _ => "id DESC", // « Récents »
    }
}

pub fn list(db: &Connection, query: &ListQuery) -> rusqlite::Result<ListPage> {
    let kinds: Vec<&str> = KINDS.into_iter().filter(|k| query.kinds.iter().any(|q| q == k)).collect();
    let mut filter_params: Vec<Value> = Vec::new();
    let mut conditions = Vec::new();
    if !kinds.is_empty() && kinds.len() < KINDS.len() {
        filter_params.extend(kinds.iter().map(|k| Value::Text((*k).to_string())));
        conditions.push(format!("kind IN ({})", vec!["?"; kinds.len()].join(",")));
    }
    // Le type et la recherche se cumulent : changer de filtre ne retire jamais les tags (FILT-03).
    conditions.extend(search::conditions(&query.terms, &mut filter_params));
    let filter = if conditions.is_empty() { String::new() } else { format!("WHERE {}", conditions.join(" AND ")) };

    let total = db.query_row(
        &format!("SELECT COUNT(*) FROM media {filter}"),
        params_from_iter(&filter_params),
        |r| r.get::<_, i64>(0),
    )? as u64;
    let page_size = query.page_size.clamp(1, 1000);
    let page_count = (total.div_ceil(page_size as u64)).max(1) as u32;
    let page = query.page.clamp(1, page_count);

    let mut params = filter_params;
    if query.sort == "random" {
        params.push(Value::Integer(query.seed as i64));
    }
    params.push(Value::Integer(page_size as i64));
    params.push(Value::Integer(((page - 1) * page_size) as i64));
    let sql = format!(
        "SELECT id, hash, file_name, ext, kind, size, width, height, duration_ms, thumb_status
         FROM media {filter} ORDER BY {} LIMIT ? OFFSET ?",
        order_by(&query.sort)
    );
    let mut stmt = db.prepare_cached(&sql)?;
    let items = stmt
        .query_map(params_from_iter(&params), |r| {
            Ok(MediaItem {
                id: r.get(0)?,
                hash: r.get(1)?,
                file_name: r.get(2)?,
                ext: r.get(3)?,
                kind: r.get(4)?,
                size: r.get(5)?,
                width: r.get(6)?,
                height: r.get(7)?,
                duration_ms: r.get(8)?,
                thumb_status: r.get(9)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(ListPage { items, total, page, page_count, page_size })
}

pub fn stats(db: &Connection) -> rusqlite::Result<Stats> {
    let mut stats = Stats { total: 0, images: 0, videos: 0, audio: 0, documents: 0, tags: 0, thumbs_pending: 0 };
    let mut stmt = db.prepare_cached("SELECT kind, COUNT(*) FROM media GROUP BY kind")?;
    let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))?;
    for row in rows {
        let (kind, count) = row?;
        let count = count as u64;
        stats.total += count;
        match kind.as_str() {
            "image" => stats.images = count,
            "video" => stats.videos = count,
            "audio" => stats.audio = count,
            "document" => stats.documents = count,
            _ => {}
        }
    }
    let count = |sql: &str| db.query_row(sql, [], |r| r.get::<_, i64>(0)).map(|n| n as u64);
    stats.tags = count("SELECT COUNT(*) FROM tags")?;
    stats.thumbs_pending = count("SELECT COUNT(*) FROM media WHERE thumb_status = 0")?;
    Ok(stats)
}

// --- Commandes appelées par l'interface (hors du fil principal : `async`) ---

#[tauri::command]
pub async fn list_media(state: State<'_, AppState>, query: ListQuery) -> Result<ListPage, String> {
    let db = state.db.lock().unwrap();
    list(&db, &query).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn library_stats(state: State<'_, AppState>) -> Result<Stats, String> {
    let db = state.db.lock().unwrap();
    stats(&db).map_err(|e| e.to_string())
}

/// Miniatures de la page affichée en premier.
#[tauri::command]
pub async fn prioritize_thumbs(state: State<'_, AppState>, ids: Vec<i64>) -> Result<(), String> {
    state.thumbs.prioritize(&ids).map_err(|e| e.to_string())
}

/// Grands aperçus (LIB-09) : `want` = vignettes visibles depuis ~150 ms, `cancel` = sorties de l'écran.
#[tauri::command]
pub async fn request_previews(state: State<'_, AppState>, want: Vec<i64>, cancel: Vec<i64>) -> Result<(), String> {
    state.previews.request(&want, &cancel).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ffmpeg_status(state: State<'_, AppState>) -> Result<FfmpegStatus, String> {
    Ok(FfmpegStatus::from(state.thumbs.ffmpeg()))
}
