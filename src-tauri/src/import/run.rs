//! Déroulement d'un import, dans son propre fil (IMP-40, IMP-42, IMP-44) : indexation fichier par fichier, lots
//! validés en base, progression envoyée à l'interface. Phase 4 : compression et conversion (IMP-20, IMP-21), paires
//! originaux + versions (IMP-64, IMP-68), « Supprimer les originaux » (IMP-28) ; vidéos (IMP-69, IMP-22), chacune
//! traitée hors de toute transaction, avec la barre de progression du fichier (IMP-41). Pause, « Terminer ici » et
//! « Annuler l'import » (IMP-42, IMP-43, `undo.rs`) ; fichier disparu ou emplacement débranché pendant l'import (IMP-54).
//! Un fichier n'est effacé du disque qu'APRÈS la validation du lot qui ne l'utilise plus, et jamais s'il est encore le
//! fichier d'un média : un arrêt brutal ne peut pas faire perdre à la fois l'original et sa nouvelle version.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::time::Instant;

use tauri::{AppHandle, Emitter, Manager};

use super::index::{Indexer, Outcome};
use super::pairs::Pair;
use super::plan::{ImportOptions, PairChoice};
use super::prefetch::Prefetch;
use super::scan::ScanFile;
use super::tally::{after_commit, count, delete_files, remember_original};
use super::undo::Changes;
use super::video::Hooks;
use super::{COMMIT_EVERY, COMMIT_INTERVAL, ImportResult, LIBRARY_INTERVAL, MAX_LISTED_ERRORS, Phase, Progress};
use crate::formats::Kind;
use crate::library_check::{Presence, presence, root_of};
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
    let mut vanished_files = Vec::new();
    let mut cancelled = false;
    let mut undone = None;
    let mut restorable = Vec::new();
    // Fichiers à effacer une fois leur lot validé : originaux remplacés (IMP-28), fichiers écartés d'une paire (IMP-64).
    let mut to_delete: Vec<PathBuf> = Vec::new();
    // Versions écrites depuis la dernière validation : elles sortent du journal une fois enregistrées (IMP-42).
    let mut unsaved: Vec<PathBuf> = Vec::new();
    // Ce que l'import change, pour « Annuler l'import » (IMP-43).
    let mut changes = Changes::default();

    let fatal = (|| -> anyhow::Result<()> {
        let mut conn = db::open(&state.paths.db)?;
        // Tags par défaut : créés une fois au départ (ceux qui existent gardent leur catégorie ; un
        // synonyme donne son tag principal, TAGM-15). Les parents suivent à chaque média (TAGM-16).
        let targets: Vec<Target> = {
            let _hold = state.tag_jobs.hold(); // après le travail sur les tags en arrière-plan (TAGM-23)
            let tx = conn.transaction()?;
            let newest: i64 = tx.query_row("SELECT COALESCE(MAX(id), 0) FROM tags", [], |r| r.get(0))?;
            let mut found = Vec::new();
            for tag in &default_tags {
                found.extend(resolve_or_create(&tx, tag, db::now_ms())?);
            }
            tx.commit()?;
            changes.created_tags = found.iter().map(|t| t.tag_id).filter(|&id| id > newest).collect();
            found
        };
        let tagger = Tagger::load(&conn)?;
        // Paires (IMP-64, IMP-68) : ni la version ni son original ne sont retraités (réponse Q2 du 10/11) ; selon la
        // réponse de la pop-in, l'un des deux fichiers est écarté.
        let pairs = super::pairs::find(&files, &conn)?;
        let versions: HashMap<&Path, &Pair> = pairs.iter().map(|p| (p.version.as_path(), p)).collect();
        // « Importer les originaux » avec « Supprimer du stockage… » (IMP-75) : les versions sont effacées dès le départ,
        // puis les originaux traités selon les options (sinon une nouvelle version prendrait le nom « _c (1) »).
        let refresh = options.pairs == PairChoice::Originals && options.delete_pair_files;
        let as_is: HashSet<&Path> =
            pairs.iter().flat_map(|p| if refresh { vec![p.version.as_path()] } else { vec![p.version.as_path(), p.original.as_path()] }).collect();
        let set_aside: HashSet<&Path> = match options.pairs {
            PairChoice::Both => HashSet::new(),
            PairChoice::Originals => pairs.iter().map(|p| p.version.as_path()).collect(),
            PairChoice::Versions => pairs.iter().map(|p| p.original.as_path()).collect(),
        };
        // « Supprimer les originaux », original déjà dans la bibliothèque : sa version prend sa place sur la même fiche ;
        // il n'est effacé qu'une fois ce changement fait.
        let replaced: HashSet<&Path> = match options.pairs {
            PairChoice::Versions => pairs.iter().filter(|p| p.in_library.is_some()).map(|p| p.original.as_path()).collect(),
            _ => HashSet::new(),
        };
        if refresh {
            let mut early: Vec<PathBuf> = pairs.iter().map(|p| p.version.clone()).collect();
            delete_files(&conn, &mut early, &mut progress);
        }
        let mut indexer = Indexer::new();
        // Sur un SSD, les fichiers suivants sont lus d'avance par 4 fils (IMP-06) ; sur un disque dur, un à la fois.
        let prefetch = Prefetch::start(&state.paths.db, &files, |p| set_aside.contains(p));
        // Vidéo en cours de traitement : barre du fichier (IMP-41) ; pause et arrêt passent jusqu'à ffmpeg.
        let report = |fraction: Option<f32>| {
            manager.update(true, |inner| {
                if let Some(p) = &mut inner.snapshot.progress {
                    p.file_progress = fraction;
                }
            })
        };
        let hooks = Hooks { cancel: &manager.cancel, progress: &report, gate: Some(&manager.gate) };
        // Médias nouveaux dont les données sont en réserve (DEL-05).
        let mut found = Vec::new();
        let mut in_batch = 0;
        let mut last_commit = Instant::now();
        let mut last_library = Instant::now();
        let stopped = || manager.cancel.load(Ordering::SeqCst);
        conn.execute_batch("BEGIN IMMEDIATE")?;

        let mut i = 0;
        while i < files.len() {
            // Pause (IMP-42) : le lot en cours est validé (la base reste libre pour l'interface et les miniatures), puis
            // l'import attend « Reprendre », « Terminer ici » ou « Annuler l'import ».
            if manager.gate.is_paused() && !stopped() {
                conn.execute_batch("COMMIT")?;
                after_commit(&conn, &mut to_delete, &mut unsaved, &mut progress);
                state.thumbs.wake();
                let _ = app.emit("library-changed", ());
                // Compteurs exacts pendant la pause (l'envoi normal est limité à 10 par seconde).
                let snapshot = progress.clone();
                manager.update(false, |inner| inner.snapshot.progress = Some(snapshot));
                manager.gate.wait(&manager.cancel);
                conn.execute_batch("BEGIN IMMEDIATE")?;
                (in_batch, last_commit) = (0, Instant::now());
            }
            if stopped() {
                cancelled = true;
                break;
            }
            let file = &files[i];
            progress.current_file = file.path.file_name().map(|n| n.to_string_lossy().into_owned());
            if set_aside.contains(file.path.as_path()) {
                progress.set_aside += 1;
                if options.delete_pair_files && !replaced.contains(file.path.as_path()) && !refresh {
                    to_delete.push(file.path.clone());
                }
            } else {
                let pair = versions.get(file.path.as_path()).copied();
                let take_place = pair.and_then(|p| p.in_library.as_ref().filter(|_| options.pairs == PairChoice::Versions).map(|m| (p, m)));
                // Vidéo à traiter : le lot est validé AVANT (un encodage peut durer des minutes, la base ne doit pas rester
                // bloquée pour l'interface et les miniatures), la vidéo est enregistrée seule, puis l'écriture reprend.
                let long = take_place.is_none()
                    && file.kind == Kind::Video
                    && !as_is.contains(file.path.as_path())
                    && process.is_some_and(|p| p.action(file.kind, &file.ext).is_some());
                if long {
                    conn.execute_batch("COMMIT")?;
                    after_commit(&conn, &mut to_delete, &mut unsaved, &mut progress);
                    state.thumbs.wake();
                    progress.current_path = Some(file.path.to_string_lossy().into_owned());
                    progress.file_progress = Some(0.0);
                    let snapshot = progress.clone();
                    manager.update(false, |inner| inner.snapshot.progress = Some(snapshot));
                }
                indexer.ready = prefetch.as_ref().and_then(|p| p.take(i));
                let outcome = match take_place {
                    Some((pair, (id, hash))) => {
                        let outcome = indexer.take_place(&conn, file, *id, hash);
                        if options.delete_pair_files && matches!(outcome, Ok(Outcome::Updated(_))) {
                            to_delete.push(pair.original.clone());
                        }
                        outcome
                    }
                    None => indexer.index(&conn, file, db::now_ms(), process, as_is.contains(file.path.as_path()), &hooks),
                };
                if long {
                    conn.execute_batch("BEGIN IMMEDIATE")?;
                    (in_batch, last_commit) = (0, Instant::now());
                    progress.current_path = None;
                    progress.file_progress = None;
                    // « Terminer ici » ou « Annuler l'import » pendant l'encodage : la vidéo n'est ni enregistrée ni comptée.
                    if stopped() && outcome.is_err() {
                        cancelled = true;
                        break;
                    }
                }
                // Version écrite : notée pour le journal et l'annulation ; effacée aussitôt si le fichier n'a pas été
                // enregistré.
                if let Some(written) = indexer.written.take() {
                    if outcome.is_ok() {
                        unsaved.push(written.clone());
                        changes.written.push(written);
                    } else {
                        let _ = std::fs::remove_file(&written);
                        super::journal::remove(&[written]);
                    }
                }
                if let Some(before) = indexer.before.take() {
                    changes.before.push(before);
                }
                // Fichier disparu pendant l'import (IMP-54) : emplacement débranché, l'import se met en pause et
                // reprendra ce fichier (réponse Q10 A) ; fichier effacé, compté à part.
                match if outcome.is_err() { presence(&file.path) } else { Presence::Present } {
                    Presence::Offline => {
                        manager.pause(Some(root_of(&file.path).display().to_string()));
                        continue;
                    }
                    Presence::Missing => {
                        progress.vanished += 1;
                        if vanished_files.len() < MAX_LISTED_ERRORS {
                            vanished_files.push(file.path.display().to_string());
                        }
                    }
                    Presence::Present => count(&mut progress, &outcome, &indexer, &mut error_files, file),
                }
                if indexer.lost_subtitles {
                    progress.videos_subtitles_lost += 1;
                }
                if options.delete_originals
                    && let Some(original) = indexer.replaced.take()
                {
                    to_delete.push(original);
                }
                if let Ok(Outcome::Imported(id) | Outcome::Updated(id) | Outcome::AlreadyPresent(id) | Outcome::Duplicate(id) | Outcome::Relocated(id)) =
                    &outcome
                {
                    let new = matches!(outcome, Ok(Outcome::Imported(_)));
                    for target in &targets {
                        if tagger.attach(&conn, *id, *target)? && !new {
                            changes.tags.push((*id, target.tag_id));
                        }
                    }
                }
                if let Ok(Outcome::Imported(id)) = &outcome {
                    changes.added.push(*id);
                    // Seule la version est gardée : elle retient l'empreinte de son original (réimport = doublon).
                    if options.pairs == PairChoice::Versions
                        && let Some(pair) = pair
                    {
                        remember_original(&conn, *id, &pair.original)?;
                    }
                    if reserve::has_kept(&conn, *id)? {
                        found.push(*id);
                    }
                }
            }
            progress.processed += 1;
            in_batch += 1;
            i += 1;

            if in_batch >= COMMIT_EVERY || last_commit.elapsed() >= COMMIT_INTERVAL {
                // Miniatures réveillées AVANT de reprendre l'écriture : sinon l'import attendait leur file, tenue par
                // un fil qui attendait la base, tenue par l'import (5 s perdues à chaque fois, IMP-63).
                conn.execute_batch("COMMIT")?;
                after_commit(&conn, &mut to_delete, &mut unsaved, &mut progress);
                state.thumbs.wake();
                conn.execute_batch("BEGIN IMMEDIATE")?;
                (in_batch, last_commit) = (0, Instant::now());
                if last_library.elapsed() >= LIBRARY_INTERVAL {
                    let _ = app.emit("library-changed", ());
                    last_library = Instant::now();
                }
            }
            let snapshot = progress.clone();
            manager.update(true, |inner| inner.snapshot.progress = Some(snapshot));
        }
        drop(prefetch);
        conn.execute_batch("COMMIT")?;
        after_commit(&conn, &mut to_delete, &mut unsaved, &mut progress);
        if manager.undo.load(Ordering::SeqCst) && options.undoable() {
            undone = Some(changes.undo(&mut conn)?);
            state.deletion.wake();
        } else {
            restorable = reserve::candidates(&conn, &found)?;
        }
        Ok(())
    })()
    .err()
    .map(|e| format!("{e:#}"));

    manager.gate.set(false);
    // Fichiers revus (réimport, LIB-05) : grands aperçus ratés réessayés ; emplacements de l'import surveillés (LIB-14).
    state.previews.retry_failed();
    crate::library_check::watch_roots(files.iter().map(|f| f.path.as_path()));
    // « Annuler l'import » reste possible après la fin (retour du 11/11), jusqu'au prochain choix de fichiers.
    let undoable = options.undoable() && undone.is_none();
    *manager.last.lock().unwrap() = undoable.then_some(changes);
    state.thumbs.wake();
    let _ = app.emit("library-changed", ());
    progress.current_file = None;
    let result = ImportResult {
        cancelled,
        fatal,
        error_files,
        vanished_files,
        undone,
        elapsed_ms: start.elapsed().as_millis() as u64,
        restorable,
        reported: false,
    };
    manager.update(false, |inner| {
        inner.files.clear();
        inner.snapshot.phase = Phase::Finished;
        inner.snapshot.paused = None;
        inner.snapshot.undoable = undoable;
        inner.snapshot.progress = Some(progress);
        inner.snapshot.result = Some(result);
    });
}
