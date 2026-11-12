//! Travail en arrière-plan sur les tags (TAGM-23, réponses du 12/11). Mettre à la corbeille, supprimer définitivement
//! et restaurer sont immédiats à l'écran : la demande est seulement notée (table `tag_jobs`, schéma 21), l'interface
//! cache aussitôt les tags concernés, puis ce fil fait le travail par paquets d'au plus 150 ms (la base n'est jamais
//! tenue plus longtemps : le reste de MyBoard reste fluide). L'avancement part vers l'interface (badge en haut au
//! centre, Q5 B, Q7 B). MyBoard fermé entre-temps : le travail reprend au lancement suivant (Q6 A, comme DEL-03).
//! Pendant ce travail, les autres modifications des tags attendent qu'il soit fini (`hold`, choix accepté le 12/11).

use std::path::{Path, PathBuf};
use std::sync::{Arc, Condvar, Mutex, MutexGuard};
use std::time::{Duration, Instant};

use rusqlite::{Connection, TransactionBehavior, params};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::db::Cached;
use crate::tag_trash::{self, Info};
use crate::{AppState, db, tag_delete, trash_journal};

/// Sortes de travail (`tag_jobs.kind`).
pub const TRASH: i64 = 1;
pub const PERMANENT: i64 = 2;
pub const RESTORE: i64 = 3;
/// Durée d'un paquet.
const SLICE: Duration = Duration::from_millis(150);
pub const EVENT: &str = "tag-jobs";

/// Avancement : sorte du travail en cours, tags traités, tags à traiter en tout.
#[derive(Clone, Debug, Serialize)]
pub struct Progress {
    pub kind: i64,
    pub done: u64,
    pub total: u64,
}

/// Tag en attente : l'interface le cache partout (par son identifiant, ou son nom pour les listes de noms).
#[derive(Debug, Serialize)]
pub struct PendingTag {
    pub id: i64,
    pub name: String,
}

/// Ce qui attend encore (au lancement de l'interface, et après chaque demande).
#[derive(Debug, Serialize)]
pub struct JobsState {
    pub tags: Vec<PendingTag>,
    pub trash: Vec<i64>,
    pub progress: Option<Progress>,
}

struct Inner {
    app: AppHandle,
    db: PathBuf,
    work: Mutex<bool>,
    wake: Condvar,
    hold: Mutex<()>,
    progress: Mutex<Option<Progress>>,
}

pub struct TagJobs {
    inner: Arc<Inner>,
}

impl TagJobs {
    pub fn start(app: AppHandle, db: &Path) -> anyhow::Result<Self> {
        // Au lancement : reprise d'un travail interrompu.
        let inner = Arc::new(Inner { app, db: db.to_path_buf(), work: Mutex::new(true), wake: Condvar::new(), hold: Mutex::new(()), progress: Mutex::new(None) });
        let worker = inner.clone();
        std::thread::Builder::new().name("tags".into()).spawn(move || worker_loop(&worker))?;
        Ok(Self { inner })
    }

    pub fn wake(&self) {
        *self.inner.work.lock().unwrap() = true;
        self.inner.wake.notify_all();
    }

    /// Les autres modifications des tags passent après le travail en cours.
    pub fn hold(&self) -> MutexGuard<'_, ()> {
        self.inner.hold.lock().unwrap()
    }
}

fn worker_loop(inner: &Inner) {
    loop {
        {
            let mut work = inner.work.lock().unwrap();
            while !*work {
                work = inner.wake.wait(work).unwrap();
            }
            *work = false;
        }
        match db::open(&inner.db) {
            Ok(mut conn) => {
                let _hold = inner.hold.lock().unwrap();
                run(inner, &mut conn);
            }
            Err(e) => eprintln!("[tags] {e:#}"),
        }
        *inner.progress.lock().unwrap() = None;
        let _ = inner.app.emit(EVENT, None::<Progress>);
    }
}

fn set_progress(inner: &Inner, progress: Progress) {
    *inner.progress.lock().unwrap() = Some(progress.clone());
    let _ = inner.app.emit(EVENT, Some(progress));
}

