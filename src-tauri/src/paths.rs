//! Emplacement des données de l'application (base + miniatures).
//!
//! Par défaut `%LOCALAPPDATA%\MyBoard` (disque système, SSD : LIB-07).
//! La variable MYBOARD_DATA_DIR permet d'utiliser un autre dossier
//! (bibliothèque de test, mesures) sans toucher à la vraie bibliothèque.

use std::path::PathBuf;

use anyhow::Context;

#[derive(Clone, Debug)]
pub struct DataPaths {
    pub root: PathBuf,
    /// Base principale : médias, tags, favoris, dossiers.
    pub db: PathBuf,
    /// Miniatures, toutes dans un seul fichier (D-014).
    pub thumbs_db: PathBuf,
}

impl DataPaths {
    /// Crée le dossier si besoin.
    pub fn at(root: PathBuf) -> anyhow::Result<Self> {
        std::fs::create_dir_all(&root).with_context(|| format!("création du dossier {}", root.display()))?;
        Ok(Self { db: root.join("myboard.db"), thumbs_db: root.join("thumbs.db"), root })
    }

    /// Dossier choisi : MYBOARD_DATA_DIR, sinon `<données locales>\MyBoard`.
    pub fn resolve(default_parent: PathBuf) -> anyhow::Result<Self> {
        let root = std::env::var_os("MYBOARD_DATA_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| default_parent.join("MyBoard"));
        Self::at(root)
    }
}

/// Un hash BLAKE3 en hexadécimal : 64 caractères 0-9 a-f.
pub fn is_valid_hash(hash: &str) -> bool {
    hash.len() == 64 && hash.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}
