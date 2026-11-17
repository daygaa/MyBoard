//! Table des versions écrites par MyBoard (IMP-68, schéma 20) : empreinte de la version → empreinte de l'original,
//! gardée même après la suppression des médias ; empreintes d'avant une rotation (VIEW-60, schéma 24). Les empreintes de `media` sont en texte (hexadécimal) ; la table les
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

/// Note l'empreinte qu'avait le fichier d'un média juste avant que MyBoard y écrive une rotation (VIEW-60, Q64 A).
pub fn remember_turned(conn: &Connection, before: &str, media: i64) -> rusqlite::Result<()> {
    let Some(before) = bytes(before) else { return Ok(()) };
    conn.prepare_cached("INSERT OR REPLACE INTO turned_hashes (hash, media_id) VALUES (?1, ?2)")?.execute(params![before.as_slice(), media])?;
    Ok(())
}

/// Média dont le fichier avait cette empreinte avant une rotation écrite par MyBoard (réponse Q64 A : doublon).
pub fn turned_media(conn: &Connection, hash: &str) -> rusqlite::Result<Option<i64>> {
    let Some(hash) = bytes(hash) else { return Ok(None) };
    conn.prepare_cached("SELECT media_id FROM turned_hashes WHERE hash = ?1")?.query_row([hash.as_slice()], |r| r.get(0)).optional()
}

/// Empreinte d'un fichier, lu par blocs (une vidéo peut peser plusieurs Go).
pub fn hash_file(path: &std::path::Path) -> std::io::Result<String> {
    let mut hasher = blake3::Hasher::new();
    std::io::copy(&mut std::fs::File::open(path)?, &mut hasher)?;
    Ok(hasher.finalize().to_hex().to_string())
}

/// Même empreinte, calculée sur plusieurs cœurs (fichier projeté en mémoire) : pour un fichier qu'on vient d'écrire et
/// que personne d'autre n'écrit (rotation, VIEW-60 ; retour 60.4 : MOV 4K de 684 Mo en ~0,5 s sur un seul cœur).
/// Projection impossible : lu par blocs, comme `hash_file`.
pub fn hash_file_parallel(path: &std::path::Path) -> std::io::Result<String> {
    let mut hasher = blake3::Hasher::new();
    match hasher.update_mmap_rayon(path) {
        Ok(_) => Ok(hasher.finalize().to_hex().to_string()),
        Err(_) => hash_file(path),
    }
}