/// Tout ce qui attend, paquet par paquet ; un paquet en erreur : son premier travail est abandonné (signalé), pour que
/// la file ne reste jamais bloquée.
fn run(inner: &Inner, conn: &mut Connection) {
    let mut done = 0;
    loop {
        let next: Option<(i64, u64)> = conn
            .row("SELECT (SELECT kind FROM tag_jobs ORDER BY seq LIMIT 1), COUNT(*) FROM tag_jobs", [], |r| Ok((r.get::<_, Option<i64>>(0)?, r.get::<_, i64>(1)?)))
            .ok()
            .and_then(|(k, n)| k.map(|k| (k, n as u64)));
        let Some((kind, left)) = next else { return };
        set_progress(inner, Progress { kind, done, total: done + left });
        match slice(conn) {
            Ok(n) => done += n,
            Err(e) => {
                eprintln!("[tags] travail abandonné : {e:#}");
                let _ = conn.execute("DELETE FROM tag_jobs WHERE seq = (SELECT MIN(seq) FROM tag_jobs)", []);
                done += 1;
            }
        }
    }
}

/// Une ligne de la file.
struct Job {
    seq: i64,
    request: i64,
    kind: i64,
    target: i64,
    strip: bool,
    remove_posed: bool,
    info: Option<Info>,
    at: i64,
}

