//! Rangement des miniatures dans un seul fichier SQLite (`thumbs.db`), voir D-014.
//!
//! Mesuré le 11/10/2026 : sous Windows, la PREMIÈRE ouverture de chaque petit fichier par
//! MyBoard coûte ~7,7 ms (analyse antivirus en temps réel), soit ~3,6 s pour une page de
//! 475 miniatures stockées en fichiers séparés. Dans un seul fichier : 17 ms.
//!
//! Quatre tailles (D-011, D-015, LIB-16) :
//! - `thumbs` : miniature 320 px, créée après l'import ;
//! - `thumbs_small` : 128 px, créée en même temps, pour les petites vignettes (LIB-12) ;
//! - `previews` et `previews_large` : grands aperçus 640 et 1 280 px, créés à la demande pour les
//!   grandes vignettes (LIB-09, LIB-16), dans un cache commun de taille limitée : les moins
//!   récemment demandés sont supprimés (LIB-10).

use std::path::Path;

use rusqlite::{Connection, OpenFlags, OptionalExtension, params};

/// Taille de page SQLite standard (4 Ko) : essayé 32 Ko, mais une seule miniature tenait
/// par page et le fichier doublait de taille (3,1 Go au lieu de 1,6 Go pour 95 000).
const SCHEMA: &str = "
    CREATE TABLE IF NOT EXISTS thumbs (
        hash TEXT PRIMARY KEY,   -- hash BLAKE3 du média
        data BLOB NOT NULL       -- WebP 320 px
    );
    CREATE TABLE IF NOT EXISTS thumbs_small (
        hash TEXT PRIMARY KEY,
        data BLOB NOT NULL       -- WebP 128 px
    );
    CREATE TABLE IF NOT EXISTS previews (
        hash      TEXT PRIMARY KEY,
        data      BLOB NOT NULL, -- WebP 640 px
        bytes     INTEGER NOT NULL,
        last_used INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS previews_last_used ON previews (last_used);
    CREATE TABLE IF NOT EXISTS previews_large (
        hash      TEXT PRIMARY KEY,
        data      BLOB NOT NULL, -- WebP 1 280 px (LIB-16)
        bytes     INTEGER NOT NULL,
        last_used INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS previews_large_last_used ON previews_large (last_used);";

/// Les quatre tailles servies à l'interface.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Tier {
    Normal,
    Small,
    Preview,
    Large,
}

/// Tables du cache des grands aperçus (taille limitée en commun).
pub const PREVIEW_TABLES: [&str; 2] = ["previews", "previews_large"];

impl Tier {
    fn table(self) -> &'static str {
        match self {
            Tier::Normal => "thumbs",
            Tier::Small => "thumbs_small",
            Tier::Preview => "previews",
            Tier::Large => "previews_large",
        }
    }
}

/// Ouvre (ou crée) le fichier des miniatures en écriture.
pub fn open_writer(path: &Path) -> anyhow::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(SCHEMA)?;
    conn.pragma_update_and_check(None, "journal_mode", "WAL", |row| row.get::<_, String>(0))?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "busy_timeout", 5000)?;
    Ok(conn)
}

/// Connexion en lecture seule (protocole `thumb://`).
pub fn open_reader(path: &Path) -> anyhow::Result<Connection> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX)?;
    conn.pragma_update(None, "busy_timeout", 5000)?;
    Ok(conn)
}

/// Enregistre les deux miniatures d'un média. Pas de transaction propre (l'appelant peut être
/// déjà dans une transaction) : si la 128 px manquait, elle serait refaite au lancement suivant.
pub fn put_thumbs(conn: &Connection, hash: &str, normal: &[u8], small: &[u8]) -> rusqlite::Result<()> {
    conn.prepare_cached("INSERT OR REPLACE INTO thumbs (hash, data) VALUES (?1, ?2)")?
        .execute(params![hash, normal])?;
    put_small(conn, hash, small)
}

pub fn put_small(conn: &Connection, hash: &str, small: &[u8]) -> rusqlite::Result<()> {
    conn.prepare_cached("INSERT OR REPLACE INTO thumbs_small (hash, data) VALUES (?1, ?2)")?
        .execute(params![hash, small])?;
    Ok(())
}

pub fn get(conn: &Connection, tier: Tier, hash: &str) -> rusqlite::Result<Option<Vec<u8>>> {
    conn.prepare_cached(&format!("SELECT data FROM {} WHERE hash = ?1", tier.table()))?
        .query_row([hash], |row| row.get(0))
        .optional()
}

/// Miniatures 320 px qui n'ont pas encore leur version 128 px (bibliothèques d'avant LIB-12).
pub fn hashes_without_small(conn: &Connection) -> rusqlite::Result<Vec<String>> {
    let mut stmt = conn.prepare("SELECT hash FROM thumbs WHERE hash NOT IN (SELECT hash FROM thumbs_small)")?;
    let rows = stmt.query_map([], |row| row.get(0))?;
    rows.collect()
}

/// Le grand aperçu (640 ou 1 280 px) existe-t-il ? Si oui, il est marqué comme utilisé maintenant.
pub fn touch_preview(conn: &Connection, tier: Tier, hash: &str, now: i64) -> rusqlite::Result<bool> {
    let updated = conn
        .prepare_cached(&format!("UPDATE {} SET last_used = ?1 WHERE hash = ?2", tier.table()))?
        .execute(params![now, hash])?;
    Ok(updated > 0)
}

pub fn put_preview(conn: &Connection, tier: Tier, hash: &str, data: &[u8], now: i64) -> rusqlite::Result<()> {
    conn.prepare_cached(&format!("INSERT OR REPLACE INTO {} (hash, data, bytes, last_used) VALUES (?1, ?2, ?3, ?4)", tier.table()))?
        .execute(params![hash, data, data.len() as i64, now])?;
    Ok(())
}

/// Taille totale du cache des grands aperçus (les deux tailles).
pub fn previews_size(conn: &Connection) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT (SELECT COALESCE(SUM(bytes), 0) FROM previews) + (SELECT COALESCE(SUM(bytes), 0) FROM previews_large)",
        [],
        |row| row.get(0),
    )
}

/// Supprime les aperçus les moins récemment utilisés, toutes tailles confondues, jusqu'à repasser
/// sous `target` octets. Renvoie la nouvelle taille totale du cache.
pub fn evict_previews(conn: &Connection, mut total: i64, target: i64) -> rusqlite::Result<i64> {
    let tx = conn.unchecked_transaction()?;
    while total > target {
        // Les plus anciens d'abord, lus PUIS supprimés (jamais pendant la lecture).
        let oldest: Vec<(String, String, i64)> = tx
            .prepare(
                "SELECT 'previews', hash, bytes, last_used FROM previews
                 UNION ALL SELECT 'previews_large', hash, bytes, last_used FROM previews_large
                 ORDER BY last_used ASC LIMIT 200",
            )?
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?
            .collect::<Result<_, _>>()?;
        if oldest.is_empty() {
            break;
        }
        for (table, hash, bytes) in oldest {
            if total <= target {
                break;
            }
            tx.execute(&format!("DELETE FROM {table} WHERE hash = ?1"), [&hash])?;
            total -= bytes;
        }
    }
    tx.commit()?;
    Ok(total)
}
