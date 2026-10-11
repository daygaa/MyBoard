//! Détection de ffmpeg / ffprobe sous Windows (IMP-48, D-012).
//!
//! La v8 cherchait ffmpeg avec une commande Linux (`which`) : introuvable sous Windows.
//! Ici : variable MYBOARD_FFMPEG, puis le PATH (avec les extensions .exe), puis les
//! emplacements d'installation courants. Chaque candidat est validé en le lançant.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use serde::Serialize;

#[derive(Clone, Debug)]
pub struct Ffmpeg {
    pub ffmpeg: PathBuf,
    pub ffprobe: PathBuf,
    pub version: String,
}

/// État affiché par l'interface (message clair si ffmpeg est absent).
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegStatus {
    pub found: bool,
    pub path: Option<String>,
    pub version: Option<String>,
}

impl FfmpegStatus {
    pub fn from(found: Option<&Ffmpeg>) -> Self {
        match found {
            Some(f) => Self {
                found: true,
                path: Some(f.ffmpeg.display().to_string()),
                version: Some(f.version.clone()),
            },
            None => Self { found: false, path: None, version: None },
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

/// Cherche ffmpeg et ffprobe ; `None` s'ils sont introuvables ou inutilisables.
pub fn detect() -> Option<Ffmpeg> {
    candidates().into_iter().find_map(|exe| validate(&exe))
}

fn exe_name(base: &str) -> String {
    if cfg!(windows) { format!("{base}.exe") } else { base.to_string() }
}

fn candidates() -> Vec<PathBuf> {
    let mut list = Vec::new();
    let ffmpeg = exe_name("ffmpeg");

    // 1. Choix explicite (dossier ou exécutable).
    if let Some(custom) = std::env::var_os("MYBOARD_FFMPEG").map(PathBuf::from) {
        list.push(if custom.is_dir() { custom.join(&ffmpeg) } else { custom });
    }
    // 2. PATH.
    if let Ok(found) = which::which("ffmpeg") {
        list.push(found);
    }
    // 3. Emplacements d'installation courants sous Windows.
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

/// Vérifie qu'un candidat se lance vraiment et que ffprobe est à côté (ou dans le PATH).
fn validate(ffmpeg: &Path) -> Option<Ffmpeg> {
    if !ffmpeg.is_file() {
        return None;
    }
    let version = run_version(ffmpeg)?;
    let probe_name = exe_name("ffprobe");
    let ffprobe = ffmpeg
        .parent()
        .map(|dir| dir.join(&probe_name))
        .filter(|p| p.is_file())
        .or_else(|| which::which("ffprobe").ok())?;
    run_version(&ffprobe)?;
    Some(Ffmpeg { ffmpeg: ffmpeg.to_path_buf(), ffprobe, version })
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
