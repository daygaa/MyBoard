//! Déroulement d'un import, dans son propre fil (IMP-40, IMP-42, IMP-44) : indexation fichier par fichier, lots
//! validés en base, progression envoyée à l'interface. Phase 4 : compression et conversion (IMP-20, IMP-21), paires
//! originaux + versions (IMP-64), « Supprimer les originaux » (IMP-28). Un fichier n'est effacé du disque qu'APRÈS la
//! validation du lot qui ne l'utilise plus, et jamais s'il est encore le fichier d'un média : un arrêt brutal ne peut
//! pas faire perdre à la fois l'original et sa nouvelle version.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::time::Instant;

use rusqlite::{Connection, params};
use tauri::{AppHandle, Emitter, Manager};

use super::compress::Squeeze;
use super::index::{Indexer, Outcome};
use super::plan::{ImportOptions, PairChoice};
use super::scan::ScanFile;
use super::{COMMIT_EVERY, COMMIT_INTERVAL, FileError, ImportResult, LIBRARY_INTERVAL, MAX_LISTED_ERRORS, Phase, Progress};
use crate::reserve;
use crate::tagging::{Tagger, Target, resolve_or_create};
use crate::tags::NewTag;
use crate::{AppState, db};

pub fn run_import(app: &AppHandle, files: Vec<ScanFile>, default_tags: Vec<NewTag>, options: ImportOptions) {
    let state = app.state::<AppState>();
    let manager = &state.import;
    let start = Instant::now();
    let process = options.process();
    let mut progress = Progress { total: files.len() as u64, ..Progress::default() };
    let mut error_files = Vec::new();
    let mut cancelled = false;
    let mut restorable = Vec::new();
    // Fichiers à effacer une fois leur lot validé : originaux remplacés (IMP-28), fichiers écartés d'une paire (IMP-64).
    let mut to_delete: Vec<PathBuf> = Vec::new();

    let fatal = (|| -> anyhow::Result<()> {
        let mut conn = db::open(&state.paths.db)?;
        // Tags par défaut : créés une fois au départ (ceux qui existent gardent leur catégorie ; un
        // synonyme donne son tag principal, TAGM-15). Les parents suivent à chaque média (TAGM-16).
        let targets: Vec<Target> = {
            let tx = conn.transaction()?;
            let mut found = Vec::new();
            for tag in &default_tags {
                found.extend(resolve_or_create(&tx, tag, db::now_ms())?);
            }
            tx.commit()?;
            found
        };
        let tagger = Tagger::load(&conn)?;
        // Paires (IMP-64) : une version déjà écrite par MyBoard n'est jamais retraitée ; selon la réponse de la pop-in,
        // l'un des deux fichiers est écarté.
        let pairs = super::pairs::find(&files, &conn)?;
        let versions: HashMap<PathBuf, PathBuf> = pairs.iter().map(|p| (p.version.clone(), p.original.clone())).collect();
        let set_aside: HashSet<PathBuf> = match options.pairs {
            PairChoice::Both => HashSet::new(),
            PairChoice::Originals => pairs.iter().map(|p| p.version.clone()).collect(),
            PairChoice::Versions => pairs.iter().map(|p| p.original.clone()).collect(),
        };
        let mut indexer = Indexer::new();
        // Médias nouveaux dont les données sont en réserve (DEL-05).
        let mut found = Vec::new();
        let mut in_batch = 0;
        let mut last_commit = Instant::now();
        let mut last_library = Instant::now();
        conn.execute_batch("BEGIN IMMEDIATE")?;

        for file in &files {
            if manager.cancel.load(Ordering::SeqCst) {
                cancelled = true;
                break;
            }
            progress.current_file = file.path.file_name().map(|n| n.to_string_lossy().into_owned());
            if set_aside.contains(&file.path) {
                progress.set_aside += 1;
                if options.delete_pair_files {
                    to_delete.push(file.path.clone());
                }
            } else {
                let version = versions.get(&file.path);
                let outcome = indexer.index(&conn, file, db::now_ms(), process, version.is_some());
                count(&mut progress, &outcome, indexer.squeeze, &mut error_files, file);
                if options.delete_originals
                    && let Some(original) = indexer.replaced.take()
                {
                    to_delete.push(original);
                }
                if let Ok(Outcome::Imported(id) | Outcome::Updated(id) | Outcome::AlreadyPresent(id) | Outcome::Duplicate(id)) =
                    &outcome
                {
                    for target in &targets {
                        tagger.attach(&conn, *id, *target)?;
                    }
                }
                if let Ok(Outcome::Imported(id)) = &outcome {
                    // Seule la version est gardée : elle retient l'empreinte de son original (réimport = doublon).
                    if options.pairs == PairChoice::Versions
                        && let Some(original) = version
                    {
                        remember_original(&conn, *id, original)?;
                    }
                    if reserve::has_kept(&conn, *id)? {
                        found.push(*id);
                    }
                }
            }
            progress.processed += 1;
            in_batch += 1;

            if in_batch >= COMMIT_EVERY || last_commit.elapsed() >= COMMIT_INTERVAL {
                // Miniatures réveillées AVANT de reprendre l'écriture : sinon l'import attendait leur file, tenue par
                // un fil qui attendait la base, tenue par l'import (5 s perdues à chaque fois, IMP-63).
                conn.execute_batch("COMMIT")?;
                delete_files(&conn, &mut to_delete, &mut progress);
                state.thumbs.wake();
                conn.execute_batch("BEGIN IMMEDIATE")?;
                in_batch = 0;
                last_commit = Instant::now();
                if last_library.elapsed() >= LIBRARY_INTERVAL {
                    let _ = app.emit("library-changed", ());
                    last_library = Instant::now();
                }
            }
            let snapshot = progress.clone();
            manager.update(true, |inner| inner.snapshot.progress = Some(snapshot));
        }
        conn.execute_batch("COMMIT")?;
        delete_files(&conn, &mut to_delete, &mut progress);
        restorable = reserve::candidates(&conn, &found)?;
        Ok(())
    })()
    .err()
    .map(|e| format!("{e:#}"));

    state.thumbs.wake();
    let _ = app.emit("library-changed", ());
    progress.current_file = None;
    let result = ImportResult { cancelled, fatal, error_files, elapsed_ms: start.elapsed().as_millis() as u64, restorable };
    manager.update(false, |inner| {
        inner.files.clear();
        inner.snapshot.phase = Phase::Finished;
        inner.snapshot.progress = Some(progress);
        inner.snapshot.result = Some(result);
    });
}

