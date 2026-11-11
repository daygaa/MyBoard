//! Originaux ET versions écrites par MyBoard (IMP-64, IMP-68) : sans cette pop-in, un réimport ajouterait les deux.
//! Une paire, dans le même dossier, du même type (image ou vidéo, réponse Q5 du 10/11) :
//! - « photo.jpg » et « photo_c.jpg » (ou « photo_c (1).webp »…) : une image est reconnue par le nom et ses dimensions
//!   (réponse Q9b du 10/11 ; dimensions égales ou inversées : photo tournée par l'EXIF puis convertie) ; les numéros
//!   d'un original sont gardés : « photo (1).jpg » va avec « photo (1)_c.jpg » ;
//! - conversion seule, « photo.jpg » et « photo.webp », ou « photo (1).webp » si le nom était pris (IMP-65, 11/11) : rien
//!   dans le nom ne dit lequel est l'original, la paire doit être confirmée par la table des versions (schéma 20) ;
//! - une vidéo est toujours confirmée par la table (toutes les versions vidéo y sont notées, depuis le lot 5).
//!
//! Seuls ces candidats sont relus en entier. L'original est dans la liste ou déjà dans la bibliothèque (IMP-68) ; la
//! version n'est jamais dans la bibliothèque (sinon son original compte déjà comme doublon, D-061).

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use rusqlite::{Connection, OptionalExtension, params};
use serde::Serialize;

use anyhow::Context;

use super::index::{Indexer, Outcome};
use super::scan::ScanFile;
use super::versions;
use crate::formats::Kind;

pub struct Pair {
    pub original: PathBuf,
    pub version: PathBuf,
    pub kind: Kind,
    /// Original déjà dans la bibliothèque (IMP-68) : son média et son empreinte.
    pub in_library: Option<(i64, String)>,
}

/// Original possible d'une version.
struct Candidate {
    path: PathBuf,
    media: Option<(i64, String)>,
}

/// « photo_c » ou « photo_c (2) » → « photo ».
fn base_of(stem: &str) -> Option<&str> {
    let stem = number_off(stem).unwrap_or(stem);
    let cut = stem.len().checked_sub(2)?;
    (cut > 0 && stem.get(cut..).is_some_and(|end| end.eq_ignore_ascii_case("_c"))).then(|| &stem[..cut])
}

/// « photo (1) » → « photo ».
fn number_off(stem: &str) -> Option<&str> {
    match stem.strip_suffix(')').and_then(|s| s.rsplit_once(" (")) {
        Some((head, n)) if !head.is_empty() && !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()) => Some(head),
        _ => None,
    }
}

fn stem_of(path: &Path) -> String {
    path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default()
}

fn lower(path: &Path) -> String {
    path.to_string_lossy().to_lowercase()
}

/// Mêmes dimensions, ou inversées (lues dans l'en-tête, sans décoder l'image).
fn same_size(path: &Path, (w, h): (usize, usize)) -> bool {
    imagesize::size(path).is_ok_and(|s| (s.width, s.height) == (w, h) || (s.height, s.width) == (w, h))
}

fn media_at(conn: &Connection, path: &Path) -> rusqlite::Result<Option<(i64, String)>> {
    conn.prepare_cached("SELECT id, hash FROM media WHERE path = ?1")?
        .query_row([path.to_string_lossy()], |r| Ok((r.get(0)?, r.get(1)?)))
        .optional()
}

