//! Recherche de ffmpeg / ffprobe sous Windows (IMP-48, IMP-49, D-012, D-070).
//!
//! La v8 cherchait ffmpeg avec une commande Linux (`which`) : introuvable sous Windows.
//! Ordre (réponse Q1 du 12/11) : MYBOARD_FFMPEG (essais), puis le ffmpeg du PC (PATH et emplacements
//! d'installation courants) s'il est complet (ffprobe et les encodeurs dont MyBoard se sert), puis la copie fournie
//! dans le dossier `ffmpeg` à côté de myboard.exe, enfin un ffmpeg du PC incomplet (mieux que rien : miniatures et
//! lecture). Chaque candidat est validé en le lançant, une fois par lancement ; tout reste sur le PC (GEN-01).
//! Interrupteur d'essai MYBOARD_SANS_FFMPEG : `1` = aucun ffmpeg, `pc` = celui du PC ignoré (copie fournie seule).

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde::Serialize;

/// Encodeurs dont MyBoard se sert (vidéos IMP-22, IMP-69, AVIF IMP-21) ; les autres (aac, mjpeg, png, mov_text,
/// webvtt) font partie de ffmpeg lui-même.
const NEEDED: [&str; 6] = ["libx264", "libx265", "libaom-av1", "libvpx", "libvpx-vp9", "libopus"];

/// D'où vient le ffmpeg utilisé.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    /// Variable MYBOARD_FFMPEG (essais de Claude).
    Essai,
    /// Installé sur le PC.
    Pc,
    /// Copie fournie avec MyBoard (dossier `ffmpeg` à côté de l'exe).
    Fourni,
}

#[derive(Clone, Debug)]
pub struct Ffmpeg {
    pub ffmpeg: PathBuf,
    pub ffprobe: PathBuf,
    pub version: String,
    pub source: Source,
    /// Tous les encodeurs de `NEEDED` sont présents.
    pub complete: bool,
}

/// État lu par la commande `ffmpeg_status` (vérifications).
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegStatus {
    pub found: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    pub source: Option<Source>,
    pub complete: bool,
}

impl FfmpegStatus {
    pub fn from(found: Option<&Ffmpeg>) -> Self {
        match found {
            Some(f) => Self {
                found: true,
                path: Some(f.ffmpeg.display().to_string()),
                version: Some(f.version.clone()),
                source: Some(f.source),
                complete: f.complete,
            },
            None => Self { found: false, path: None, version: None, source: None, complete: false },
        }
    }
}

/// Prépare une commande sans fenêtre console et en priorité basse : les miniatures
/// vidéo ne doivent ni faire clignoter de fenêtres noires, ni ralentir l'interface.
pub fn command(program: &Path) -> Command {
    let mut cmd = Command::new(program);
    cmd.stdin(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        const BELOW_NORMAL_PRIORITY_CLASS: u32 = 0x0000_4000;
        cmd.creation_flags(CREATE_NO_WINDOW | BELOW_NORMAL_PRIORITY_CLASS);
    }
    cmd
}

/// ffmpeg cherché une seule fois par lancement, pour tout MyBoard (miniatures, visionneuse, import).
pub fn shared() -> Option<&'static Ffmpeg> {
    static FOUND: std::sync::OnceLock<Option<Ffmpeg>> = std::sync::OnceLock::new();
    FOUND.get_or_init(detect).as_ref()
}

/// Cherche ffmpeg et ffprobe dans l'ordre décrit en tête du fichier ; `None` s'ils sont introuvables ou inutilisables.
fn detect() -> Option<Ffmpeg> {
    let switch = std::env::var("MYBOARD_SANS_FFMPEG").unwrap_or_default();
    if switch.trim() == "1" {
        return None;
    }
    if let Some(found) = custom().and_then(|exe| validate(&exe, Source::Essai)) {
        return Some(found);
    }
    let mut partial = None;
    if !switch.trim().eq_ignore_ascii_case("pc") {
        for exe in pc_candidates() {
            if let Some(found) = validate(&exe, Source::Pc) {
                if found.complete {
                    return Some(found);
                }
                partial.get_or_insert(found);
            }
        }
    }
    bundled().and_then(|exe| validate(&exe, Source::Fourni)).or(partial)
}

fn exe_name(base: &str) -> String {
    if cfg!(windows) { format!("{base}.exe") } else { base.to_string() }
}

/// Choix explicite (dossier ou exécutable).
fn custom() -> Option<PathBuf> {
    let custom = PathBuf::from(std::env::var_os("MYBOARD_FFMPEG")?);
    Some(if custom.is_dir() { custom.join(exe_name("ffmpeg")) } else { custom })
}

