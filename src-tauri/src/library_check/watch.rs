//! Vérification de l'ouverture et surveillance des emplacements pendant la séance (LIB-05, LIB-14) : voir `mod.rs`.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use rusqlite::{Connection, params};
use tauri::{AppHandle, Emitter, Manager};

use super::{MissingMedia, NEW_ROOTS, OFFLINE, OfflineRoot, Presence, RECHECK_EVERY, Row, add, presence, reachable, root_of, update};
use crate::{AppState, db};

pub(super) fn check(app: &AppHandle, db_path: &Path) -> anyhow::Result<()> {
    update(app, |s| s.state.running = true);
    let mut conn = db::open(db_path)?;
    let rows: Vec<Row> = conn
        .prepare("SELECT id, hash, file_name, path, kind, missing_since IS NOT NULL FROM media WHERE pending_delete = 0 ORDER BY path")?
        .query_map([], row)?
        .collect::<rusqlite::Result<_>>()?;
    let mut roots: HashMap<PathBuf, bool> = HashMap::new();
    let mut away: HashMap<PathBuf, Vec<Row>> = HashMap::new();
    let mut present = Vec::new();
    for row in rows {
        let root = root_of(Path::new(&row.item.path));
        if !*roots.entry(root.clone()).or_insert_with(|| reachable(&root)) {
            away.entry(root).or_default().push(row);
            continue;
        }
        present.push(row);
    }
    let missing = sort(&mut conn, present)?;
    set_offline(&away);
    update(app, |s| {
        s.state.running = false;
        add(s, missing);
        s.state.offline = offline_list(&away);
    });
    let _ = app.emit("library-changed", ());
    retry(app);
    let mut watched: HashSet<PathBuf> = roots.into_iter().filter(|(r, ok)| *ok && !r.as_os_str().is_empty()).map(|(r, _)| r).collect();
    loop {
        std::thread::sleep(RECHECK_EVERY);
        watched.extend(NEW_ROOTS.lock().unwrap().drain(..).filter(|r| !r.as_os_str().is_empty() && !away.contains_key(r)));
        // Débranchés pendant la séance : leurs médias passent « inaccessibles ».
        let gone: Vec<PathBuf> = watched.iter().filter(|r| !reachable(r)).cloned().collect();
        if !gone.is_empty() {
            for root in gone {
                watched.remove(&root);
                let rows = rows_of(&conn, &root)?;
                away.insert(root, rows);
            }
            set_offline(&away);
            update(app, |s| s.state.offline = offline_list(&away));
            let _ = app.emit("library-changed", ());
        }
        let back: Vec<PathBuf> = away.keys().filter(|r| reachable(r)).cloned().collect();
        if back.is_empty() {
            continue;
        }
        // Rebranchés : bandeau et marques retirés aussitôt, puis les fichiers revenus sont vérifiés (100 000 : ~10 s).
        let rows: Vec<Row> = back.iter().flat_map(|root| away.remove(root).unwrap_or_default()).collect();
        for root in &back {
            reset_errors(&conn, root)?;
        }
        watched.extend(back);
        set_offline(&away);
        update(app, |s| s.state.offline = offline_list(&away));
        let _ = app.emit("library-changed", ());
        let found = sort(&mut conn, rows)?;
        retry(app);
        if !found.is_empty() {
            update(app, |s| add(s, found));
            let _ = app.emit("library-changed", ());
        }
    }
}

/// Médias d'un emplacement (devenu inaccessible pendant la séance).
fn rows_of(conn: &Connection, root: &Path) -> rusqlite::Result<Vec<Row>> {
    let root = root.to_string_lossy();
    conn.prepare(
        "SELECT id, hash, file_name, path, kind, missing_since IS NOT NULL FROM media
         WHERE pending_delete = 0 AND substr(path, 1, ?1) = ?2 COLLATE NOCASE",
    )?
    .query_map(params![root.chars().count() as i64, root], row)?
    .collect()
}

fn row(r: &rusqlite::Row) -> rusqlite::Result<Row> {
    Ok(Row { item: MissingMedia { id: r.get(0)?, hash: r.get(1)?, file_name: r.get(2)?, path: r.get(3)?, kind: r.get(4)? }, marked: r.get(5)? })
}

/// Miniatures ratées pendant que l'emplacement était débranché : refaites.
fn reset_errors(conn: &Connection, root: &Path) -> rusqlite::Result<()> {
    let root = root.to_string_lossy();
    conn.execute(
        "UPDATE media SET thumb_status = 0 WHERE thumb_status = ?1 AND substr(path, 1, ?2) = ?3 COLLATE NOCASE",
        params![crate::thumbs::status::ERROR, root.chars().count() as i64, root],
    )?;
    Ok(())
}

/// Fichiers revus : leurs grands aperçus ratés sont réessayés, les miniatures refaites (retour du 11/11, LIB-05).
fn retry(app: &AppHandle) {
    if let Some(state) = app.try_state::<AppState>() {
        state.previews.retry_failed();
        state.thumbs.wake();
    }
}

/// Fichiers d'emplacements accessibles : renvoie les disparus pas encore réglés ; ceux revus perdent leur marque.
fn sort(conn: &mut Connection, rows: Vec<Row>) -> anyhow::Result<Vec<MissingMedia>> {
    let mut missing = Vec::new();
    let mut seen_again = Vec::new();
    for row in rows {
        match (presence(Path::new(&row.item.path)), row.marked) {
            (Presence::Missing, false) => missing.push(row.item),
            (Presence::Present, true) => seen_again.push(row.item.id),
            _ => {}
        }
    }
    if !seen_again.is_empty() {
        let tx = conn.transaction()?;
        for id in seen_again {
            tx.execute(
                "UPDATE media SET missing_since = NULL, thumb_status = CASE WHEN thumb_status = ?1 THEN 0 ELSE thumb_status END WHERE id = ?2",
                params![crate::thumbs::status::ERROR, id],
            )?;
        }
        tx.commit()?;
    }
    Ok(missing)
}

fn set_offline(away: &HashMap<PathBuf, Vec<Row>>) {
    *OFFLINE.write().unwrap() = away.keys().map(|r| r.to_string_lossy().to_lowercase()).collect();
}

fn offline_list(away: &HashMap<PathBuf, Vec<Row>>) -> Vec<OfflineRoot> {
    let mut list: Vec<OfflineRoot> = away.iter().map(|(r, rows)| OfflineRoot { root: r.display().to_string(), count: rows.len() as u64 }).collect();
    list.sort_by(|a, b| a.root.cmp(&b.root));
    list
}