/// Médias de ce type nommés `name` (sans extension) dans ce dossier : une recherche par l'index des chemins
/// (de « dossier\nom. » à « dossier\nom/ », sans tenir compte des majuscules comme la colonne). Le type est vérifié
/// ici, pas dans la requête : avec « kind = 'image' », SQLite prenait l'index des types et parcourait toutes les images
/// à chaque fichier (mesuré le 10/11 : 1,3 s pour 3 300 fichiers, contre 18 ms par l'index des chemins).
fn media_named(conn: &Connection, dir: &Path, name: &str, kind: Kind) -> rusqlite::Result<Vec<Candidate>> {
    let prefix = format!("{}\\{name}", dir.to_string_lossy().trim_end_matches('\\'));
    let mut stmt = conn.prepare_cached("SELECT path, id, hash, kind FROM media WHERE path >= ?1 AND path < ?2")?;
    let rows = stmt.query_map(params![format!("{prefix}."), format!("{prefix}/")], |r| {
        Ok((Candidate { path: PathBuf::from(r.get::<_, String>(0)?), media: Some((r.get(1)?, r.get(2)?)) }, r.get::<_, String>(3)?))
    })?;
    let name = name.to_lowercase();
    let mut found = Vec::new();
    for row in rows {
        let (candidate, found_kind) = row?;
        if found_kind == kind.as_str() && stem_of(&candidate.path).to_lowercase() == name {
            found.push(candidate);
        }
    }
    Ok(found)
}

struct Finder<'a> {
    conn: &'a Connection,
    /// (dossier, nom sans extension) en minuscules → images et vidéos de la liste.
    by_name: HashMap<(String, String), Vec<&'a ScanFile>>,
    /// Empreintes déjà lues (un fichier n'est relu qu'une fois).
    hashes: HashMap<PathBuf, Option<String>>,
}

impl Finder<'_> {
    /// Médias du type de `version` nommés `name` dans son dossier : de la liste, puis de la bibliothèque.
    fn candidates(&self, version: &ScanFile, name: &str) -> rusqlite::Result<Vec<Candidate>> {
        let dir = version.path.parent().unwrap_or(Path::new(""));
        let mut found = Vec::new();
        let mut seen = HashSet::from([lower(&version.path)]);
        for file in self.by_name.get(&(lower(dir), name.to_lowercase())).into_iter().flatten() {
            if file.kind == version.kind && seen.insert(lower(&file.path)) {
                found.push(Candidate { path: file.path.clone(), media: media_at(self.conn, &file.path)? });
            }
        }
        for candidate in media_named(self.conn, dir, name, version.kind)? {
            if seen.insert(lower(&candidate.path)) {
                found.push(candidate);
            }
        }
        Ok(found)
    }

    /// Empreinte du contenu : celle de la bibliothèque si le fichier y est, sinon relu en entier (par blocs : une vidéo
    /// peut peser plusieurs Go).
    fn hash(&mut self, path: &Path, media: Option<&(i64, String)>) -> Option<String> {
        if let Some((_, hash)) = media {
            return Some(hash.clone());
        }
        self.hashes
            .entry(path.to_path_buf())
            .or_insert_with(|| versions::hash_file(path).ok())
            .clone()
    }
}

pub fn find(files: &[ScanFile], conn: &Connection) -> rusqlite::Result<Vec<Pair>> {
    let media: Vec<&ScanFile> = files.iter().filter(|f| matches!(f.kind, Kind::Image | Kind::Video)).collect();
    let mut by_name: HashMap<(String, String), Vec<&ScanFile>> = HashMap::new();
    for f in &media {
        let dir = f.path.parent().map(lower).unwrap_or_default();
        by_name.entry((dir, stem_of(&f.path).to_lowercase())).or_default().push(f);
    }
    let mut finder = Finder { conn, by_name, hashes: HashMap::new() };
    // Un original ne va qu'avec une seule version.
    let mut used = HashSet::new();
    let mut pairs = Vec::new();
    for version in &media {
        let stem = stem_of(&version.path);
        let image = version.kind == Kind::Image;
        // Noms possibles de l'original, et s'il faut la table pour confirmer.
        let mut names = Vec::new();
        if let Some(base) = base_of(&stem) {
            names.push((base.to_owned(), !image));
        }
        names.push((stem.clone(), true));
        if let Some(head) = number_off(&stem) {
            names.push((head.to_owned(), true));
        }
        // D'abord les noms (en mémoire et par l'index) : un fichier n'est ouvert que s'il a un original possible.
        let mut checked = false;
        let mut size = None;
        let mut found = None;
        for (name, confirm) in names {
            let mut candidates = finder.candidates(version, &name)?;
            if candidates.is_empty() {
                continue;
            }
            if !checked {
                if media_at(conn, &version.path)?.is_some() {
                    break;
                }
                checked = true;
            }
            if image {
                let Some(dims) = size.or_else(|| imagesize::size(&version.path).ok().map(|s| (s.width, s.height))) else { break };
                size = Some(dims);
                candidates.retain(|c| same_size(&c.path, dims));
            }
            if !confirm {
                found = candidates.into_iter().next();
            } else if !candidates.is_empty()
                && let Some(hash) = finder.hash(&version.path, None)
                && let Some(original) = versions::original_of(conn, &hash)?
            {
                found = candidates.into_iter().find(|c| finder.hash(&c.path, c.media.as_ref()).as_deref() == Some(original.as_str()));
            }
            if found.is_some() {
                break;
            }
        }
        if let Some(c) = found
            && used.insert(lower(&c.path))
        {
            pairs.push(Pair { original: c.path, version: version.path.clone(), kind: version.kind, in_library: c.media });
        }
    }
    Ok(pairs)
}

