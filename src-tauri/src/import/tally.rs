//! Compteurs de l'import pour un fichier (progression et bilan, IMP-40, IMP-45), et effacement des fichiers notés
//! (originaux remplacés, IMP-28 ; fichiers écartés d'une paire, IMP-64).

use std::path::{Path, PathBuf};

use rusqlite::{Connection, params};

use super::compress::Squeeze;
use super::index::{Indexer, Outcome};
use super::scan::ScanFile;
use super::{FileError, MAX_LISTED_ERRORS, Progress};
use crate::formats::Kind;

/// Compteurs de la progression pour un fichier.
pub fn count(progress: &mut Progress, outcome: &anyhow::Result<Outcome>, indexer: &Indexer, errors: &mut Vec<FileError>, file: &ScanFile) {
    let video = file.kind == Kind::Video;
    match indexer.squeeze {
        Some(Squeeze::Compressed) if video => progress.videos_compressed += 1,
        Some(Squeeze::Converted) if video => progress.videos_converted += 1,
        Some(Squeeze::Unsupported) => progress.videos_unsupported += 1,
        Some(Squeeze::Compressed) => progress.compressed += 1,
        Some(Squeeze::Converted) => progress.converted += 1,
        Some(Squeeze::NotSmaller) => progress.not_smaller += 1,
        Some(Squeeze::Failed) => progress.compress_failed += 1,
        None => {}
    }
    // Poids avant / après des versions gardées (bilan : taux moyen, place gagnée, IMP-45).
    if outcome.is_ok()
        && let Some((before, after)) = indexer.sizes
    {
        if video {
            progress.videos_before += before;
            progress.videos_after += after;
        } else {
            progress.images_before += before;
            progress.images_after += after;
        }
    }
    match outcome {
        Ok(Outcome::Imported(_)) => progress.imported += 1,
        Ok(Outcome::Updated(_)) => progress.updated += 1,
        Ok(Outcome::AlreadyPresent(_)) => progress.already_present += 1,
        Ok(Outcome::Duplicate(_)) => progress.duplicates += 1,
        Ok(Outcome::Relocated(_)) => progress.relocated += 1,
        Err(e) => {
            progress.errors += 1;
            if errors.len() < MAX_LISTED_ERRORS {
                errors.push(FileError { path: file.path.display().to_string(), message: format!("{e:#}") });
            }
        }
    }
}

/// La version gardée d'une paire retient l'empreinte de son original écarté (D-058) : un réimport le reconnaît. Notée
/// aussi dans la table des versions (IMP-68), si elle ne l'était pas (version écrite avant le schéma 20).
pub fn remember_original(conn: &Connection, id: i64, original: &Path) -> anyhow::Result<()> {
    let hash = super::versions::hash_file(original)?;
    conn.execute("UPDATE media SET original_hash = ?1 WHERE id = ?2 AND original_hash IS NULL", params![hash, id])?;
    let version: String = conn.query_row("SELECT hash FROM media WHERE id = ?1", [id], |r| r.get(0))?;
    super::versions::remember(conn, &version, &hash)?;
    Ok(())
}

/// Après la validation d'un lot : fichiers notés effacés, versions écrites sorties du journal (enregistrées en base).
pub fn after_commit(conn: &Connection, to_delete: &mut Vec<PathBuf>, unsaved: &mut Vec<PathBuf>, progress: &mut Progress) {
    delete_files(conn, to_delete, progress);
    super::journal::remove(unsaved);
    unsaved.clear();
}

/// Efface définitivement les fichiers notés (sans Corbeille, comme DEL-04) ; jamais un fichier qu'un média utilise.
pub fn delete_files(conn: &Connection, list: &mut Vec<PathBuf>, progress: &mut Progress) {
    for path in list.drain(..) {
        let used = conn
            .prepare_cached("SELECT 1 FROM media WHERE path = ?1")
            .and_then(|mut s| s.exists([path.to_string_lossy()]))
            .unwrap_or(true);
        if used {
            continue;
        }
        match std::fs::remove_file(&path) {
            Ok(()) => progress.deleted += 1,
            Err(e) => {
                progress.delete_failed += 1;
                eprintln!("[import] effacement de {} : {e}", path.display());
            }
        }
    }
}
