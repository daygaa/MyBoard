//! Originaux ET versions écrites par MyBoard (IMP-64, IMP-68) : sans cette pop-in, un réimport ajouterait les deux.
//! Une paire, dans le même dossier, mêmes dimensions (ou inversées : photo tournée par l'EXIF puis convertie) :
//! - « photo.jpg » et « photo_c.jpg » (ou « photo_c (1).webp »…) : reconnue par le nom (réponse Q9b du 10/11) ; les
//!   numéros d'un original sont gardés : « photo (1).jpg » va avec « photo (1)_c.jpg » ;
//! - conversion seule, « photo.jpg » et « photo.webp » : rien dans le nom ne dit lequel est l'original, la paire doit
//!   être confirmée par la table des versions (schéma 20) ; seuls ces candidats sont relus en entier.
//!
//! L'original est dans la liste ou déjà dans la bibliothèque (IMP-68) ; la version n'est jamais dans la bibliothèque
//! (sinon son original compte déjà comme doublon, D-061).

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use rusqlite::{Connection, OptionalExtension, params};
use serde::Serialize;

use super::scan::ScanFile;
use super::versions;
use crate::formats::Kind;

pub struct Pair {
    pub original: PathBuf,
    pub version: PathBuf,
    /// Original déjà dans la bibliothèque (IMP-68) : son média et son empreinte.
    pub in_library: Option<(i64, String)>,
}

/// Original possible d'une version.
struct Candidate {
    path: PathBuf,
    media: Option<(i64, String)>,
}

/// Nom de base d'une version : « photo_c » ou « photo_c (2) » → « photo ».
fn base_of(stem: &str) -> Option<&str> {
    let stem = match stem.strip_suffix(')').and_then(|s| s.rsplit_once(" (")) {
        Some((head, n)) if !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()) => head,
        _ => stem,
    };
    let cut = stem.len().checked_sub(2)?;
    (cut > 0 && stem.get(cut..).is_some_and(|end| end.eq_ignore_ascii_case("_c"))).then(|| &stem[..cut])
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

/// Images de la bibliothèque nommées `name` (sans extension) dans ce dossier : une recherche par l'index des chemins
/// (de « dossier\nom. » à « dossier\nom/ », sans tenir compte des majuscules comme la colonne). Le type est vérifié
/// ici, pas dans la requête : avec « kind = 'image' », SQLite prenait l'index des types et parcourait toutes les images
/// à chaque fichier (mesuré le 10/11 : 1,3 s pour 3 300 fichiers, contre 18 ms par l'index des chemins).
fn media_named(conn: &Connection, dir: &Path, name: &str) -> rusqlite::Result<Vec<Candidate>> {
    let prefix = format!("{}\\{name}", dir.to_string_lossy().trim_end_matches('\\'));
    let mut stmt = conn.prepare_cached("SELECT path, id, hash, kind FROM media WHERE path >= ?1 AND path < ?2")?;
    let rows = stmt.query_map(params![format!("{prefix}."), format!("{prefix}/")], |r| {
        Ok((Candidate { path: PathBuf::from(r.get::<_, String>(0)?), media: Some((r.get(1)?, r.get(2)?)) }, r.get::<_, String>(3)?))
    })?;
    let name = name.to_lowercase();
    let mut found = Vec::new();
    for row in rows {
        let (candidate, kind) = row?;
        if kind == Kind::Image.as_str() && stem_of(&candidate.path).to_lowercase() == name {
            found.push(candidate);
        }
    }
    Ok(found)
}

struct Finder<'a> {
    conn: &'a Connection,
    /// (dossier, nom sans extension) en minuscules → images de la liste.
    by_name: HashMap<(String, String), Vec<&'a Path>>,
    /// Empreintes déjà lues (un fichier n'est relu qu'une fois).
    hashes: HashMap<PathBuf, Option<String>>,
}

