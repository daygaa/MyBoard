//! Compression des images à l'import (IMP-20, IMP-27, IMP-60, D-058) : la version compressée est écrite À CÔTÉ
//! de l'original (« photo (compressé).jpg »), avec ses dates ; l'original n'est jamais modifié. Elle n'est gardée que
//! si elle est au moins 5 % plus légère.

use std::fs::{File, FileTimes, Metadata, OpenOptions};
use std::io::{ErrorKind, Read, Write};
use std::path::{Path, PathBuf};

use anyhow::{Context, bail};
use serde::Deserialize;

/// Options de compression choisies pour l'import.
#[derive(Clone, Copy)]
pub struct Compress {
    /// Qualité 20 à 95 (IMP-20).
    pub quality: u8,
    /// Réponse « Compresser aussi » de la pop-in : images déjà dans la bibliothèque au même endroit (IMP-60).
    pub existing: bool,
}

/// Options de la carte « Options d'import » (IMP-30) envoyées au lancement de l'import.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportOptions {
    /// Qualité si « Compresser les images » est cochée.
    pub compress_quality: Option<u8>,
    /// Réponse « Compresser aussi » de la pop-in (IMP-60).
    pub compress_existing: bool,
}

impl ImportOptions {
    pub fn compress(&self) -> Option<Compress> {
        self.compress_quality.map(|q| Compress { quality: q.clamp(20, 95), existing: self.compress_existing })
    }
}

/// Ce que la compression a donné pour un fichier (compté dans la progression).
#[derive(Clone, Copy)]
pub enum Squeeze {
    Done,
    /// Pas au moins 5 % plus légère : l'original est gardé.
    NotSmaller,
    /// Lecture, encodage ou écriture impossible : l'original est importé tel quel.
    Failed,
}

/// Version compressée prête à écrire.
pub struct Encoded {
    pub bytes: Vec<u8>,
    pub hash: String,
}

const SUFFIX: &str = " (compressé";

/// JPEG ou WebP, et pas déjà compressé par MyBoard (le recompresser abîmerait encore l'image).
pub fn eligible(path: &Path, ext: &str) -> bool {
    matches!(ext, "jpg" | "jpeg" | "jpe" | "jfif" | "webp") && !already_compressed(path)
}

/// WebP animé (drapeau de l'en-tête VP8X, lu dans les 21 premiers octets) : jamais compressé.
pub fn animated_webp(path: &Path) -> bool {
    let mut head = [0u8; 21];
    File::open(path).and_then(|mut f| f.read_exact(&mut head)).is_ok() && &head[12..16] == b"VP8X" && head[20] & 0x02 != 0
}

/// Nom « … (compressé) » ou « … (compressé 2) ».
fn already_compressed(path: &Path) -> bool {
    let stem = path.file_stem().map(|s| s.to_string_lossy()).unwrap_or_default();
    let Some(rest) = stem.strip_suffix(')').and_then(|s| s.rfind(SUFFIX).map(|i| &s[i + SUFFIX.len()..])) else {
        return false;
    };
    rest.is_empty() || rest.strip_prefix(' ').is_some_and(|n| !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()))
}

/// Réencode le fichier ; `Ok(None)` : pas au moins 5 % plus léger, ou image à ne jamais compresser (`animated`).
pub fn encode(path: &Path, quality: u8, animated: &mut bool) -> anyhow::Result<Option<Encoded>> {
    let original = std::fs::read(path)?;
    let Some(bytes) = super::encode::reencode(&original, quality)? else {
        *animated = true;
        return Ok(None);
    };
    if bytes.len() as u64 * 100 > original.len() as u64 * 95 {
        return Ok(None);
    }
    let hash = blake3::hash(&bytes).to_hex().to_string();
    Ok(Some(Encoded { bytes, hash }))
}

/// Écrit la version compressée à côté de l'original, sous un nom libre, avec les dates de l'original (le tri
/// « Date de création » utilise celle du fichier). D'abord sous un nom provisoire : jamais de fichier à moitié écrit.
pub fn write_beside(original: &Path, meta: &Metadata, bytes: &[u8]) -> anyhow::Result<PathBuf> {
    let target = free_name(original)?;
    let tmp = target.with_file_name(format!("{}.myboard-tmp", target.file_name().unwrap_or_default().to_string_lossy()));
    // Reste d'une écriture interrompue de MyBoard (même nom provisoire) : remplacé.
    let _ = std::fs::remove_file(&tmp);
    let written = (|| -> anyhow::Result<()> {
        let mut file = OpenOptions::new().write(true).create_new(true).open(&tmp)?;
        file.write_all(bytes)?;
        copy_times(meta, &file)?;
        file.sync_all()?;
        Ok(())
    })();
    if let Err(e) = written {
        let _ = std::fs::remove_file(&tmp);
        return Err(e.context("écriture du fichier compressé"));
    }
    // Un lien échoue si le nom a été pris entre-temps, contrairement à un renommage qui écraserait le fichier.
    let placed = match std::fs::hard_link(&tmp, &target) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == ErrorKind::AlreadyExists => Err(anyhow::Error::from(e)),
        // Disque sans liens (clé USB en FAT32, exFAT) : renommage, après une dernière vérification.
        Err(_) if !target.exists() => std::fs::rename(&tmp, &target).map_err(anyhow::Error::from),
        Err(e) => Err(e.into()),
    };
    let _ = std::fs::remove_file(&tmp);
    placed.with_context(|| format!("placement de {}", target.display()))?;
    Ok(target)
}

/// « photo (compressé).jpg », sinon « photo (compressé 2).jpg »… (même extension que l'original).
fn free_name(original: &Path) -> anyhow::Result<PathBuf> {
    let stem = original.file_stem().context("nom de fichier vide")?.to_string_lossy();
    let ext = original.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
    for n in 1..1000 {
        let label = if n == 1 { String::new() } else { format!(" {n}") };
        let candidate = original.with_file_name(format!("{stem}{SUFFIX}{label}){ext}"));
        if std::fs::symlink_metadata(&candidate).is_err() {
            return Ok(candidate);
        }
    }
    bail!("aucun nom libre pour la version compressée")
}

fn copy_times(meta: &Metadata, file: &File) -> std::io::Result<()> {
    let mut times = FileTimes::new();
    if let Ok(modified) = meta.modified() {
        times = times.set_modified(modified);
    }
    #[cfg(windows)]
    if let Ok(created) = meta.created() {
        use std::os::windows::fs::FileTimesExt;
        times = times.set_created(created);
    }
    file.set_times(times)
}
