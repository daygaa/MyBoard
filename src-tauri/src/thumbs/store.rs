//! Rangement des miniatures dans un seul fichier SQLite (`thumbs.db`), voir D-014.
//!
//! Mesuré le 11/10/2026 : sous Windows, la PREMIÈRE ouverture de chaque petit fichier par
//! MyBoard coûte ~7,7 ms (analyse antivirus en temps réel), soit ~3,6 s pour une page de
//! 475 miniatures stockées en fichiers séparés. Dans un seul fichier : 17 ms.

use std::path::Path;

use rusqlite::{Connection, OpenFlags, OptionalExtension, params};

/// Taille de page SQLite standard (4 Ko) : essayé 32 Ko, mais une seule miniature tenait
/// par page et le fichier doublait de taille (3,1 Go au lieu de 1,6 Go pour 95 000).
const SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS thumbs (
        hash TEXT PRIMARY KEY,   -- hash BLAKE3 du média
        data BLOB NOT NULL       -- miniature WebP
    );";

/// Ouvre (ou crée) le fichier des miniatures en écriture.
pub fn open_writer(path: &Path) -> anyhow::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(SCHEMA)?;
    conn.pragma_update_and_check(None, "journal_mode", "WAL", |row| row.get::<_, String>(0))?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "busy_timeout", 5000)?;
    Ok(conn)
}

/// Connexion en lecture seule (serveur des miniatures).
pub fn open_reader(path: &Path) -> anyhow::Result<Connection> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX)?;
    conn.pragma_update(None, "busy_timeout", 5000)?;
    Ok(conn)
}

pub fn put(conn: &Connection, hash: &str, webp: &[u8]) -> rusqlite::Result<()> {
    conn.prepare_cached("INSERT OR REPLACE INTO thumbs (hash, data) VALUES (?1, ?2)")?
        .execute(params![hash, webp])?;
    Ok(())
}

pub fn get(conn: &Connection, hash: &str) -> rusqlite::Result<Option<Vec<u8>>> {
    conn.prepare_cached("SELECT data FROM thumbs WHERE hash = ?1")?
        .query_row([hash], |row| row.get(0))
        .optional()
}