impl Indexer {
    /// « Supprimer les originaux », original dans la bibliothèque (IMP-68) : la version (jamais retraitée) prend sa place
    /// sur la même fiche, comme IMP-60, et retient l'empreinte de l'original (son réimport compte comme doublon).
    pub fn take_place(&mut self, conn: &Connection, file: &ScanFile, id: i64, original_hash: &str) -> anyhow::Result<Outcome> {
        self.squeeze = None;
        self.replaced = None;
        let meta = std::fs::metadata(&file.path)?;
        let hash = self.hash(&file.path)?;
        if let Some(other) = super::index::find_hash(conn, &hash)? {
            return Ok(Outcome::Duplicate(other));
        }
        let path = file.path.to_str().context("nom de fichier illisible")?;
        let file_name = super::index::file_name_of(path);
        conn.execute(
            "UPDATE media SET path = ?1, file_name = ?2, name_key = ?3, hash = ?4, original_hash = ?5, size = ?6, ext = ?7,
                 file_created_at = ?8, file_modified_at = ?9, thumb_status = 0
             WHERE id = ?10",
            params![
                path,
                file_name,
                crate::db::name_key::name_key(&file_name),
                hash,
                original_hash,
                meta.len() as i64,
                file.ext,
                meta.created().ok().map(super::index::to_ms),
                meta.modified().ok().map(super::index::to_ms),
                id
            ],
        )?;
        super::versions::remember(conn, &hash, original_hash)?;
        Ok(Outcome::Updated(id))
    }

}

/// Paires de la liste en cours : la pop-in d'IMP-64 ne s'ouvre que s'il y en a ; son texte dit combien d'originaux
/// sont déjà dans la bibliothèque (IMP-68) et s'accorde selon le type (images, vidéos ou médias).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairCount {
    pub total: usize,
    pub in_library: usize,
    pub images: usize,
    pub videos: usize,
}

#[tauri::command]
pub async fn count_pairs(app: tauri::AppHandle) -> Result<PairCount, String> {
    use tauri::Manager;
    let count = tauri::async_runtime::spawn_blocking(move || -> anyhow::Result<PairCount> {
        let state = app.state::<crate::AppState>();
        let files = state.import.inner.lock().unwrap().files.clone();
        let conn = crate::db::open(&state.paths.db)?;
        let pairs = find(&files, &conn)?;
        let videos = pairs.iter().filter(|p| p.kind == Kind::Video).count();
        Ok(PairCount {
            total: pairs.len(),
            in_library: pairs.iter().filter(|p| p.in_library.is_some()).count(),
            images: pairs.len() - videos,
            videos,
        })
    });
    count.await.map_err(|e| e.to_string())?.map_err(|e| format!("{e:#}"))
}
