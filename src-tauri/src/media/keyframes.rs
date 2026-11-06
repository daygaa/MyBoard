//! Images clés d'une vidéo (VIEW-55, D-054) : leurs temps, lus par ffprobe dans l'index du fichier (sans décoder :
//! 0,5 s pour 684 Mo). Pendant le glissement du curseur de la barre de progression, la visionneuse saute juste après
//! une image clé : le moteur n'a presque rien à décoder (mesuré sur une vidéo 4K HEVC : 62 à 65 ms par saut, au lieu
//! de 150 à 250 ms pour un instant quelconque, qui oblige à décoder depuis l'image clé précédente).

use std::collections::VecDeque;
use std::process::Stdio;
use std::sync::{Arc, Mutex};

use tauri::State;

use crate::AppState;
use crate::ffmpeg;

/// Dernières listes gardées en mémoire (retour sur une vidéo).
const KEPT: usize = 8;
static CACHE: Mutex<VecDeque<(i64, Arc<Vec<f64>>)>> = Mutex::new(VecDeque::new());

/// Temps (en secondes) des images clés de la vidéo, dans l'ordre ; vide si ffprobe est absent ou échoue.
#[tauri::command]
pub async fn video_keyframes(state: State<'_, AppState>, id: i64) -> Result<Vec<f64>, String> {
    if let Some((_, times)) = CACHE.lock().unwrap().iter().find(|(k, _)| *k == id) {
        return Ok(times.as_ref().clone());
    }
    let video = super::existing_path(&state, id).map_err(|e| e.message)?;
    let Some(ff) = state.thumbs.ffmpeg().cloned() else { return Ok(Vec::new()) };
    let times = tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = ffmpeg::command(&ff.ffprobe);
        cmd.args(["-v", "error", "-select_streams", "v:0", "-show_entries", "packet=pts_time,flags", "-of", "csv=p=0"])
            .arg(&video)
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        let Ok(output) = cmd.output() else { return Vec::new() };
        let mut times: Vec<f64> = String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter_map(|line| {
                let (time, flags) = line.split_once(',')?;
                flags.starts_with('K').then(|| time.parse::<f64>().ok()).flatten()
            })
            .collect();
        times.sort_by(f64::total_cmp);
        times
    })
    .await
    .map_err(|e| e.to_string())?;
    let mut cache = CACHE.lock().unwrap();
    cache.push_back((id, Arc::new(times.clone())));
    if cache.len() > KEPT {
        cache.pop_front();
    }
    Ok(times)
}
