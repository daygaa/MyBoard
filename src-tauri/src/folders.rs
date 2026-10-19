//! Dossiers manuels (FOLD-01 à FOLD-04, FOLD-07, FOLD-09) : indépendants des tags, un média peut
//! être dans plusieurs dossiers. Le nombre de médias de chaque dossier est tenu par la base
//! (déclencheurs, D-005) ; supprimer un dossier ne supprime aucun média. Nom unique sans tenir compte
//! des majuscules ; un nom déjà pris est refusé avec un nom libre proposé (« nom-2 », « nom-3 »…).

use rusqlite::{Connection, OptionalExtension, params};
use serde::Serialize;
use tauri::State;

use crate::{AppState, db};

/// Couleurs prédéfinies (FOLD-07), attribuées à tour de rôle à la création. Pas de bleu vif ni
/// d'indigo (GEN-03).
pub const PALETTE: [&str; 8] = ["#d9a94e", "#4ade80", "#5eead4", "#f9a8d4", "#c4b5fd", "#fb923c", "#f87171", "#a1a1aa"];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: i64,
    pub name: String,
    pub color: String,
    /// Masqué (FOLD-02) : absent des listes, ses médias restent visibles partout.
    pub hidden: bool,
    pub media_count: i64,
}

/// Nom refusé : vide, ou déjà pris (avec le nom libre proposé).
#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum NameError {
    Empty,
    Taken { suggestion: String },
    Failed { message: String },
}

impl From<rusqlite::Error> for NameError {
    fn from(e: rusqlite::Error) -> Self {
        NameError::Failed { message: e.to_string() }
    }
}

fn folder_from_row(r: &rusqlite::Row) -> rusqlite::Result<Folder> {
    Ok(Folder {
        id: r.get(0)?,
        name: r.get(1)?,
        color: r.get::<_, Option<String>>(2)?.unwrap_or_else(|| PALETTE[0].to_string()),
        hidden: r.get(3)?,
        media_count: r.get(4)?,
    })
}

/// Nom déjà utilisé par un autre dossier ? (comparaison sans les majuscules : colonne NOCASE)
fn taken(db: &Connection, name: &str, except: Option<i64>) -> rusqlite::Result<bool> {
    db.prepare_cached("SELECT EXISTS (SELECT 1 FROM folders WHERE name = ?1 AND id != ?2)")?
        .query_row(params![name, except.unwrap_or(-1)], |r| r.get(0))
}

/// Nom sans son suffixe « -nombre » : « abc-3 » → « abc » (FOLD-12).
fn base_name(name: &str) -> &str {
    match name.rsplit_once('-') {
        Some((base, n)) if !base.is_empty() && !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()) => base,
        _ => name,
    }
}

/// Nom proposé à la place d'un nom pris : premier « base-2 », « base-3 »… libre, en partant du nom
/// sans son suffixe (« abc-3 » pris → « abc-5 » si « abc-2 » à « abc-4 » existent, FOLD-12).
fn free_name(db: &Connection, name: &str, except: Option<i64>) -> rusqlite::Result<String> {
    let base = base_name(name);
    for n in 2.. {
        let candidate = format!("{base}-{n}");
        if !taken(db, &candidate, except)? {
            return Ok(candidate);
        }
    }
    unreachable!()
}

/// Nom nettoyé (espaces autour retirés), vide ou pris : refusé.
fn checked_name(db: &Connection, raw: &str, except: Option<i64>) -> Result<String, NameError> {
    let name = raw.trim();
    if name.is_empty() {
        return Err(NameError::Empty);
    }
    if taken(db, name, except)? {
        return Err(NameError::Taken { suggestion: free_name(db, name, except)? });
    }
    Ok(name.to_string())
}

fn add_media(tx: &Connection, folder_id: i64, media_ids: &[i64], now: i64) -> rusqlite::Result<()> {
    let mut stmt = tx.prepare_cached("INSERT OR IGNORE INTO folder_media (folder_id, media_id, added_at) VALUES (?1, ?2, ?3)")?;
    for id in media_ids {
        stmt.execute(params![folder_id, id, now])?;
    }
    Ok(())
}

// --- Commandes appelées par l'interface ---