/// Compteurs de la progression pour un fichier.
fn count(progress: &mut Progress, outcome: &anyhow::Result<Outcome>, squeeze: Option<Squeeze>, errors: &mut Vec<FileError>, file: &ScanFile) {
    match squeeze {
        Some(Squeeze::Compressed) => progress.compressed += 1,
        Some(Squeeze::Converted) => progress.converted += 1,
        Some(Squeeze::NotSmaller) => progress.not_smaller += 1,
        Some(Squeeze::Failed) => progress.compress_failed += 1,
        None => {}
    }
    match outcome {
        Ok(Outcome::Imported(_)) => progress.imported += 1,
        Ok(Outcome::Updated(_)) => progress.updated += 1,
        Ok(Outcome::AlreadyPresent(_)) => progress.already_present += 1,
        Ok(Outcome::Duplicate(_)) => progress.duplicates += 1,
        Err(e) => {
            progress.errors += 1;
            if errors.len() < MAX_LISTED_ERRORS {
                errors.push(FileError { path: file.path.display().to_string(), message: format!("{e:#}") });
            }
        }
    }
}

/// La version gardée d'une paire retient l'empreinte de son original écarté (D-058) : un réimport le reconnaît.
fn remember_original(conn: &Connection, id: i64, original: &Path) -> anyhow::Result<()> {
    let hash = blake3::hash(&std::fs::read(original)?).to_hex().to_string();
    conn.execute("UPDATE media SET original_hash = ?1 WHERE id = ?2 AND original_hash IS NULL", params![hash, id])?;
    Ok(())
}

/// Efface définitivement les fichiers notés (sans Corbeille, comme DEL-04) ; jamais un fichier qu'un média utilise.
fn delete_files(conn: &Connection, list: &mut Vec<PathBuf>, progress: &mut Progress) {
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
