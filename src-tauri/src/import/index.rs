//! Indexation d'un fichier : empreinte, détection des doublons, enregistrement (LIB-01, LIB-03).
//! Les fichiers de l'utilisateur sont uniquement LUS, jamais modifiés ni déplacés. Avec « Compresser les images » ou
//! « Convertir les images » (IMP-20, IMP-21, IMP-27), le média pointe vers la version écrite à côté, avec sa vraie
//! extension (IMP-47) ; `original_hash` garde l'empreinte de l'original (D-058). Image déjà dans la bibliothèque au
//! même endroit : même fiche, nouveau fichier (IMP-60). L'original remplacé est noté (`replaced`) : « Supprimer les
//! originaux » l'efface une fois l'enregistrement validé (IMP-28). Vidéos (IMP-69, IMP-22) : `video::process`.

use std::fs::{File, Metadata};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use anyhow::Context;
use rusqlite::{Connection, OptionalExtension, params};

use super::compress::{self, Squeeze};
use super::plan::{Action, Process};
use super::scan::ScanFile;
use super::video::{Done, Hooks};
use crate::formats::Kind;

/// Résultat de l'indexation, avec l'identifiant du média concerné dans la bibliothèque
/// (celui du média existant pour un doublon) : les tags par défaut de l'import y sont
/// ajoutés dans tous les cas (IMP-30).
pub enum Outcome {
    Imported(i64),
    /// Même chemin, même taille, même date de modification : rien à faire.
    AlreadyPresent(i64),
    /// Même chemin mais contenu modifié : le média garde ses tags, sa miniature est refaite.
    Updated(i64),
    /// Contenu identique à un média déjà présent (fichier copié ou renommé), ou à l'original d'une image compressée.
    Duplicate(i64),
}

/// Début du fichier conservé pour lire les dimensions d'une image sans la décoder.
const HEAD_LEN: usize = 256 * 1024;

/// Fichier écrit : chemin, empreinte, poids, extension.
type Written = (String, String, i64, String);
/// Média déjà à ce chemin : id, poids, date de modification, empreinte, empreinte de l'original.
type Existing = (i64, i64, Option<i64>, String, Option<String>);

pub struct Indexer {
    buffer: Vec<u8>,
    head: Vec<u8>,
    /// Résultat de la compression du dernier fichier (aucun : pas compressé ou pas concerné).
    pub squeeze: Option<Squeeze>,
    /// Original dont une nouvelle version vient de prendre la place dans la bibliothèque (IMP-28).
    pub replaced: Option<PathBuf>,
}

impl Indexer {
    pub fn new() -> Self {
        // Lecture par blocs de 1 Mo : efficace sur SSD comme sur disque dur.
        Self { buffer: vec![0; 1 << 20], head: Vec::with_capacity(HEAD_LEN), squeeze: None, replaced: None }
    }

