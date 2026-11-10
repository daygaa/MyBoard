//! Table des versions écrites par MyBoard (IMP-68, schéma 20) : empreinte de la version → empreinte de l'original,
//! gardée même après la suppression des médias. Les empreintes de `media` sont en texte (hexadécimal) ; la table les
//! garde en 32 octets, deux fois moins de place.

use rusqlite::{Connection, OptionalExtension, params};

fn bytes(hex: &str) -> Option<[u8; 32]> {
    blake3::Hash::from_hex(hex).ok().map(|h| *h.as_bytes())
}

/// Note qu'un fichier est une version d'un original (sans effet si elle est déjà notée).
pub fn remember(conn: &Connection, version: &str, original: &str) -> rusqlite::Result<()> {
    let (Some(version), Some(original)) = (bytes(version), bytes(original)) else { return Ok(()) };
    conn.prepare_cached("INSERT OR IGNORE INTO versions (hash, original) VALUES (?1, ?2)")?
        .execute(params![version.as_slice(), original.as_slice()])?;
    Ok(())
}

/// Empreinte de l'original d'une version écrite par MyBoard (hexadécimal, comme dans `media`).
pub fn original_of(conn: &Connection, version: &str) -> rusqlite::Result<Option<String>> {
    let Some(version) = bytes(version) else { return Ok(None) };
    let found: Option<Vec<u8>> = conn
        .prepare_cached("SELECT original FROM versions WHERE hash = ?1")?
        .query_row([version.as_slice()], |r| r.get(0))
        .optional()?;
    Ok(found.and_then(|b| <[u8; 32]>::try_from(b.as_slice()).ok()).map(|b| blake3::Hash::from_bytes(b).to_hex().to_string()))
}