/// Copie fournie : `ffmpeg\ffmpeg.exe` à côté de myboard.exe (scripts/fetch-ffmpeg.ps1).
fn bundled() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    Some(exe.parent()?.join("ffmpeg").join(exe_name("ffmpeg")))
}

/// ffmpeg du PC : PATH, puis emplacements d'installation courants sous Windows (chacun une seule fois).
fn pc_candidates() -> Vec<PathBuf> {
    let mut list = Vec::new();
    let ffmpeg = exe_name("ffmpeg");
    if let Ok(found) = which::which("ffmpeg") {
        list.push(found);
    }
    if cfg!(windows) {
        for var in ["ProgramFiles", "ProgramFiles(x86)"] {
            if let Some(dir) = std::env::var_os(var).map(PathBuf::from) {
                list.push(dir.join("ffmpeg").join("bin").join(&ffmpeg));
                // ex. « C:\Program Files\ffmpeg-8.0.1-essentials_build\bin »
                list.extend(subdirs_starting_with(&dir, "ffmpeg").map(|d| d.join("bin").join(&ffmpeg)));
            }
        }
        list.push(PathBuf::from(r"C:\ffmpeg\bin").join(&ffmpeg));
        if let Some(local) = std::env::var_os("LOCALAPPDATA").map(PathBuf::from) {
            let winget = local.join("Microsoft").join("WinGet");
            list.push(winget.join("Links").join(&ffmpeg));
            for package in subdirs_starting_with(&winget.join("Packages"), "Gyan.FFmpeg") {
                list.extend(subdirs_starting_with(&package, "ffmpeg").map(|d| d.join("bin").join(&ffmpeg)));
            }
        }
        if let Some(home) = std::env::var_os("USERPROFILE").map(PathBuf::from) {
            list.push(home.join("scoop").join("shims").join(&ffmpeg));
        }
        list.push(PathBuf::from(r"C:\ProgramData\chocolatey\bin").join(&ffmpeg));
    }
    // Le même ffmpeg peut être dans le PATH et dans Program Files : il n'est lancé qu'une fois.
    let mut seen = Vec::new();
    list.retain(|p| {
        let key = std::fs::canonicalize(p).unwrap_or_else(|_| p.clone()).to_string_lossy().to_lowercase();
        let fresh = !seen.contains(&key);
        seen.push(key);
        fresh
    });
    list
}

fn subdirs_starting_with(dir: &Path, prefix: &str) -> impl Iterator<Item = PathBuf> {
    let prefix = prefix.to_ascii_lowercase();
    std::fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter(move |e| {
            e.file_name().to_string_lossy().to_ascii_lowercase().starts_with(&prefix)
                && e.path().is_dir()
        })
        .map(|e| e.path())
}

/// Vérifie qu'un candidat se lance vraiment, que ffprobe est à côté (ou dans le PATH, pour celui du PC) et relève ses
/// encodeurs.
fn validate(ffmpeg: &Path, source: Source) -> Option<Ffmpeg> {
    if !ffmpeg.is_file() {
        return None;
    }
    let version = run_version(ffmpeg)?;
    let probe_name = exe_name("ffprobe");
    let beside = ffmpeg.parent().map(|dir| dir.join(&probe_name)).filter(|p| p.is_file());
    let ffprobe = match source {
        Source::Pc => beside.or_else(|| which::which("ffprobe").ok())?,
        Source::Essai | Source::Fourni => beside?,
    };
    run_version(&ffprobe)?;
    let complete = has_encoders(ffmpeg);
    Some(Ffmpeg { ffmpeg: ffmpeg.to_path_buf(), ffprobe, version, source, complete })
}

/// Lignes de `-encoders` : « ␣V....D libx264  libx264 H.264… » (drapeaux, puis le nom).
fn has_encoders(ffmpeg: &Path) -> bool {
    let Ok(output) = command(ffmpeg).args(["-hide_banner", "-encoders"]).stderr(Stdio::null()).output() else {
        return false;
    };
    let text = String::from_utf8_lossy(&output.stdout);
    let names: Vec<&str> = text.lines().filter_map(|line| line.split_whitespace().nth(1)).collect();
    NEEDED.iter().all(|needed| names.contains(needed))
}

/// Première ligne de `-version`, ex. « ffmpeg version 8.0.1-essentials_build… ».
fn run_version(exe: &Path) -> Option<String> {
    let output = command(exe).arg("-version").stderr(Stdio::null()).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let first = text.lines().next()?.trim();
    let version = first.split_whitespace().nth(2).unwrap_or(first);
    Some(version.to_string())
}
