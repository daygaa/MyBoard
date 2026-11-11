//! Écriture d'une version compressée ou convertie À CÔTÉ de l'original (IMP-20, IMP-21, IMP-27, IMP-65, D-058), avec
//! ses dates ; l'original n'est jamais modifié (il n'est effacé que si « Supprimer les originaux » est cochée, IMP-28,
//! après coup). Version gardée seulement si elle est au moins 5 % plus légère. Noms (réponses du 10/11) : compressée
//! « photo_c.jpg » ; convertie « photo.webp » ; convertie et compressée « photo_c.webp » ; nom pris : « photo_c (1).jpg »,
//! ou « photo (1).webp » pour une version seulement convertie (réponse QC du 11/11). Les vidéos (`video`) utilisent les
//! mêmes noms et le même placement.

use std::fs::{File, FileTimes, Metadata, OpenOptions};
use std::io::{ErrorKind, Read, Write};
use std::path::{Path, PathBuf};

use anyhow::{Context, bail};

use super::plan::Action;

/// Ce que le traitement a donné pour un fichier (compté dans la progression).
#[derive(Clone, Copy)]
pub enum Squeeze {
    Compressed,
    Converted,
    /// Pas au moins 5 % plus légère : l'original est gardé.
    NotSmaller,
    /// Lecture, encodage ou écriture impossible : l'original est importé tel quel.
    Failed,
    /// Vidéo dans un ancien format (MPEG-4 / Xvid, WMV…) : jamais compressée, signalée (réponse QB du 11/11).
    Unsupported,
}

/// Version prête à écrire.
pub struct Encoded {
    pub bytes: Vec<u8>,
    pub hash: String,
}

/// GIF ou WebP animé : jamais compressé ni converti (WebP : 21 premiers octets ; GIF : deux images au moins).
pub fn animated(path: &Path) -> bool {
    let ext = path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    match ext.as_str() {
        "webp" => {
            let mut head = [0u8; 21];
            File::open(path).and_then(|mut f| f.read_exact(&mut head)).is_ok() && super::encode::animated_webp(&head)
        }
        "gif" => std::fs::read(path).ok().and_then(|b| {
            use image::AnimationDecoder;
            let frames = image::codecs::gif::GifDecoder::new(std::io::Cursor::new(b)).ok()?.into_frames().take(2).count();
            Some(frames > 1)
        }) == Some(true),
        _ => false,
    }
}

/// Réencode le fichier ; `Ok(None)` : pas au moins 5 % plus léger, ou image animée (`animated`).
pub fn encode(path: &Path, action: Action, animated: &mut bool) -> anyhow::Result<Option<Encoded>> {
    let original = std::fs::read(path)?;
    let Some(bytes) = super::encode::reencode(&original, action)? else {
        *animated = true;
        return Ok(None);
    };
    // Seule une compression doit faire gagner au moins 5 % ; une conversion est toujours gardée (IMP-70, 11/11).
    if matches!(action, Action::Compress(_)) && bytes.len() as u64 * 100 > original.len() as u64 * 95 {
        return Ok(None);
    }
    let hash = blake3::hash(&bytes).to_hex().to_string();
    Ok(Some(Encoded { bytes, hash }))
}

/// Extension et suffixe « _c » du fichier écrit pour cette action.
pub fn naming(action: Action, original: &Path) -> (String, bool) {
    match action {
        Action::Compress(_) => (original.extension().map(|e| e.to_string_lossy().into_owned()).unwrap_or_default(), true),
        Action::Convert { target, compressed, .. } => (target.ext().to_owned(), compressed),
        // Le nom d'une vidéo dépend de son codec : décidé par `video::process`.
        Action::Video(_) => (String::new(), false),
    }
}

/// Écrit la version à côté de l'original, sous un nom libre, avec les dates de l'original (le tri « Date de création »
/// utilise celle du fichier). D'abord sous un nom provisoire : jamais de fichier à moitié écrit.
pub fn write_beside(original: &Path, meta: &Metadata, bytes: &[u8], ext: &str, suffix: bool) -> anyhow::Result<PathBuf> {
    let target = free_name(original, ext, suffix)?;
    let tmp = tmp_of(&target);
    // Reste d'une écriture interrompue de MyBoard (même nom provisoire) : remplacé.
    let _ = std::fs::remove_file(&tmp);
    let written = (|| -> anyhow::Result<()> {
        let mut file = OpenOptions::new().write(true).create_new(true).open(&tmp)?;
        file.write_all(bytes)?;
        Ok(())
    })();
    if let Err(e) = written {
        let _ = std::fs::remove_file(&tmp);
        return Err(e.context("écriture de la nouvelle version"));
    }
    place(&tmp, &target, meta)?;
    Ok(target)
}

/// Nom provisoire, à côté du nom final : « video_c.mp4.myboard-tmp ».
pub fn tmp_of(target: &Path) -> PathBuf {
    target.with_file_name(format!("{}.myboard-tmp", target.file_name().unwrap_or_default().to_string_lossy()))
}

/// Donne au fichier provisoire les dates de l'original, l'écrit sur le disque, puis le place sous son nom final.
pub fn place(tmp: &Path, target: &Path, meta: &Metadata) -> anyhow::Result<()> {
    let synced = (|| -> std::io::Result<()> {
        let file = OpenOptions::new().write(true).open(tmp)?;
        copy_times(meta, &file)?;
        file.sync_all()
    })();
    if let Err(e) = synced {
        let _ = std::fs::remove_file(tmp);
        return Err(anyhow::Error::from(e).context("écriture de la nouvelle version"));
    }
    // Un lien échoue si le nom a été pris entre-temps, contrairement à un renommage qui écraserait le fichier.
    let placed = match std::fs::hard_link(tmp, target) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == ErrorKind::AlreadyExists => Err(anyhow::Error::from(e)),
        // Disque sans liens (clé USB en FAT32, exFAT) : renommage, après une dernière vérification.
        Err(_) if !target.exists() => std::fs::rename(tmp, target).map_err(anyhow::Error::from),
        Err(e) => Err(e.into()),
    };
    let _ = std::fs::remove_file(tmp);
    placed.with_context(|| format!("placement de {}", target.display()))
}

/// « photo_c.jpg » (ou « photo.webp » sans suffixe), sinon « photo_c (1).jpg » (ou « photo (1).webp »)…
pub fn free_name(original: &Path, ext: &str, suffix: bool) -> anyhow::Result<PathBuf> {
    let stem = original.file_stem().context("nom de fichier vide")?.to_string_lossy();
    let dot = if ext.is_empty() { String::new() } else { format!(".{ext}") };
    let first = original.with_file_name(format!("{stem}{}{dot}", if suffix { "_c" } else { "" }));
    if free(&first, original) {
        return Ok(first);
    }
    for n in 1..1000 {
        let candidate = original.with_file_name(format!("{stem}{} ({n}){dot}", if suffix { "_c" } else { "" }));
        if free(&candidate, original) {
            return Ok(candidate);
        }
    }
    bail!("aucun nom libre pour la nouvelle version")
}

/// Nom libre, et jamais celui de l'original (Windows ne distingue pas les majuscules).
fn free(candidate: &Path, original: &Path) -> bool {
    std::fs::symlink_metadata(candidate).is_err()
        && !candidate.to_string_lossy().eq_ignore_ascii_case(&original.to_string_lossy())
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
