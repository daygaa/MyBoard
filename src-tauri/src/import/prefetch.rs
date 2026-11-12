//! Lecture d'avance des fichiers d'un SSD (IMP-06) : 4 fils lisent les fichiers suivants de la liste et calculent leur
//! empreinte (BLAKE3) et leur début (dimensions des images) pendant que l'import enregistre le fichier en cours ; la
//! base reste écrite par le seul fil de l'import. Sur un disque dur (et tout ce qui n'est pas un SSD, `disk.rs`), aucun
//! fil : le fil de l'import lit un fichier à la fois, comme avant. Un fichier déjà dans la bibliothèque au même endroit
//! (même poids, même date) n'est pas lu, comme dans l'import. Les fils ne prennent que 16 fichiers d'avance.

use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::thread::JoinHandle;

use anyhow::bail;
use rusqlite::OptionalExtension;

use super::disk::Disks;
use super::index::to_ms;
use super::scan::ScanFile;

/// Fils de lecture sur un SSD (mesure du 11/11 : ×2,5 avec 4 fils, guère mieux avec 8).
const READERS: usize = 4;
/// Fichiers lus d'avance au plus (mémoire : 256 Ko de début par fichier).
const AHEAD: usize = 16;
/// Début du fichier conservé pour lire les dimensions d'une image sans la décoder.
pub const HEAD_LEN: usize = 256 * 1024;

/// Fichier lu d'avance : son poids et sa date au moment de la lecture (un fichier modifié depuis est relu).
pub struct Hashed {
    path: PathBuf,
    size: u64,
    modified: Option<i64>,
    pub hash: String,
    pub head: Vec<u8>,
}

impl Hashed {
    /// Toujours valable pour ce fichier ?
    pub fn fits(&self, path: &Path) -> bool {
        self.path == path && std::fs::metadata(path).is_ok_and(|m| m.len() == self.size && m.modified().ok().map(to_ms) == self.modified)
    }
}

/// Empreinte BLAKE3 du contenu complet, lu par blocs de 1 Mo ; garde le début du fichier dans `head`. `stop` :
/// abandon en cours de lecture (import arrêté).
pub fn hash_file(path: &Path, buffer: &mut [u8], head: &mut Vec<u8>, stop: &dyn Fn() -> bool) -> anyhow::Result<String> {
    let mut reader = File::open(path)?;
    let mut hasher = blake3::Hasher::new();
    head.clear();
    loop {
        if stop() {
            bail!("import arrêté");
        }
        let n = reader.read(buffer)?;
        if n == 0 {
            break;
        }
        if head.len() < HEAD_LEN {
            head.extend_from_slice(&buffer[..n.min(HEAD_LEN - head.len())]);
        }
        hasher.update(&buffer[..n]);
    }
    Ok(hasher.finalize().to_hex().to_string())
}

struct Shared {
    /// Chemin de chaque fichier de la liste ; `None` : pas lu d'avance (pas sur un SSD, ou mis de côté).
    files: Vec<Option<PathBuf>>,
    next: AtomicUsize,
    stop: AtomicBool,
    state: Mutex<State>,
    changed: Condvar,
}

#[derive(Default)]
struct State {
    /// Résultats prêts ; `None` : fichier déjà dans la bibliothèque, ou illisible (l'import s'en occupe).
    done: HashMap<usize, Option<Hashed>>,
    /// Fichiers déjà demandés par l'import (les fils restent à moins de `AHEAD` devant).
    consumed: usize,
}

pub struct Prefetch {
    shared: Arc<Shared>,
    threads: Vec<JoinHandle<()>>,
}

impl Prefetch {
    /// Aucun fil si aucun fichier à lire n'est sur un SSD. `skip` : fichiers que l'import ne lira pas.
    pub fn start(db: &Path, files: &[ScanFile], skip: impl Fn(&Path) -> bool) -> Option<Self> {
        let mut disks = Disks::default();
        let files: Vec<Option<PathBuf>> = files.iter().map(|f| (!skip(&f.path) && disks.ssd(&f.path)).then(|| f.path.clone())).collect();
        if files.iter().all(Option::is_none) {
            return None;
        }
        let shared = Arc::new(Shared { files, next: AtomicUsize::new(0), stop: AtomicBool::new(false), state: Mutex::default(), changed: Condvar::new() });
        let threads = (0..READERS)
            .filter_map(|n| {
                let (shared, db) = (shared.clone(), db.to_path_buf());
                std::thread::Builder::new().name(format!("lecture-import-{n}")).spawn(move || read_ahead(&shared, &db)).ok()
            })
            .collect();
        Some(Self { shared, threads })
    }

    /// Le fichier `i` lu d'avance, s'il l'a été (attend qu'il le soit) ; une seconde demande du même fichier (repris
    /// après une pause) : rien, l'import le relit.
    pub fn take(&self, i: usize) -> Option<Hashed> {
        let mut state = self.shared.state.lock().unwrap();
        if i < state.consumed {
            return None;
        }
        state.consumed = i + 1;
        self.shared.changed.notify_all();
        self.shared.files.get(i)?.as_ref()?;
        loop {
            if let Some(found) = state.done.remove(&i) {
                return found;
            }
            state = self.shared.changed.wait(state).unwrap();
        }
    }
}

impl Drop for Prefetch {
    fn drop(&mut self) {
        self.shared.stop.store(true, Ordering::SeqCst);
        self.shared.changed.notify_all();
        for thread in self.threads.drain(..) {
            let _ = thread.join();
        }
    }
}

/// Un fil de lecture : prend le fichier suivant de la liste, attend d'être à moins de `AHEAD` de l'import, le lit.
fn read_ahead(shared: &Shared, db: &Path) {
    let conn = crate::db::open(db).ok();
    let stopped = || shared.stop.load(Ordering::SeqCst);
    let mut buffer = vec![0u8; 1 << 20];
    loop {
        let i = shared.next.fetch_add(1, Ordering::SeqCst);
        let Some(entry) = shared.files.get(i) else { return };
        let Some(path) = entry else { continue };
        {
            let mut state = shared.state.lock().unwrap();
            while !stopped() && i >= state.consumed + AHEAD {
                state = shared.changed.wait(state).unwrap();
            }
        }
        if stopped() {
            return;
        }
        let result = read_one(conn.as_ref(), path, &mut buffer, &stopped);
        shared.state.lock().unwrap().done.insert(i, result);
        shared.changed.notify_all();
    }
}

fn read_one(conn: Option<&rusqlite::Connection>, path: &Path, buffer: &mut [u8], stopped: &dyn Fn() -> bool) -> Option<Hashed> {
    let meta = std::fs::metadata(path).ok()?;
    let modified = meta.modified().ok().map(to_ms);
    // Déjà dans la bibliothèque à cet endroit, inchangé : l'import ne le lira pas.
    let known: Option<(i64, Option<i64>)> = conn?
        .prepare_cached("SELECT size, file_modified_at FROM media WHERE path = ?1")
        .ok()?
        .query_row([path.to_str()?], |r| Ok((r.get(0)?, r.get(1)?)))
        .optional()
        .ok()?;
    if known == Some((meta.len() as i64, modified)) {
        return None;
    }
    let mut head = Vec::with_capacity(HEAD_LEN);
    let hash = hash_file(path, buffer, &mut head, stopped).ok()?;
    Some(Hashed { path: path.to_path_buf(), size: meta.len(), modified, hash, head })
}
