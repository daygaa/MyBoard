//! Média retrouvé à l'import (LIB-05, décision du 09/11) : un fichier déplacé puis réimporté depuis son nouveau dossier
//! n'est plus un doublon : le média prend le nouveau chemin et garde tout (tags, dossiers, favori, note) ; un média
//! marqué « fichier introuvable » perd sa marque dès que son fichier est revu. Garde aussi l'état d'une fiche avant
//! qu'un import ne la change, pour « Annuler l'import » (IMP-43, réponse Q9 A du 11/11).

use std::fs::Metadata;

use rusqlite::{Connection, OptionalExtension, params};

use super::index::{file_name_of, to_ms};
use super::scan::ScanFile;
use crate::thumbs::status::ERROR;

/// Fiche d'un média avant son changement par l'import (nouvelle version d'IMP-60, nouveau chemin de LIB-05).
pub struct Before {
    pub id: i64,
    path: String,
    file_name: String,
    name_key: Option<String>,
    hash: String,
    original_hash: Option<String>,
    size: i64,
    ext: String,
    modified: Option<i64>,
    missing_since: Option<i64>,
}

impl Before {
    pub fn read(conn: &Connection, id: i64) -> rusqlite::Result<Self> {
        conn.prepare_cached(
            "SELECT path, file_name, name_key, hash, original_hash, size, ext, file_modified_at, missing_since FROM media WHERE id = ?1",
        )?
        .query_row([id], |r| {
            Ok(Self {
                id,
                path: r.get(0)?,
                file_name: r.get(1)?,
                name_key: r.get(2)?,
                hash: r.get(3)?,
                original_hash: r.get(4)?,
                size: r.get(5)?,
                ext: r.get(6)?,
                modified: r.get(7)?,
                missing_since: r.get(8)?,
            })
        })
    }

    /// « Annuler l'import » : la fiche reprend son état d'avant (sa miniature est refaite si le fichier a changé).
    pub fn restore(&self, conn: &Connection) -> rusqlite::Result<()> {
        conn.execute(
            "UPDATE media SET path = ?1, file_name = ?2, name_key = ?3, hash = ?4, original_hash = ?5, size = ?6, ext = ?7,
                 file_modified_at = ?8, missing_since = ?9,
                 thumb_status = CASE WHEN hash = ?4 THEN thumb_status ELSE 0 END
             WHERE id = ?10",
            params![
                self.path,
                self.file_name,
                self.name_key,
                self.hash,
                self.original_hash,
                self.size,
                self.ext,
                self.modified,
                self.missing_since,
                self.id
            ],
        )?;
        Ok(())
    }
}

/// Même contenu que le média `other` : si son fichier a disparu d'un emplacement accessible (déplacé, renommé), le
/// média prend ce nouveau chemin. `None` : vrai doublon (l'autre fichier existe, ou son disque est débranché, LIB-14).
/// Seulement pour le même contenu (`hash` du fichier = celui du média), jamais pour l'original d'une version compressée.
pub fn relocate(conn: &Connection, other: i64, file: &ScanFile, meta: &Metadata, path: &str, hash: &str) -> anyhow::Result<Option<Before>> {
    let old: Option<String> =
        conn.prepare_cached("SELECT path FROM media WHERE id = ?1 AND hash = ?2")?.query_row(params![other, hash], |r| r.get(0)).optional()?;
    let Some(old) = old else { return Ok(None) };
    if old.eq_ignore_ascii_case(path) || crate::library_check::presence(std::path::Path::new(&old)) != crate::library_check::Presence::Missing {
        return Ok(None);
    }
    let before = Before::read(conn, other)?;
    let file_name = file_name_of(path);
    conn.execute(
        "UPDATE media SET path = ?1, file_name = ?2, name_key = ?3, ext = ?4, file_modified_at = ?5, missing_since = NULL,
             thumb_status = CASE WHEN thumb_status = ?6 THEN 0 ELSE thumb_status END
         WHERE id = ?7",
        params![path, file_name, crate::db::name_key::name_key(&file_name), file.ext, meta.modified().ok().map(to_ms), ERROR, other],
    )?;
    Ok(Some(before))
}

/// Fichier revu à son chemin : la marque « fichier introuvable » disparaît (LIB-05) ; une miniature ratée pendant son
/// absence est refaite.
pub fn found_again(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    conn.prepare_cached(
        "UPDATE media SET missing_since = NULL, thumb_status = CASE WHEN thumb_status = ?1 THEN 0 ELSE thumb_status END
         WHERE id = ?2 AND missing_since IS NOT NULL",
    )?
    .execute(params![ERROR, id])?;
    Ok(())
}