impl Finder<'_> {
    /// Images nommées `name` dans le dossier de `version` : de la liste, puis de la bibliothèque.
    fn candidates(&self, version: &Path, name: &str) -> rusqlite::Result<Vec<Candidate>> {
        let dir = version.parent().unwrap_or(Path::new(""));
        let mut found = Vec::new();
        let mut seen = HashSet::new();
        for path in self.by_name.get(&(lower(dir), name.to_lowercase())).into_iter().flatten() {
            if *path != version && seen.insert(lower(path)) {
                found.push(Candidate { path: path.to_path_buf(), media: media_at(self.conn, path)? });
            }
        }
        for candidate in media_named(self.conn, dir, name)? {
            if seen.insert(lower(&candidate.path)) && lower(&candidate.path) != lower(version) {
                found.push(candidate);
            }
        }
        Ok(found)
    }

    /// Empreinte du contenu : celle de la bibliothèque si le fichier y est, sinon relu en entier.
    fn hash(&mut self, path: &Path, media: Option<&(i64, String)>) -> Option<String> {
        if let Some((_, hash)) = media {
            return Some(hash.clone());
        }
        self.hashes
            .entry(path.to_path_buf())
            .or_insert_with(|| std::fs::read(path).ok().map(|b| blake3::hash(&b).to_hex().to_string()))
            .clone()
    }
}

pub fn find(files: &[ScanFile], conn: &Connection) -> rusqlite::Result<Vec<Pair>> {
    let images: Vec<&ScanFile> = files.iter().filter(|f| f.kind == Kind::Image).collect();
    let mut by_name: HashMap<(String, String), Vec<&Path>> = HashMap::new();
    for f in &images {
        let dir = f.path.parent().map(lower).unwrap_or_default();
        by_name.entry((dir, stem_of(&f.path).to_lowercase())).or_default().push(&f.path);
    }
    let mut finder = Finder { conn, by_name, hashes: HashMap::new() };
    // Un original ne va qu'avec une seule version.
    let mut used = HashSet::new();
    let mut pairs = Vec::new();
    for version in &images {
        // D'abord les noms (en mémoire et par l'index) : un fichier n'est ouvert que s'il a un original possible.
        let stem = stem_of(&version.path);
        let by_base = match base_of(&stem) {
            Some(base) => finder.candidates(&version.path, base)?,
            None => Vec::new(),
        };
        let same_stem = finder.candidates(&version.path, &stem)?;
        if (by_base.is_empty() && same_stem.is_empty()) || media_at(conn, &version.path)?.is_some() {
            continue;
        }
        let Ok(size) = imagesize::size(&version.path) else { continue };
        let size = (size.width, size.height);
        let mut found = by_base.into_iter().find(|c| same_size(&c.path, size));
        if found.is_none() {
            let others: Vec<Candidate> = same_stem.into_iter().filter(|c| same_size(&c.path, size)).collect();
            if !others.is_empty()
                && let Some(hash) = finder.hash(&version.path, None)
                && let Some(original) = versions::original_of(conn, &hash)?
            {
                found = others.into_iter().find(|c| finder.hash(&c.path, c.media.as_ref()).as_deref() == Some(original.as_str()));
            }
        }
        if let Some(c) = found
            && used.insert(lower(&c.path))
        {
            pairs.push(Pair { original: c.path, version: version.path.clone(), in_library: c.media });
        }
    }
    Ok(pairs)
}

/// Paires de la liste en cours : la pop-in d'IMP-64 ne s'ouvre que s'il y en a ; son texte dit combien d'originaux
/// sont déjà dans la bibliothèque (IMP-68).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairCount {
    pub total: usize,
    pub in_library: usize,
}

#[tauri::command]
pub async fn count_pairs(app: tauri::AppHandle) -> Result<PairCount, String> {
    use tauri::Manager;
    let count = tauri::async_runtime::spawn_blocking(move || -> anyhow::Result<PairCount> {
        let state = app.state::<crate::AppState>();
        let files = state.import.inner.lock().unwrap().files.clone();
        let conn = crate::db::open(&state.paths.db)?;
        let pairs = find(&files, &conn)?;
        Ok(PairCount { total: pairs.len(), in_library: pairs.iter().filter(|p| p.in_library.is_some()).count() })
    });
    count.await.map_err(|e| e.to_string())?.map_err(|e| format!("{e:#}"))
}
