//! Doublons trouvés pendant l'import, dans le bilan (IMP-91, reprend DUP-05 ; réponses Q36 à Q39 du 15/11) : un groupe
//! par média de la bibliothèque, avec son fichier et les copies au même contenu que l'import a écartées (aussi un
//! fichier présent deux fois dans l'import : le premier traité est devenu le média). « Supprimer les doublons » efface
//! définitivement les fichiers cochés (sans la Corbeille, comme DEL-04, Q37 A) ; au moins un fichier reste par groupe.
//! Le fichier du média coché : le média passe sur une copie gardée (seul son chemin change ; même contenu, donc même
//! empreinte et mêmes miniatures), sauf une version faite par MyBoard ou celle d'une paire, toujours gardée (Q36 A).

use std::collections::{HashMap, HashSet};
use std::path::Path;

use rusqlite::{Connection, OptionalExtension, params};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use super::index::file_name_of;
use super::scan::ScanFile;
use super::{FileError, Phase};
use crate::{AppState, db, formats};

/// Une ligne d'un groupe.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DupFile {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub ext: String,
    pub kind: &'static str,
    /// Fichier du média de la bibliothèque (icône au bout du nom).
    pub in_library: bool,
    /// Peut être coché (pas une version faite par MyBoard ni celle d'une paire).
    pub deletable: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DupGroup {
    pub media: i64,
    pub files: Vec<DupFile>,
}

fn line(path: &str, size: u64, ext: &str, in_library: bool, deletable: bool) -> DupFile {
    DupFile {
        path: path.to_owned(),
        name: file_name_of(path),
        size,
        ext: ext.to_owned(),
        kind: formats::kind_of_ext(ext).map_or("document", |k| k.as_str()),
        in_library,
        deletable,
    }
}

/// Groupes de l'import qui se termine, dans l'ordre où leurs doublons ont été trouvés. `found` : chaque doublon et le
/// média dont il a le contenu.
pub fn groups(conn: &Connection, found: &[(ScanFile, i64)]) -> rusqlite::Result<Vec<DupGroup>> {
    let mut order: Vec<i64> = Vec::new();
    let mut copies: HashMap<i64, Vec<&ScanFile>> = HashMap::new();
    for (file, media) in found {
        copies.entry(*media).or_insert_with(|| {
            order.push(*media);
            Vec::new()
        });
        copies.get_mut(media).unwrap().push(file);
    }
    let mut read = conn.prepare("SELECT path, size, ext, original_hash IS NULL FROM media WHERE id = ?1")?;
    let mut groups = Vec::new();
    for media in order {
        let Some((path, size, ext, plain)) =
            read.query_row([media], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?, r.get::<_, String>(2)?, r.get::<_, bool>(3)?))).optional()?
        else {
            continue; // média retiré entre-temps
        };
        let mut files = vec![line(&path, size.max(0) as u64, &ext, true, plain)];
        let mut seen: HashSet<String> = HashSet::from([path.to_lowercase()]);
        for file in &copies[&media] {
            let p = file.path.display().to_string();
            if seen.insert(p.to_lowercase()) {
                files.push(line(&p, file.size, &file.ext, false, true));
            }
        }
        if files.len() > 1 {
            groups.push(DupGroup { media, files });
        }
    }
    Ok(groups)
}