/// Les travaux en tête de file qui se suivent avec la même sorte (et la même demande pour une suppression définitive) :
/// l'ordre des demandes est toujours respecté.
fn head(conn: &Connection) -> rusqlite::Result<Vec<Job>> {
    let all: Vec<Job> = conn
        .prepare_cached(
            "SELECT seq, request, kind, target, strip, remove_posed, name, category_id, hidden, media, rules, synonyms, at
               FROM tag_jobs ORDER BY seq LIMIT 2000",
        )?
        .query_map([], |r| {
            let name: Option<String> = r.get(6)?;
            Ok(Job {
                seq: r.get(0)?,
                request: r.get(1)?,
                kind: r.get(2)?,
                target: r.get(3)?,
                strip: r.get(4)?,
                remove_posed: r.get(5)?,
                info: match name {
                    Some(name) => Some(Info { name, category: r.get(7)?, hidden: r.get(8)?, media: r.get(9)?, rules: r.get(10)?, synonyms: r.get(11)? }),
                    None => None,
                },
                at: r.get::<_, Option<i64>>(12)?.unwrap_or_default(),
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    let Some((kind, request)) = all.first().map(|j| (j.kind, j.request)) else { return Ok(all) };
    Ok(all.into_iter().take_while(|j| j.kind == kind && (kind != PERMANENT || j.request == request)).collect())
}

/// Un paquet, dans une transaction : la suppression définitive d'une demande d'un coup (ses tags se répondent : groupes,
/// règles), les mises à la corbeille et les restaurations une par une, jusqu'à 150 ms. Renvoie le nombre de tags traités.
fn slice(conn: &mut Connection) -> anyhow::Result<u64> {
    let start = Instant::now();
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let jobs = head(&tx)?;
    let Some(first) = jobs.first() else { return Ok(0) };
    let mut n = 0;
    match first.kind {
        PERMANENT => {
            // Toute la demande d'un coup (la tête de file n'en lit qu'une partie).
            let ids: Vec<i64> = tx
                .prepare_cached("SELECT target FROM tag_jobs WHERE kind = ?1 AND request = ?2 ORDER BY seq")?
                .query_map(params![PERMANENT, first.request], |r| r.get(0))?
                .collect::<rusqlite::Result<_>>()?;
            tag_delete::delete(&tx, &ids, false, first.strip, first.remove_posed)?;
            tx.execute("DELETE FROM tag_jobs WHERE kind = ?1 AND request = ?2", params![PERMANENT, first.request])?;
            n = ids.len() as u64;
        }
        TRASH => {
            trash_journal::start(&tx)?;
            for j in &jobs {
                if n > 0 && start.elapsed() >= SLICE {
                    break;
                }
                if let Some(info) = &j.info {
                    tag_trash::trash_one(&tx, j.target, info, j.at, j.strip, j.remove_posed)?;
                }
                tx.execute("DELETE FROM tag_jobs WHERE seq = ?1", [j.seq])?;
                n += 1;
            }
            trash_journal::stop(&tx)?;
        }
        _ => {
            let mut names = tag_trash::trash_names(&tx)?;
            for j in &jobs {
                if n > 0 && start.elapsed() >= SLICE {
                    break;
                }
                tag_trash::restore_one(&tx, j.target, &mut names)?;
                tx.execute("DELETE FROM tag_jobs WHERE seq = ?1", [j.seq])?;
                n += 1;
            }
        }
    }
    tx.commit()?;
    Ok(n)
}

fn next_request(db: &Connection) -> rusqlite::Result<i64> {
    db.row("SELECT COALESCE(MAX(request), 0) + 1 FROM tag_jobs", [], |r| r.get(0))
}

/// « Supprimer » (corbeille ou définitif) : l'ordre et les liens de chaque tag sont relevés maintenant, avant toute
/// suppression (comme avant TAGM-23) ; renvoie les tags concernés (ceux demandés, plus les tags fusionnés qui partent avec
/// leur principal).
pub fn enqueue_delete(db: &Connection, ids: &[i64], with_merged: bool, strip: bool, remove_posed: bool, permanent: bool) -> anyhow::Result<Vec<PendingTag>> {
    let request = next_request(db)?;
    let now = db::now_ms();
    let mut out = Vec::new();
    let mut insert = db.prepare_cached(
        "INSERT INTO tag_jobs (request, kind, target, strip, remove_posed, name, category_id, hidden, media, rules, synonyms, at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
    )?;
    if permanent {
        for id in tag_delete::expand(db, ids, with_merged)? {
            let Ok(name) = db.row("SELECT name FROM tags WHERE id = ?1", [id], |r| r.get::<_, String>(0)) else { continue };
            insert.execute(params![request, PERMANENT, id, strip, remove_posed, None::<String>, None::<i64>, None::<bool>, None::<i64>, None::<i64>, None::<i64>, now])?;
            out.push(PendingTag { id, name });
        }
        return Ok(out);
    }
    for (id, i) in tag_trash::plan(db, ids, with_merged)? {
        insert.execute(params![request, TRASH, id, strip, remove_posed, i.name, i.category, i.hidden, i.media, i.rules, i.synonyms, now])?;
        out.push(PendingTag { id, name: i.name });
    }
    Ok(out)
}

/// « Restaurer », « Tout restaurer » : les plus récemment supprimés d'abord.
pub fn enqueue_restore(db: &Connection, ids: &[i64]) -> anyhow::Result<Vec<i64>> {
    let request = next_request(db)?;
    let ordered = tag_trash::by_recent(db, ids)?;
    let mut insert = db.prepare_cached("INSERT INTO tag_jobs (request, kind, target) VALUES (?1, ?2, ?3)")?;
    for &id in &ordered {
        insert.execute(params![request, RESTORE, id])?;
    }
    Ok(ordered)
}

/// Ce qui attend encore (tags cachés par l'interface, lignes de la corbeille en cours de restauration) et l'avancement.
#[tauri::command]
pub async fn tag_jobs_state(state: State<'_, AppState>) -> Result<JobsState, String> {
    let progress = state.tag_jobs.inner.progress.lock().unwrap().clone();
    let db = state.db.lock().unwrap();
    (|| -> rusqlite::Result<JobsState> {
        let tags = db
            .prepare("SELECT j.target, COALESCE(j.name, t.name, '') FROM tag_jobs j LEFT JOIN tags t ON t.id = j.target WHERE j.kind != ?1 ORDER BY j.seq")?
            .query_map([RESTORE], |r| Ok(PendingTag { id: r.get(0)?, name: r.get(1)? }))?
            .collect::<rusqlite::Result<_>>()?;
        let trash = db.prepare("SELECT target FROM tag_jobs WHERE kind = ?1 ORDER BY seq")?.query_map([RESTORE], |r| r.get(0))?.collect::<rusqlite::Result<_>>()?;
        Ok(JobsState { tags, trash, progress })
    })()
    .map_err(|e| e.to_string())
}
