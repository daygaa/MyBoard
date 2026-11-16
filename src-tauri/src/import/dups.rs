//! Doublons trouvés pendant l'import, dans le bilan (IMP-91, reprend DUP-05 ; réponses Q36 à Q39 du 15/11) : un groupe
//! par média de la bibliothèque, avec son fichier et les copies au même contenu que l'import a écartées (aussi un
//! fichier présent deux fois dans l'import : le premier traité est devenu le média). « Supprimer les doublons » efface
//! définitivement les fichiers cochés (sans la Corbeille, comme DEL-04, Q37 A) ; au moins un fichier reste par groupe.
//! Le fichier du média coché : le média passe sur une copie gardée (seul son chemin change ; même contenu, donc même
//! empreinte et mêmes miniatures).
//!
//! 2e tour (retours du 16/11, réponses Q43 A, Q44 A) : une version faite par MyBoard (compressée ou convertie, aussi
//! celle d'une paire) se coche aussi ; une icône dit laquelle. Cochée, avec un original gardé : le média passe sur
//! l'original (il devient son fichier, non compressé ; tags, dossiers, favori, note gardés ; miniature, dimensions et
//! durée refaites) et MyBoard oublie que c'était une version (`original_hash` vidé ; la table des versions garde la
//! trace, pour reconnaître la version si elle revient). Avant, l'empreinte du fichier gardé est vérifiée.

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
    /// Peut être coché (toujours, depuis la réponse Q43 A ; le groupe garde au moins un fichier).
    pub deletable: bool,
    /// Fichier du média, version faite par MyBoard : « compressed » ou « converted » (icône, Q44 A).
    pub version: Option<&'static str>,
    /// Version convertie : extension de l'original (bulle « PNG → WebP »), si un original est dans le groupe.
    pub converted_from: Option<String>,
    /// Copie d'une version qui en est l'original (contenu différent de la version, pas une copie de celle-ci).
    #[serde(skip)]
    original: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DupGroup {
    pub media: i64,
    pub files: Vec<DupFile>,
}

fn line(path: &str, size: u64, ext: &str, in_library: bool) -> DupFile {
    DupFile {
        path: path.to_owned(),
        name: file_name_of(path),
        size,
        ext: ext.to_owned(),
        kind: formats::kind_of_ext(ext).map_or("document", |k| k.as_str()),
        in_library,
        deletable: true,
        version: None,
        converted_from: None,
        original: false,
    }
}

/// Même format malgré l'extension (jpg = jpeg = jpe = jfif, tif = tiff).
fn family(ext: &str) -> String {
    match ext.to_lowercase().as_str() {
        "jpeg" | "jpe" | "jfif" => "jpg".into(),
        "tiff" => "tif".into(),
        e => e.into(),
    }
}

