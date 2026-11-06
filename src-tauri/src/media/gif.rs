//! GIF animés lus par le lecteur vidéo (VIEW-54) : à la 1re ouverture, ffmpeg en fait une vidéo MP4 (H.264),
//! rangée dans le dossier `cache-gif` des données de MyBoard, vidé au lancement et à la fermeture (choix de
//! l'utilisateur, 06/11) ; le GIF d'origine n'est jamais touché. Servie par le protocole `media://` à
//! l'adresse `gif/<id>/<empreinte>.mp4`.
//!
//! Réglages (mesurés le 06/11 sur 5 GIF de la banque de test) : H.264 « veryfast », qualité 10 : 0,1 à 0,5 s
//! par GIF, fidélité (SSIM) 0,99 et plus, même pour un GIF tramé ; VP9 était deux fois plus lent, sans gain.
//! Parties transparentes posées sur le fond de la visionneuse ; une largeur ou hauteur impaire reçoit une
//! colonne ou une ligne de plus (exigence du H.264), que le lecteur ne montre pas.

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Mutex;

use rusqlite::OptionalExtension;
use tauri::State;

use crate::AppState;
use crate::ffmpeg::{self, Ffmpeg};

/// Couleur du fond de la visionneuse (`--viewer-bg`, index.css).
const VIEWER_BG: &str = "0x0d0e12";
/// Une conversion à la fois : un GIF demandé deux fois (ouverture, voisin) n'est converti qu'une fois.
static CONVERTING: Mutex<()> = Mutex::new(());

pub fn cache_dir(root: &Path) -> PathBuf {
    root.join("cache-gif")
}

/// Vide le cache (lancement, fermeture). Une erreur (fichier encore ouvert…) n'empêche rien.
pub fn clear_cache(root: &Path) {
    let _ = std::fs::remove_dir_all(cache_dir(root));
}

/// Vidéo d'un GIF dans le cache : `<empreinte>.mp4`.
pub fn cached_video(root: &Path, hash: &str) -> PathBuf {
    cache_dir(root).join(format!("{hash}.mp4"))
}

fn convert(ff: &Ffmpeg, gif: &Path, out: &Path) -> Result<(), String> {
    let _one = CONVERTING.lock().unwrap();
    if out.exists() {
        return Ok(());
    }
    std::fs::create_dir_all(out.parent().unwrap_or(Path::new("."))).map_err(|e| e.to_string())?;
    let part = out.with_extension("part.mp4");
    let mut cmd = ffmpeg::command(&ff.ffmpeg);
    cmd.args(["-hide_banner", "-loglevel", "error", "-nostdin", "-y", "-i"])
        .arg(gif)
        // Fond tiré du GIF lui-même (même minutage que ses images), puis le GIF posé dessus.
        .args([
            "-filter_complex",
            &format!(
                "[0:v]format=rgba,split[g][b];[b]drawbox=c={VIEWER_BG}@1:t=fill[f];[f][g]overlay=format=auto,pad=ceil(iw/2)*2:ceil(ih/2)*2:color={VIEWER_BG},format=yuv420p[v]"
            ),
        ])
        // Durée de chaque image du GIF gardée telle quelle (pas de rythme fixe).
        .args(["-map", "[v]", "-an", "-fps_mode", "vfr", "-c:v", "libx264", "-preset", "veryfast", "-crf", "10", "-movflags", "+faststart"])
        .arg(&part)
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    let output = cmd.output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        let _ = std::fs::remove_file(&part);
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    std::fs::rename(&part, out).map_err(|e| e.to_string())
}

/// Prépare la vidéo d'un GIF (convertie si elle ne l'est pas encore) ; renvoie son adresse dans le protocole
/// `media://`, relative (`gif/<id>/<empreinte>.mp4`).
#[tauri::command]
pub async fn prepare_gif(state: State<'_, AppState>, id: i64) -> Result<String, String> {
    let found: Option<(String, String)> = state
        .db
        .lock()
        .unwrap()
        .query_row("SELECT path, hash FROM media WHERE id = ?1 AND ext = 'gif'", [id], |r| Ok((r.get(0)?, r.get(1)?)))
        .optional()
        .map_err(|e| e.to_string())?;
    let (path, hash) = found.ok_or("GIF introuvable dans la bibliothèque.")?;
    let ff = state.thumbs.ffmpeg().cloned().ok_or("ffmpeg est introuvable.")?;
    let out = cached_video(&state.paths.root, &hash);
    tauri::async_runtime::spawn_blocking(move || convert(&ff, Path::new(&path), &out)).await.map_err(|e| e.to_string())??;
    Ok(format!("gif/{id}/{hash}.mp4"))
}