    /// Doit être appelé dans une transaction ouverte (les lots sont validés par l'appelant), sauf pour une vidéo à traiter.
    /// `as_is` : fichier d'une paire (IMP-64, IMP-68), version déjà écrite par MyBoard ou son original : jamais retraité.
    pub fn index(&mut self, conn: &Connection, file: &ScanFile, now: i64, process: Option<Process>, as_is: bool, hooks: &Hooks) -> anyhow::Result<Outcome> {
        self.squeeze = None;
        self.replaced = None;
        let meta = std::fs::metadata(&file.path)?;
        let size = meta.len() as i64;
        let modified = meta.modified().ok().map(to_ms);
        let created = meta.created().ok().map(to_ms);
        let path = file.path.to_str().context("nom de fichier illisible")?;
        let action = process.filter(|_| !as_is).and_then(|p| p.action(file.kind, &file.ext));
        // Traiter aussi l'image déjà dans la bibliothèque à cet endroit (IMP-60), si elle ne l'a jamais été.
        let existing_too = process.is_some_and(|p| p.existing);
        let again = |original: &Option<String>| action.filter(|_| existing_too && original.is_none());

        let existing: Option<Existing> = conn
            .prepare_cached("SELECT id, size, file_modified_at, hash, original_hash FROM media WHERE path = ?1")?
            .query_row([path], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)))
            .optional()?;
        if let Some((id, old_size, old_modified, hash, original)) = &existing
            && *old_size == size
            && *old_modified == modified
        {
            if let Some(a) = again(original) {
                self.recompress(conn, *id, file, &meta, hash, a, hooks)?;
            }
            return Ok(Outcome::AlreadyPresent(*id));
        }

        let hash = self.hash(&file.path)?;
        // Même contenu qu'un média, ou que l'original d'une image compressée (D-058).
        if let Some(other) = find_hash(conn, &hash)? {
            if let Some((id, _, _, _, original)) = &existing
                && *id == other
            {
                // Seule la date a changé (fichier touché sans modification du contenu).
                conn.execute("UPDATE media SET file_modified_at = ?1 WHERE id = ?2", params![modified, other])?;
                if let Some(a) = again(original) {
                    self.recompress(conn, other, file, &meta, &hash, a, hooks)?;
                }
                return Ok(Outcome::AlreadyPresent(other));
            }
            return Ok(Outcome::Duplicate(other));
        }

        let (width, height) = match file.kind {
            Kind::Image => imagesize::blob_size(&self.head)
                .map(|s| (Some(s.width as i64), Some(s.height as i64)))
                .unwrap_or((None, None)),
            _ => (None, None),
        };
        let thumb_status = 0; // à faire (le service des miniatures s'en charge)

        if let Some((id, _, _, _, original)) = &existing {
            conn.execute(
                "UPDATE media SET hash = ?1, size = ?2, width = ?3, height = ?4, duration_ms = NULL,
                     file_created_at = ?5, file_modified_at = ?6, thumb_status = ?7
                 WHERE id = ?8",
                params![hash, size, width, height, created, modified, thumb_status, id],
            )?;
            if let Some(a) = again(original) {
                self.recompress(conn, *id, file, &meta, &hash, a, hooks)?;
            }
            return Ok(Outcome::Updated(*id));
        }

        // Nouveau média : la version compressée, si elle est gardée, prend la place de l'original.
        let mut target = (path.to_owned(), hash.clone(), size, None::<String>, file.ext.clone());
        // Une vidéo déjà écrite par MyBoard n'est jamais retraitée (table des versions, IMP-68).
        let fresh = match action {
            Some(Action::Video(_)) if super::versions::original_of(conn, &hash)?.is_some() => None,
            a => a,
        };
        if let Some(a) = fresh
            && let Some((new_path, new_hash, new_size, new_ext)) = self.compress(conn, file, &meta, a, &hash, hooks)?
        {
            target = (new_path, new_hash, new_size, Some(hash), new_ext);
        }
        let (path, hash, size, original_hash, ext) = target;
        let file_name = file_name_of(&path);
        conn.prepare_cached(
            "INSERT INTO media (hash, path, file_name, ext, kind, size, width, height,
                                file_created_at, file_modified_at, imported_at, thumb_status, name_key, original_hash)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
        )?
        .execute(params![
            hash,
            path,
            file_name,
            ext,
            file.kind.as_str(),
            size,
            width,
            height,
            created,
            modified,
            now,
            thumb_status,
            crate::db::name_key::name_key(&file_name),
            original_hash
        ])?;
        Ok(Outcome::Imported(conn.last_insert_rowid()))
    }

    /// Compresse ou convertit, et écrit à côté de l'original (noté dans la table des versions, IMP-68). Un échec n'arrête
    /// pas l'import : l'original est importé tel quel et c'est compté (`squeeze`).
    fn compress(&mut self, conn: &Connection, file: &ScanFile, meta: &Metadata, action: Action, original_hash: &str, hooks: &Hooks) -> anyhow::Result<Option<Written>> {
        if let Action::Video(request) = action {
            return match super::video::process(conn, &file.path, meta, request, hooks) {
                Ok(Done::Written { path, hash, size, ext, squeeze }) => {
                    super::versions::remember(conn, &hash, original_hash)?;
                    self.squeeze = Some(squeeze);
                    self.replaced = Some(file.path.clone());
                    Ok(Some((path, hash, size, ext)))
                }
                Ok(Done::Kept(squeeze)) => {
                    self.squeeze = squeeze;
                    Ok(None)
                }
                Ok(Done::Cancelled) => anyhow::bail!("import arrêté"),
                Err(e) => Ok(self.failed(file, e)),
            };
        }
        let mut animated = false;
        let encoded = match compress::encode(&file.path, action, &mut animated) {
            Ok(Some(encoded)) => encoded,
            Ok(None) => {
                self.squeeze = (!animated).then_some(Squeeze::NotSmaller);
                return Ok(None);
            }
            Err(e) => return Ok(self.failed(file, e)),
        };
        // Contenu déjà connu (cas rare) : rien n'est écrit, l'original est importé tel quel.
        if find_hash(conn, &encoded.hash)?.is_some() {
            return Ok(None);
        }
        let (ext, suffix) = compress::naming(action, &file.path);
        match compress::write_beside(&file.path, meta, &encoded.bytes, &ext, suffix) {
            Ok(written) => {
                super::versions::remember(conn, &encoded.hash, original_hash)?;
                let (squeeze, ext) = match action {
                    Action::Compress(_) => (Squeeze::Compressed, file.ext.clone()),
                    Action::Convert { target, .. } => (Squeeze::Converted, target.ext().to_owned()),
                    Action::Video(_) => unreachable!("vidéo traitée plus haut"),
                };
                self.squeeze = Some(squeeze);
                self.replaced = Some(file.path.clone());
                let path = written.to_str().context("nom de fichier illisible")?.to_owned();
                Ok(Some((path, encoded.hash, encoded.bytes.len() as i64, ext)))
            }
            Err(e) => Ok(self.failed(file, e)),
        }
    }

    /// Image déjà dans la bibliothèque (IMP-60) : même fiche (tags, dossiers, favoris…), seul le fichier change.
    #[allow(clippy::too_many_arguments)]
    fn recompress(&mut self, conn: &Connection, id: i64, file: &ScanFile, meta: &Metadata, hash: &str, action: Action, hooks: &Hooks) -> anyhow::Result<()> {
        let Some((path, new_hash, size, ext)) = self.compress(conn, file, meta, action, hash, hooks)? else { return Ok(()) };
        let file_name = file_name_of(&path);
        conn.execute(
            "UPDATE media SET path = ?1, file_name = ?2, name_key = ?3, hash = ?4, original_hash = ?5, size = ?6,
                 ext = ?7, thumb_status = 0
             WHERE id = ?8",
            params![path, file_name, crate::db::name_key::name_key(&file_name), new_hash, hash, size, ext, id],
        )?;
        Ok(())
    }

    /// « Supprimer les originaux », original dans la bibliothèque (IMP-68) : la version (jamais retraitée) prend sa place
    /// sur la même fiche, comme IMP-60, et retient l'empreinte de l'original (son réimport compte comme doublon).
    pub fn take_place(&mut self, conn: &Connection, file: &ScanFile, id: i64, original_hash: &str) -> anyhow::Result<Outcome> {
        self.squeeze = None;
        self.replaced = None;
        let meta = std::fs::metadata(&file.path)?;
        let hash = self.hash(&file.path)?;
        if let Some(other) = find_hash(conn, &hash)? {
            return Ok(Outcome::Duplicate(other));
        }
        let path = file.path.to_str().context("nom de fichier illisible")?;
        let file_name = file_name_of(path);
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
                meta.created().ok().map(to_ms),
                meta.modified().ok().map(to_ms),
                id
            ],
        )?;
        super::versions::remember(conn, &hash, original_hash)?;
        Ok(Outcome::Updated(id))
    }

    fn failed<T>(&mut self, file: &ScanFile, error: anyhow::Error) -> Option<T> {
        eprintln!("[import] compression ou conversion de {} : {error:#}", file.path.display());
        self.squeeze = Some(Squeeze::Failed);
        None
    }

    /// Empreinte BLAKE3 du contenu complet ; garde le début du fichier dans `head`.
    fn hash(&mut self, path: &Path) -> anyhow::Result<String> {
        let mut reader = File::open(path)?;
        let mut hasher = blake3::Hasher::new();
        self.head.clear();
        loop {
            let n = reader.read(&mut self.buffer)?;
            if n == 0 {
                break;
            }
            if self.head.len() < HEAD_LEN {
                let take = n.min(HEAD_LEN - self.head.len());
                self.head.extend_from_slice(&self.buffer[..take]);
            }
            hasher.update(&self.buffer[..n]);
        }
        Ok(hasher.finalize().to_hex().to_string())
    }
}

/// Média dont le fichier, ou l'original compressé, a cette empreinte.
pub(super) fn find_hash(conn: &Connection, hash: &str) -> rusqlite::Result<Option<i64>> {
    let found = conn.prepare_cached("SELECT id FROM media WHERE hash = ?1")?.query_row([hash], |r| r.get(0)).optional()?;
    if found.is_some() {
        return Ok(found);
    }
    conn.prepare_cached("SELECT id FROM media WHERE original_hash = ?1")?.query_row([hash], |r| r.get(0)).optional()
}

fn file_name_of(path: &str) -> String {
    Path::new(path).file_name().and_then(|n| n.to_str()).unwrap_or(path).to_owned()
}

fn to_ms(time: SystemTime) -> i64 {
    time.duration_since(SystemTime::UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}