/// Nom d'une version compressée par MyBoard : « photo_c.jpg », « photo_c (1).webp ».
fn compressed_name(path: &str) -> bool {
    let stem = Path::new(path).file_stem().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    let stem = match stem.rfind(" (") {
        Some(i) if stem.ends_with(')') && stem[i + 2..stem.len() - 1].chars().all(|c| c.is_ascii_digit()) => &stem[..i],
        _ => stem.as_str(),
    };
    stem.ends_with("_c")
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
    let mut read = conn.prepare("SELECT path, size, ext, original_hash IS NOT NULL FROM media WHERE id = ?1")?;
    let mut groups = Vec::new();
    for media in order {
        let Some((path, size, ext, version)) =
            read.query_row([media], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?, r.get::<_, String>(2)?, r.get::<_, bool>(3)?))).optional()?
        else {
            continue; // média retiré entre-temps
        };
        let size = size.max(0) as u64;
        let mut files = vec![line(&path, size, &ext, true)];
        let mut seen: HashSet<String> = HashSet::from([path.to_lowercase()]);
        for file in &copies[&media] {
            let p = file.path.display().to_string();
            if seen.insert(p.to_lowercase()) {
                let mut copy = line(&p, file.size, &file.ext, false);
                // Une copie de la version a ses octets, donc son poids et son format ; sinon c'est l'original.
                copy.original = version && !(file.size == size && family(&file.ext) == family(&ext));
                files.push(copy);
            }
        }
        if version {
            // Format de l'original comparé à celui de la version ; sans original dans le groupe, le nom le dit.
            let from = files.iter().find(|f| f.original).map(|f| f.ext.clone());
            let converted = match &from {
                Some(o) => family(o) != family(&ext),
                None => !compressed_name(&path),
            };
            files[0].version = Some(if converted { "converted" } else { "compressed" });
            files[0].converted_from = from.filter(|_| converted);
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
    let mut failed = Vec::new();
    // Médias dont le fichier est coché : où ils vont (avant la transaction : une vidéo peut être longue à relire).
    let mut plans: Vec<(&DupGroup, Vec<&DupFile>, Option<Move>)> = Vec::new();
    for group in &groups {
        let (gone, kept): (Vec<&DupFile>, Vec<&DupFile>) = group.files.iter().partition(|f| f.deletable && chosen.contains(f.path.as_str()));
        if gone.is_empty() || kept.is_empty() {
            continue; // rien de coché, ou tout coché (l'interface l'empêche) : groupe laissé tel quel
        }
        let mut plan = None;
        if let Some(library) = gone.iter().find(|f| f.in_library) {
            match plan_move(&conn, group.media, &kept) {
                Ok(Some(m)) => plan = Some(m),
                Ok(None) => continue, // média retiré entre-temps : rien n'est effacé dans ce groupe
                Err(message) => {
                    failed.push(FileError { path: library.path.clone(), message });
                    continue;
                }
            }
        }
        plans.push((group, gone, plan));
    }
    // Puis tout en une transaction.
    let mut erase: Vec<String> = Vec::new();
    let mut moved: HashMap<i64, (String, bool)> = HashMap::new();
    let tx = conn.transaction()?;
    for (group, gone, plan) in plans {
        if let Some(m) = plan {
            let target = m.target;
            let meta = std::fs::metadata(&target.path).ok();
            let modified = meta.as_ref().and_then(|m| m.modified().ok()).map(super::index::to_ms);
            let file_name = file_name_of(&target.path);
            let key = db::name_key::name_key(&file_name);
            let changed = match &m.original {
                // Même contenu : seul le chemin change (empreinte et miniatures gardées).
                None => tx.execute(
                    "UPDATE media SET path = ?1, file_name = ?2, name_key = ?3, ext = ?4, file_modified_at = ?5, missing_since = NULL
                     WHERE id = ?6 AND hash = ?7",
                    params![target.path, file_name, key, target.ext, modified, group.media, m.hash],
                ),
                // La version devient l'original (Q43 A) : miniature, dimensions et durée refaites par le service des
                // miniatures.
                Some(original) => tx.execute(
                    "UPDATE media SET path = ?1, file_name = ?2, name_key = ?3, ext = ?4, size = ?5, file_created_at = ?6,
                         file_modified_at = ?7, hash = ?8, original_hash = NULL, thumb_status = 0, missing_since = NULL
                     WHERE id = ?9 AND hash = ?10",
                    params![
                        target.path,
                        file_name,
                        key,
                        target.ext,
                        target.size as i64,
                        meta.as_ref().and_then(|m| m.created().ok()).map(super::index::to_ms),
                        modified,
                        original,
                        group.media,
                        m.hash
                    ],
                ),
            };
            match changed {
                Ok(1) => {
                    moved.insert(group.media, (target.path.clone(), m.original.is_some()));
                }
                Ok(_) => continue, // média changé entre-temps : rien n'est effacé dans ce groupe
                Err(e) => {
                    failed.push(FileError { path: target.path.clone(), message: format!("la fiche n'a pas pu passer sur ce fichier ({e})") });
                    continue;
                }
            }
        }
        erase.extend(gone.iter().map(|f| f.path.clone()));
    }
    tx.commit()?;

    // Jamais un fichier qu'un média utilise encore (comme `tally::delete_files`).
    let mut used = conn.prepare("SELECT 1 FROM media WHERE path = ?1")?;
    let mut deleted: HashSet<String> = HashSet::new();
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
            let (version, from) = group.files.iter().find(|f| f.in_library).map_or((None, None), |f| (f.version, f.converted_from.clone()));
            group.files.retain(|f| !deleted.contains(&f.path));
            if let Some((path, became_original)) = moved.get(&group.media) {
                for f in &mut group.files {
                    f.in_library = &f.path == path;
                    // Devenue l'original : ce n'est plus une version ; sinon, la copie gardée l'est toujours.
                    (f.version, f.converted_from) = if f.in_library && !became_original { (version, from.clone()) } else { (None, None) };
                    if *became_original {
                        f.original = false;
                    }
                }
            }
        }
        result.duplicate_groups.retain(|g| g.files.len() > 1);
    });
    if !moved.is_empty() {
        crate::library_check::watch_roots(moved.values().map(|(p, _)| Path::new(p)));
        if moved.values().any(|(_, original)| *original) {
            state.thumbs.wake();
        }
        let _ = app.emit("library-changed", ());
    }
    Ok(DeleteReport { deleted: deleted.len() as u64, failed })
}

/// Où va un média dont le fichier est coché.
struct Move<'a> {
    target: &'a DupFile,
    /// Empreinte actuelle du média (la fiche n'est changée que si elle n'a pas bougé entre-temps).
    hash: String,
    /// Version qui devient l'original : son empreinte.
    original: Option<String>,
}

/// Fichier gardé sur lequel passe le média : le premier du groupe ; pour une version faite par MyBoard, le premier
/// original gardé (Q43 A), dont l'empreinte est vérifiée (contenu changé depuis l'import : rien n'est fait).
fn plan_move<'a>(conn: &Connection, media: i64, kept: &[&'a DupFile]) -> Result<Option<Move<'a>>, String> {
    let row: Option<(String, Option<String>)> = conn
        .query_row("SELECT hash, original_hash FROM media WHERE id = ?1", [media], |r| Ok((r.get(0)?, r.get(1)?)))
        .optional()
        .map_err(|e| e.to_string())?;
    let Some((hash, original)) = row else { return Ok(None) };
    let Some(original) = original else { return Ok(Some(Move { target: kept[0], hash, original: None })) };
    let target = kept.iter().copied().find(|f| f.original).unwrap_or(kept[0]);
    let read = super::versions::hash_file(Path::new(&target.path))
        .map_err(|e| format!("lecture de « {} » impossible : {}", target.name, windows_message(&e)))?;
    if read == original {
        Ok(Some(Move { target, hash, original: Some(original) }))
    } else if read == hash {
        Ok(Some(Move { target, hash, original: None }))
    } else {
        Err(format!("« {} » a changé depuis l'import : rien n'est supprimé dans ce groupe", target.name))
    }
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
