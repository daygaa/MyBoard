//! Ouverture de la base SQLite et migrations du schéma.

use std::path::Path;

use anyhow::Context;
use rusqlite::Connection;

/// Migrations dans l'ordre : l'indice + 1 = numéro de version (`PRAGMA user_version`).
const MIGRATIONS: &[&str] = &[include_str!("schema_v1.sql")];

/// Ouvre une connexion avec les réglages communs à toute l'application.
pub fn open(path: &Path) -> anyhow::Result<Connection> {
    let conn = Connection::open(path)
        .with_context(|| format!("ouverture de la base {}", path.display()))?;
    // WAL : les lectures de l'interface ne sont jamais bloquées par l'import en cours.
    conn.pragma_update_and_check(None, "journal_mode", "WAL", |row| row.get::<_, String>(0))?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    // Plusieurs fils écrivent (import, miniatures) : on attend au lieu d'échouer.
    conn.pragma_update(None, "busy_timeout", 5000)?;
    conn.pragma_update(None, "temp_store", "MEMORY")?;
    conn.pragma_update(None, "cache_size", -32000)?; // 32 Mo
    Ok(conn)
}

/// Amène le schéma à la dernière version, chaque migration dans sa propre transaction.
pub fn migrate(conn: &mut Connection) -> anyhow::Result<()> {
    let current: i64 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(current as usize) {
        let version = index as i64 + 1;
        let tx = conn.transaction()?;
        tx.execute_batch(sql)
            .with_context(|| format!("migration du schéma vers la version {version}"))?;
        tx.pragma_update(None, "user_version", version)?;
        tx.commit()?;
    }
    Ok(())
}

/// Ouvre la base et applique les migrations.
pub fn open_and_migrate(path: &Path) -> anyhow::Result<Connection> {
    let mut conn = open(path)?;
    migrate(&mut conn)?;
    Ok(conn)
}

/// Heure actuelle en millisecondes depuis 1970.
pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
