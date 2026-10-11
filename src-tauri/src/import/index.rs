//! Indexation d'un fichier : empreinte, détection des doublons, enregistrement (LIB-01, LIB-03).
//! Les fichiers de l'utilisateur sont uniquement LUS, jamais modifiés ni déplacés.

use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::time::SystemTime;

use anyhow::Context;
use rusqlite::{Connection, OptionalExtension, params};

use super::scan::ScanFile;
use crate::formats::Kind;

pub enum Outcome {
    Imported,
    /// Même chemin, même taille, même date de modification : rien à faire.
    AlreadyPresent,
    /// Même chemin mais contenu modifié : le média garde ses tags, sa miniature est refaite.
    Updated,
    /// Contenu identique à un média déjà présent (fichier copié ou renommé).
    Duplicate,
}

/// Début du fichier conservé pour lire les dimensions d'une image sans la décoder.
const HEAD_LEN: usize = 256 * 1024;

pub struct Indexer {
    buffer: Vec<u8>,
    head: Vec<u8>,
}

impl Indexer {
    pub fn new() -> Self {
        // Lecture par blocs de 1 Mo : efficace sur SSD comme sur disque dur.
        Self { buffer: vec![0; 1 << 20], head: Vec::with_capacity(HEAD_LEN) }
    }

    /// Doit être appelé dans une transaction ouverte (les lots sont validés par l'appelant).
    pub fn index(&mut self, conn: &Connection, file: &ScanFile, now: i64) -> anyhow::Result<Outcome> {
        let meta = std::fs::metadata(&file.path)?;
        let size = meta.len() as i64;
        let modified = meta.modified().ok().map(to_ms);
        let created = meta.created().ok().map(to_ms);
        let path = file.path.to_str().context("nom de fichier illisible")?;

        let existing: Option<(i64, i64, Option<i64>)> = conn
            .prepare_cached("SELECT id, size, file_modified_at FROM media WHERE path = ?1")?
            .query_row([path], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
            .optional()?;
        if let Some((_, old_size, old_modified)) = existing
            && old_size == size
            && old_modified == modified
        {
            return Ok(Outcome::AlreadyPresent);
        }

        let hash = self.hash(&file.path)?;
        let same_content: Option<i64> = conn
            .prepare_cached("SELECT id FROM media WHERE hash = ?1")?
            .query_row([&hash], |r| r.get(0))
            .optional()?;
        if let Some(other) = same_content {
            if existing.map(|e| e.0) == Some(other) {
                // Seule la date a changé (fichier touché sans modification du contenu).
                conn.execute("UPDATE media SET file_modified_at = ?1 WHERE id = ?2", params![modified, other])?;
                return Ok(Outcome::AlreadyPresent);
            }
            return Ok(Outcome::Duplicate);
        }

        let (width, height) = match file.kind {
            Kind::Image => imagesize::blob_size(&self.head)
                .map(|s| (Some(s.width as i64), Some(s.height as i64)))
                .unwrap_or((None, None)),
            _ => (None, None),
        };
        let thumb_status = 0; // à faire (le service des miniatures s'en charge)

        if let Some((id, _, _)) = existing {
            conn.execute(
                "UPDATE media SET hash = ?1, size = ?2, width = ?3, height = ?4, duration_ms = NULL,
                     file_created_at = ?5, file_modified_at = ?6, thumb_status = ?7
                 WHERE id = ?8",
                params![hash, size, width, height, created, modified, thumb_status, id],
            )?;
            return Ok(Outcome::Updated);
        }

        let file_name = file.path.file_name().and_then(|n| n.to_str()).unwrap_or(path);
        conn.prepare_cached(
            "INSERT INTO media (hash, path, file_name, ext, kind, size, width, height,
                                file_created_at, file_modified_at, imported_at, thumb_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        )?
        .execute(params![
            hash,
            path,
            file_name,
            file.ext,
            file.kind.as_str(),
            size,
            width,
            height,
            created,
            modified,
            now,
            thumb_status
        ])?;
        Ok(Outcome::Imported)
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

fn to_ms(time: SystemTime) -> i64 {
    time.duration_since(SystemTime::UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}
