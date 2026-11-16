//! Parcours des sources de la liste (IMP-88) dans un fil à part : tout changement pendant un parcours le relance avec
//! ce qui reste à parcourir (un parcours remplacé s'arrête, son résultat est oublié). Un dossier parcouru de nouveau
//! garde ses anciens fichiers jusqu'à la fin de son parcours, qui les remplace d'un coup : les chiffres passent
//! directement de l'ancien au nouveau (pas de progression envoyée pendant un tel parcours, retouche 3). Les fichiers
//! retirés par leur croix n'y reviennent jamais (retouche 9).

use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::atomic::Ordering;

use tauri::{AppHandle, Manager};

use super::scan::{self, ScanSummary};
use super::sources::removed_key;
use super::{ImportManager, Phase};
use crate::AppState;

/// Lance (ou relance) le parcours des sources pas encore parcourues ; rien à parcourir : la liste est prête.
pub(super) fn rescan(app: &AppHandle, manager: &ImportManager) {
    let generation = manager.generation.fetch_add(1, Ordering::SeqCst) + 1;
    let (todo, mut seen, base, quiet) = {
        let mut inner = manager.inner.lock().unwrap();
        let pending: Vec<_> = inner.sources.iter().filter(|s| s.scanning && s.absorbed_by.is_none()).collect();
        let todo: Vec<(u64, PathBuf, bool)> = pending.iter().map(|s| (s.id, PathBuf::from(&s.path), s.recursive)).collect();
        // Seulement des sources déjà parcourues (case changée, sources revenues) : pas de progression, les chiffres
        // passent d'un coup de l'ancien au nouveau (IMP-88, retouche 3).
        let quiet = pending.iter().all(|s| !s.fresh);
        if todo.is_empty() {
            if inner.snapshot.phase == Phase::Scanning {
                inner.snapshot.phase = Phase::Ready;
            }
            let refused = std::mem::take(&mut inner.refusing);
            inner.refuse(refused);
            drop(inner);
            manager.update(false, |_| {});
            return;
        }
        // Les anciens fichiers des sources parcourues de nouveau restent dans la liste jusqu'à la fin du parcours, mais
        // ne comptent pas comme « déjà dans la liste » pour lui.
        let redo: HashSet<u64> = todo.iter().map(|t| t.0).collect();
        let mut base = ScanSummary::default();
        let mut seen: HashSet<PathBuf> = HashSet::new();
        for f in inner.files.iter().filter(|f| !redo.contains(&f.source)) {
            base.count(f);
            seen.insert(f.path.clone());
        }
        for s in inner.sources.iter().filter(|s| !redo.contains(&s.id)) {
            base.ignored += s.ignored;
            base.inaccessible += s.inaccessible;
        }
        (todo, seen, base, quiet)
    };
    let app = app.clone();
    let spawned = std::thread::Builder::new().name("import-parcours".into()).spawn(move || {
        let manager = &app.state::<AppState>().import;
        let current = || manager.generation.load(Ordering::SeqCst) == generation;
        let mut done: Vec<(u64, scan::Found)> = Vec::new();
        let mut so_far = base;
        for (id, root, recursive) in todo {
            let start = so_far.clone();
            let Some(found) = scan::scan(&root, recursive, id, &mut seen, || !current(), |partial| {
                if quiet {
                    return;
                }
                let summary = start.plus(partial);
                manager.update(true, |inner| inner.snapshot.scan = Some(summary));
            }) else {
                return; // remplacé par un parcours plus récent
            };
            so_far = so_far.plus(&found.summary);
            done.push((id, found));
        }
        manager.update(false, |inner| {
            if !current() {
                return;
            }
            // Les anciens fichiers des sources parcourues sont remplacés d'un coup ; ceux retirés par leur croix (même
            // pendant le parcours) n'y reviennent pas.
            let redo: HashSet<u64> = done.iter().map(|d| d.0).collect();
            inner.files.retain(|f| !redo.contains(&f.source));
            let mut refused = std::mem::take(&mut inner.refusing);
            for (id, mut found) in done {
                if !inner.removed.is_empty() {
                    found.files.retain(|f| !inner.removed.contains(&removed_key(&f.path)));
                }
                let Some(i) = inner.sources.iter().position(|s| s.id == id) else { continue };
                // Rien de nouveau : un fichier ou un dossier dont tout est déjà dans la liste (Q42 A).
                let keeps = inner.sources.iter().any(|s| s.absorbed_by == Some(id));
                if inner.sources[i].fresh && found.files.is_empty() && found.already > 0 && !keeps {
                    refused.add(inner.sources.remove(i).folder);
                    continue;
                }
                let source = &mut inner.sources[i];
                (source.scanning, source.fresh, source.subfolders) = (false, false, found.subfolders);
                (source.ignored, source.inaccessible) = (found.summary.ignored, found.summary.inaccessible);
                inner.files.extend(found.files);
            }
            inner.refuse(refused);
            inner.sort_files();
            inner.snapshot.phase = Phase::Ready;
            inner.summarize();
        });
        super::video::checks::changed();
    });
    if let Err(e) = spawned {
        eprintln!("[import] parcours : {e}");
    }
}