/// Tous les dossiers, par ordre alphabétique (FOLD-01), masqués compris.
#[tauri::command]
pub async fn list_folders(state: State<'_, AppState>) -> Result<Vec<Folder>, String> {
    let db = state.db.lock().unwrap();
    let mut stmt = db
        .prepare_cached("SELECT id, name, color, hidden, media_count FROM folders ORDER BY name COLLATE NOCASE")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], folder_from_row).map_err(|e| e.to_string())?;
    rows.collect::<Result<_, _>>().map_err(|e| e.to_string())
}

/// Crée un dossier (couleur suivante de la palette) et y range `media_ids` (« Créer un dossier » des
/// listes, FOLD-09), en une transaction.
#[tauri::command]
pub async fn create_folder(state: State<'_, AppState>, name: String, media_ids: Vec<i64>) -> Result<Folder, NameError> {
    let mut conn = state.db.lock().unwrap();
    let name = checked_name(&conn, &name, None)?;
    let tx = conn.transaction()?;
    let count: i64 = tx.query_row("SELECT COUNT(*) FROM folders", [], |r| r.get(0))?;
    let color = PALETTE[(count as usize) % PALETTE.len()];
    let now = db::now_ms();
    tx.execute("INSERT INTO folders (name, color, created_at) VALUES (?1, ?2, ?3)", params![name, color, now])?;
    let id = tx.last_insert_rowid();
    add_media(&tx, id, &media_ids, now)?;
    let folder = tx.query_row("SELECT id, name, color, hidden, media_count FROM folders WHERE id = ?1", [id], folder_from_row)?;
    tx.commit()?;
    Ok(folder)
}

#[tauri::command]
pub async fn rename_folder(state: State<'_, AppState>, id: i64, name: String) -> Result<(), NameError> {
    let db = state.db.lock().unwrap();
    let name = checked_name(&db, &name, Some(id))?;
    db.execute("UPDATE folders SET name = ?1 WHERE id = ?2", params![name, id])?;
    Ok(())
}

/// Masquer / ne plus masquer (FOLD-02).
#[tauri::command]
pub async fn set_folder_hidden(state: State<'_, AppState>, id: i64, hidden: bool) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    db.execute("UPDATE folders SET hidden = ?1 WHERE id = ?2", params![hidden, id]).map(|_| ()).map_err(|e| e.to_string())
}

/// Couleur choisie parmi les couleurs prédéfinies (FOLD-07).
#[tauri::command]
pub async fn set_folder_color(state: State<'_, AppState>, id: i64, color: String) -> Result<(), String> {
    if !PALETTE.contains(&color.as_str()) {
        return Err("Couleur inconnue.".into());
    }
    let db = state.db.lock().unwrap();
    db.execute("UPDATE folders SET color = ?1 WHERE id = ?2", params![color, id]).map(|_| ()).map_err(|e| e.to_string())
}

/// Supprime le dossier ; ses médias restent dans la bibliothèque (FOLD-02).
#[tauri::command]
pub async fn delete_folder(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let db = state.db.lock().unwrap();
    db.execute("DELETE FROM folders WHERE id = ?1", [id]).map(|_| ()).map_err(|e| e.to_string())
}

/// Ajoute (`on`) ou retire des médias d'un dossier (FOLD-03, FOLD-09), en une transaction.
#[tauri::command]
pub async fn set_folder_media(state: State<'_, AppState>, folder_id: i64, media_ids: Vec<i64>, on: bool) -> Result<(), String> {
    let mut conn = state.db.lock().unwrap();
    (|| -> rusqlite::Result<()> {
        let tx = conn.transaction()?;
        let exists: Option<i64> = tx.query_row("SELECT id FROM folders WHERE id = ?1", [folder_id], |r| r.get(0)).optional()?;
        if exists.is_some() {
            if on {
                add_media(&tx, folder_id, &media_ids, db::now_ms())?;
            } else {
                let mut stmt = tx.prepare_cached("DELETE FROM folder_media WHERE folder_id = ?1 AND media_id = ?2")?;
                for id in &media_ids {
                    stmt.execute(params![folder_id, id])?;
                }
            }
        }
        tx.commit()
    })()
    .map_err(|e| e.to_string())
}
