//! Fichiers déplacés ou supprimés hors de MyBoard (LIB-05) et emplacements inaccessibles (LIB-14), réponses du 09/11 et
//! du 11/11. À chaque ouverture, un fil en priorité basse vérifie que le fichier de chaque média existe encore, pendant
//! qu'on utilise MyBoard ; à la fin, l'interface reçoit les médias disparus (pop-in « Supprimer de la bibliothèque » /
//! « Conserver la miniature ») et les emplacements inaccessibles (bandeau, marque sur les vignettes). Un disque débranché,
//! un dossier réseau injoignable n'est jamais pris pour une suppression : seul un fichier absent d'un emplacement
//! accessible est « disparu ». Une erreur d'accès (droits, réseau lent) compte comme présent. Tous les emplacements de
//! la bibliothèque (et ceux des imports suivants) sont ensuite surveillés toutes les 5 s pendant toute la séance (réponse
//! Q11 A ; retour du 11/11 : un débranchement doit aussi se voir) : débranché, bandeau et marques ; rebranché, ils partent
//! et ses médias sont vérifiés à leur tour. Un fichier revu fait réessayer ses grands aperçus et ses miniatures ratés.
//! Rien n'est écrit en base, sauf la marque « fichier introuvable » (`media.missing_since`, colonne prévue dès le
//! schéma 1 pour cette question Q-01), posée par « Conserver la miniature » et effacée dès que le fichier est revu.

use std::collections::HashSet;
use std::path::{Component, Path, PathBuf};
use std::sync::{Mutex, RwLock};
use std::time::Duration;

use rusqlite::params;
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::{AppState, db};

mod watch;