impl super::ImportManager {
    /// Ce chemin est une ligne des doublons du bilan (aperçu, Explorateur, application par défaut).
    pub(super) fn is_duplicate_line(inner: &super::Inner, path: &str) -> bool {
        inner.snapshot.result.as_ref().is_some_and(|r| r.duplicate_groups.iter().flat_map(|g| &g.files).any(|f| f.path == path))
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteReport {
    pub deleted: u64,
    /// Fichiers qu'on n'a pas pu effacer : ils restent dans leur groupe.
    pub failed: Vec<FileError>,
}

/// « Supprimer les doublons » (confirmé dans l'interface, Q38 A) : efface les fichiers cochés, retire les groupes réduits
/// à un seul fichier.
#[tauri::command]
pub async fn delete_import_duplicates(app: AppHandle, paths: Vec<String>) -> Result<DeleteReport, String> {
    let work = tauri::async_runtime::spawn_blocking(move || delete(&app, &paths));
    work.await.map_err(|e| e.to_string())?.map_err(|e| format!("{e:#}"))
}

fn delete(app: &AppHandle, paths: &[String]) -> anyhow::Result<DeleteReport> {
    let state = app.state::<AppState>();
    let manager = &state.import;
    let groups = {
        let inner = manager.inner.lock().unwrap();
        match (&inner.snapshot.phase, &inner.snapshot.result) {
            (Phase::Finished, Some(r)) => r.duplicate_groups.clone(),
            _ => anyhow::bail!("Le bilan de l'import n'est plus ouvert."),
        }
    };
    let chosen: HashSet<&str> = paths.iter().map(String::as_str).collect();
    let mut conn = db::open(&state.paths.db)?;
    // Médias dont le fichier est coché : ils passent d'abord sur le premier fichier gardé du groupe (une transaction).
    let mut erase: Vec<String> = Vec::new();
    let mut moved: HashMap<i64, String> = HashMap::new();
    let tx = conn.transaction()?;
    for group in &groups {
        let (gone, kept): (Vec<&DupFile>, Vec<&DupFile>) = group.files.iter().partition(|f| f.deletable && chosen.contains(f.path.as_str()));
        if gone.is_empty() || kept.is_empty() {
            continue; // rien de coché, ou tout coché (l'interface l'empêche) : groupe laissé tel quel
        }
        if gone.iter().any(|f| f.in_library) {
            let target = kept[0];
            let file_name = file_name_of(&target.path);
            let modified = std::fs::metadata(&target.path).ok().and_then(|m| m.modified().ok()).map(super::index::to_ms);
            let changed = tx.execute(
                "UPDATE media SET path = ?1, file_name = ?2, name_key = ?3, ext = ?4, file_modified_at = ?5, missing_since = NULL
                 WHERE id = ?6 AND original_hash IS NULL",
                params![target.path, file_name, db::name_key::name_key(&file_name), target.ext, modified, group.media],
            )?;
            if changed == 0 {
                continue; // devenu une version entre-temps : rien n'est effacé dans ce groupe
            }
            moved.insert(group.media, target.path.clone());
        }
        erase.extend(gone.iter().map(|f| f.path.clone()));
    }
    tx.commit()?;

    // Jamais un fichier qu'un média utilise encore (comme `tally::delete_files`).
    let mut used = conn.prepare("SELECT 1 FROM media WHERE path = ?1")?;
    let mut deleted: HashSet<String> = HashSet::new();
    let mut failed = Vec::new();
    for path in erase {
        if used.exists([&path]).unwrap_or(true) {
            continue;
        }
        match std::fs::remove_file(&path) {
            Ok(()) => {
                deleted.insert(path);
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                deleted.insert(path); // déjà effacé ailleurs : la ligne n'a plus de raison d'être
            }
            Err(e) => failed.push(FileError { path, message: windows_message(&e) }),
        }
    }
    drop(used);

    manager.update(false, |inner| {
        let Some(result) = inner.snapshot.result.as_mut() else { return };
        for group in &mut result.duplicate_groups {
            group.files.retain(|f| !deleted.contains(&f.path));
            if let Some(path) = moved.get(&group.media) {
                for f in &mut group.files {
                    f.in_library = &f.path == path;
                }
            }
        }
        result.duplicate_groups.retain(|g| g.files.len() > 1);
    });
    if !moved.is_empty() {
        crate::library_check::watch_roots(moved.values().map(Path::new));
        let _ = app.emit("library-changed", ());
    }
    Ok(DeleteReport { deleted: deleted.len() as u64, failed })
}

/// « Accès refusé. (code 5) » : le texte de Windows, son code à part (comme DEL-04).
fn windows_message(e: &std::io::Error) -> String {
    let text = e.to_string();
    let message = text.split(" (os error").next().unwrap_or(&text).trim().to_string();
    match e.raw_os_error() {
        Some(code) => format!("{message} (code {code})"),
        None => message,
    }
}

/// Chemin d'une ligne des doublons du bilan, refusé sinon (seuls ces fichiers peuvent être ouverts d'ici).
fn known(state: &AppState, path: &str) -> Result<(), String> {
    let inner = state.import.inner.lock().unwrap();
    if super::ImportManager::is_duplicate_line(&inner, path) { Ok(()) } else { Err("Ce fichier ne fait pas partie du bilan.".into()) }
}

/// Ouvre une ligne des doublons avec l'application par défaut de Windows (comme un double-clic dans l'Explorateur).
#[tauri::command]
pub async fn open_import_file(state: State<'_, AppState>, path: String) -> Result<(), String> {
    known(&state, &path)?;
    opener::open(&path).map_err(|e| e.to_string())
}