/// Événement envoyé à l'interface à chaque changement (`CheckState`).
const EVENT: &str = "library-check";
/// Médias disparus envoyés à l'interface (la pop-in en montre autant) ; la liste complète reste ici : 100 000 médias
/// envoyés d'un coup figeaient la fenêtre ~2 s (mesuré le 11/11).
const SHOWN: usize = 500;
pub(super) const RECHECK_EVERY: Duration = Duration::from_secs(5);

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Presence {
    Present,
    /// Absent d'un emplacement accessible : déplacé, renommé ou supprimé.
    Missing,
    /// Disque, clé ou partage réseau inaccessible (LIB-14).
    Offline,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingMedia {
    pub id: i64,
    pub hash: String,
    pub file_name: String,
    pub path: String,
    pub kind: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfflineRoot {
    pub root: String,
    pub count: u64,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckState {
    /// Vérification en cours.
    pub running: bool,
    /// Médias disparus pas encore réglés (pop-in LIB-05) : les 500 premiers, leur nombre total, et un numéro qui change
    /// quand d'autres s'ajoutent (clé rebranchée : la pop-in fermée par Échap revient).
    pub missing: Vec<MissingMedia>,
    pub missing_total: u64,
    pub missing_version: u64,
    pub offline: Vec<OfflineRoot>,
}

pub(super) struct Inner {
    state: CheckState,
    all: Vec<MissingMedia>,
}

pub(super) struct Row {
    pub(super) item: MissingMedia,
    pub(super) marked: bool,
}

static STATE: Mutex<Inner> = Mutex::new(Inner {
    state: CheckState { running: false, missing: Vec::new(), missing_total: 0, missing_version: 0, offline: Vec::new() },
    all: Vec::new(),
});
/// Emplacements inaccessibles, en minuscules (marque des vignettes, `library::media_from_row`).
pub(super) static OFFLINE: RwLock<Vec<String>> = RwLock::new(Vec::new());
/// Emplacements des imports de la séance, à surveiller aussi.
pub(super) static NEW_ROOTS: Mutex<Vec<PathBuf>> = Mutex::new(Vec::new());

/// Après un import : les emplacements de ses fichiers sont surveillés à leur tour (débranchement, LIB-14).
pub fn watch_roots<'a>(paths: impl Iterator<Item = &'a Path>) {
    let roots: HashSet<PathBuf> = paths.map(root_of).collect();
    NEW_ROOTS.lock().unwrap().extend(roots);
}

/// Disque ou partage réseau du chemin : « D:\ », « \\serveur\partage\ ».
pub fn root_of(path: &Path) -> PathBuf {
    path.components().take_while(|c| matches!(c, Component::Prefix(_) | Component::RootDir)).map(|c| c.as_os_str()).collect()
}

pub(super) fn reachable(root: &Path) -> bool {
    root.as_os_str().is_empty() || std::fs::metadata(root).is_ok()
}

pub fn presence(path: &Path) -> Presence {
    match std::fs::metadata(path) {
        Ok(_) => Presence::Present,
        Err(_) if !reachable(&root_of(path)) => Presence::Offline,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Presence::Missing,
        Err(_) => Presence::Present,
    }
}

/// Média sur un emplacement inaccessible (vignettes, visionneuse).
pub fn is_offline(path: &str) -> bool {
    let roots = OFFLINE.read().unwrap();
    !roots.is_empty() && {
        let lower = path.to_lowercase();
        roots.iter().any(|r| lower.starts_with(r))
    }
}

pub fn start(app: AppHandle, db_path: PathBuf) {
    let spawned = std::thread::Builder::new().name("verification-fichiers".into()).spawn(move || {
        crate::thumbs::lower_thread_priority();
        if let Err(e) = watch::check(&app, &db_path) {
            eprintln!("[vérification] {e:#}");
            update(&app, |s| s.state.running = false);
        }
    });
    if let Err(e) = spawned {
        eprintln!("[vérification] {e}");
    }
}

pub(super) fn add(inner: &mut Inner, found: Vec<MissingMedia>) {
    if !found.is_empty() {
        inner.all.extend(found);
        inner.state.missing_version += 1;
    }
}

pub(super) fn update(app: &AppHandle, change: impl FnOnce(&mut Inner)) {
    let snapshot = {
        let mut inner = STATE.lock().unwrap();
        change(&mut inner);
        inner.state.missing = inner.all.iter().take(SHOWN).cloned().collect();
        inner.state.missing_total = inner.all.len() as u64;
        inner.state.clone()
    };
    let _ = app.emit(EVENT, snapshot);
}

/// État actuel (au démarrage de l'interface).
#[tauri::command]
pub fn library_check_state() -> CheckState {
    STATE.lock().unwrap().state.clone()
}

/// Réponse de la pop-in pour TOUTE la liste (réponse Q4 A) : « Conserver la miniature » (`keep`) marque les médias
/// « fichier introuvable » ; sinon « Supprimer de la bibliothèque », comme « Supprimer » avec les fichiers gardés
/// (DEL-04 : données en réserve un mois, DEL-05).
#[tauri::command]
pub fn settle_missing(app: AppHandle, state: State<'_, AppState>, keep: bool) -> Result<(), String> {
    let ids: Vec<i64> = STATE.lock().unwrap().all.iter().map(|m| m.id).collect();
    {
        let mut conn = state.db.lock().unwrap();
        (|| -> rusqlite::Result<()> {
            let tx = conn.transaction()?;
            let now = db::now_ms();
            for id in &ids {
                if keep {
                    tx.execute("UPDATE media SET missing_since = ?1 WHERE id = ?2", params![now, id])?;
                } else {
                    tx.execute("UPDATE media SET pending_delete = ?1 WHERE id = ?2 AND pending_delete = 0", params![crate::deletion::LIBRARY_ONLY, id])?;
                }
            }
            tx.commit()
        })()
        .map_err(|e| e.to_string())?;
    }
    if !keep {
        state.deletion.wake();
    }
    update(&app, |s| {
        let done: std::collections::HashSet<i64> = ids.into_iter().collect();
        s.all.retain(|m| !done.contains(&m.id));
    });
    let _ = app.emit("library-changed", ());
    Ok(())
}
