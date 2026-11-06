//! Sous-titres des vidéos (VIEW-52), trouvés tout seuls :
//! - fichiers posés à côté de la vidéo avec le même nom : `film.srt`, `film.fr.srt`, `film.en.vtt`,
//!   `film.ass`… (majuscules ignorées) ;
//! - pistes rangées dans la vidéo (MKV, MP4), listées par ffprobe ; seules les pistes en texte (les
//!   sous-titres en images des DVD et Blu-ray ne peuvent pas être lus ainsi) ;
//! - fichiers importés par l'utilisateur (« Importer un fichier », retour VIS.1.4) : leur chemin est retenu pour la
//!   vidéo (table `media_subtitles`, schéma 16), proposé tant que le fichier existe.
//!
//! Une piste est rendue en répliques (début, fin, texte) : `.srt` et `.vtt` lus ici (un vieux `.srt` en
//! encodage Windows est reconnu) ; `.ass`, `.ssa` et pistes intégrées convertis par ffmpeg en WebVTT, texte
//! seul (ni couleurs ni positions). La vidéo et ses fichiers ne sont jamais modifiés.

use std::collections::VecDeque;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, Mutex};

use rusqlite::params;
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

use super::existing_path;
use crate::AppState;
use crate::ffmpeg::{self, Ffmpeg};

/// Extensions des fichiers de sous-titres posés à côté de la vidéo.
const SIDE_EXTS: [&str; 4] = ["srt", "vtt", "ass", "ssa"];
/// Pistes intégrées lisibles (texte).
const TEXT_CODECS: [&str; 6] = ["subrip", "ass", "ssa", "webvtt", "mov_text", "text"];
/// Dernières pistes lues gardées en mémoire (changer de piste et revenir est immédiat).
const KEPT: usize = 8;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubTrack {
    /// `f:<nom du fichier>` ou `e:<numéro de la piste dans la vidéo>`.
    pub key: String,
    pub label: String,
    /// Code de langue (« fr », « en »…), s'il est connu.
    pub lang: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct Cue {
    pub start: f64,
    pub end: f64,
    pub text: String,
}

type Kept = VecDeque<((i64, String), Arc<Vec<Cue>>)>;
static CACHE: Mutex<Kept> = Mutex::new(VecDeque::new());

/// Code de langue (2 ou 3 lettres) → (code court, nom en français).
fn language(code: &str) -> Option<(&'static str, &'static str)> {
    Some(match code.to_lowercase().as_str() {
        "fr" | "fre" | "fra" | "french" => ("fr", "Français"),
        "en" | "eng" | "english" => ("en", "Anglais"),
        "ja" | "jpn" | "jp" => ("ja", "Japonais"),
        "es" | "spa" => ("es", "Espagnol"),
        "de" | "ger" | "deu" => ("de", "Allemand"),
        "it" | "ita" => ("it", "Italien"),
        "pt" | "por" => ("pt", "Portugais"),
        "ru" | "rus" => ("ru", "Russe"),
        "zh" | "chi" | "zho" => ("zh", "Chinois"),
        "ko" | "kor" => ("ko", "Coréen"),
        "ar" | "ara" => ("ar", "Arabe"),
        "nl" | "dut" | "nld" => ("nl", "Néerlandais"),
        "pl" | "pol" => ("pl", "Polonais"),
        _ => return None,
    })
}

/// Fichiers de sous-titres à côté de la vidéo : (nom du fichier, partie entre le nom de la vidéo et l'extension).
fn side_files(video: &Path) -> Vec<(String, String, String)> {
    let (Some(dir), Some(stem)) = (video.parent(), video.file_stem()) else { return Vec::new() };
    let prefix = format!("{}.", stem.to_string_lossy().to_lowercase());
    let Ok(entries) = std::fs::read_dir(dir) else { return Vec::new() };
    let mut found: Vec<(String, String, String)> = entries
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_ok_and(|t| t.is_file()))
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().into_owned();
            let lower = name.to_lowercase();
            let rest = lower.strip_prefix(&prefix)?;
            let (middle, ext) = rest.rsplit_once('.').map_or(("", rest), |(m, x)| (m, x));
            SIDE_EXTS.contains(&ext).then(|| (name.clone(), middle.to_string(), ext.to_string()))
        })
        .collect();
    found.sort();
    found
}

/** Langue lue dans un nom de fichier : le dernier morceau reconnu (« film.forced.fr.srt » → français). */
fn language_in_name(stem: &str) -> Option<(&'static str, &'static str)> {
    stem.split('.').rev().find_map(language)
}

fn file_track((name, middle, ext): &(String, String, String)) -> SubTrack {
    // Langue : le dernier morceau reconnu (« film.forced.fr.srt ») ; sinon le texte du milieu tel quel.
    let lang = language_in_name(middle);
    let what = match lang {
        Some((_, label)) => label.to_string(),
        None if middle.is_empty() => "Sans langue".to_string(),
        None => middle.clone(),
    };
    SubTrack { key: format!("f:{name}"), label: format!("{what} (fichier .{ext})"), lang: lang.map(|(c, _)| c.to_string()) }
}

/// Pistes en texte rangées dans la vidéo (ffprobe).
fn embedded_tracks(ff: &Ffmpeg, video: &Path) -> Vec<SubTrack> {
    let mut cmd = ffmpeg::command(&ff.ffprobe);
    cmd.args(["-v", "error", "-select_streams", "s", "-show_entries", "stream=index,codec_name:stream_tags=language,title", "-of", "json"])
        .arg(video)
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    let Ok(output) = cmd.output() else { return Vec::new() };
    let Ok(json) = serde_json::from_slice::<Value>(&output.stdout) else { return Vec::new() };
    let empty = Vec::new();
    json["streams"]
        .as_array()
        .unwrap_or(&empty)
        .iter()
        .filter(|s| s["codec_name"].as_str().is_some_and(|c| TEXT_CODECS.contains(&c)))
        .filter_map(|s| {
            let index = s["index"].as_i64()?;
            let lang = s["tags"]["language"].as_str().and_then(language);
            let title = s["tags"]["title"].as_str().filter(|t| !t.trim().is_empty());
            let what = lang.map_or("Langue inconnue", |(_, label)| label);
            let label = match title {
                Some(t) => format!("{what} — {} (intégré)", t.trim()),
                None => format!("{what} (intégré)"),
            };
            Some(SubTrack { key: format!("e:{index}"), label, lang: lang.map(|(c, _)| c.to_string()) })
        })
        .collect()
}

/// Texte d'un fichier : UTF-8 (marque d'ordre retirée) ou, à défaut, encodage Windows (Windows-1252).
fn decode_text(bytes: &[u8]) -> String {
    let bytes = bytes.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(bytes);
    match std::str::from_utf8(bytes) {
        Ok(s) => s.to_string(),
        Err(_) => bytes.iter().map(|&b| windows_1252(b)).collect(),
    }
}

fn windows_1252(b: u8) -> char {
    const HIGH: [char; 32] = [
        '€', '\u{81}', '‚', 'ƒ', '„', '…', '†', '‡', 'ˆ', '‰', 'Š', '‹', 'Œ', '\u{8d}', 'Ž', '\u{8f}', '\u{90}', '‘', '’', '“', '”', '•', '–', '—',
        '˜', '™', 'š', '›', 'œ', '\u{9d}', 'ž', 'Ÿ',
    ];
    if (0x80..0xA0).contains(&b) { HIGH[(b - 0x80) as usize] } else { b as char }
}

/// « 00:01:02,345 », « 01:02.345 » → secondes.
fn timestamp(s: &str) -> Option<f64> {
    let s = s.trim().replace(',', ".");
    let parts: Vec<&str> = s.split(':').collect();
    let (h, m, sec) = match parts.as_slice() {
        [h, m, s] => (h.parse::<f64>().ok()?, m.parse::<f64>().ok()?, s.parse::<f64>().ok()?),
        [m, s] => (0.0, m.parse::<f64>().ok()?, s.parse::<f64>().ok()?),
        _ => return None,
    };
    Some(h * 3600.0 + m * 60.0 + sec)
}

/// Répliques d'un texte SRT ou WebVTT : blocs séparés par une ligne vide, la ligne « début --> fin »
/// suivie du texte. Balises de style ASS laissées dans un SRT (« {\an8} ») retirées.
fn parse_cues(text: &str) -> Vec<Cue> {
    let text = text.replace("\r\n", "\n").replace('\r', "\n");
    let mut cues = Vec::new();
    for block in text.split("\n\n") {
        let mut lines = block.lines().skip_while(|l| !l.contains("-->"));
        let Some(timing) = lines.next() else { continue };
        let Some((a, b)) = timing.split_once("-->") else { continue };
        // Réglages WebVTT après l'heure de fin (« line:90% ») ignorés.
        let (Some(start), Some(end)) = (timestamp(a), timestamp(b.split_whitespace().next().unwrap_or(""))) else { continue };
        let body: Vec<String> = lines.map(strip_ass_tags).filter(|l| !l.trim().is_empty()).collect();
        if !body.is_empty() && end > start {
            cues.push(Cue { start, end, text: body.join("\n") });
        }
    }
    cues
}

fn strip_ass_tags(line: &str) -> String {
    let mut out = String::with_capacity(line.len());
    let mut depth = 0;
    for c in line.chars() {
        match c {
            '{' => depth += 1,
            '}' if depth > 0 => depth -= 1,
            _ if depth == 0 => out.push(c),
            _ => {}
        }
    }
    out
}

/// ffmpeg → WebVTT (texte seul) : `input` donné sur l'entrée standard (fichier ASS déjà décodé), ou lu dans
/// la vidéo (`-map 0:<piste>`).
fn ffmpeg_webvtt(ff: &Ffmpeg, args: &[&str], input: Option<&str>, video: Option<&Path>) -> Result<String, String> {
    let mut cmd = ffmpeg::command(&ff.ffmpeg);
    cmd.args(["-hide_banner", "-loglevel", "error"]);
    match (input, video) {
        (Some(_), _) => cmd.args(["-f", "ass", "-i", "pipe:0"]),
        (None, Some(v)) => cmd.arg("-nostdin").arg("-i").arg(v),
        (None, None) => return Err("rien à lire".into()),
    };
    cmd.args(args).args(["-c:s", "webvtt", "-f", "webvtt", "pipe:1"]);
    cmd.stdin(if input.is_some() { Stdio::piped() } else { Stdio::null() }).stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|e| e.to_string())?;
    if let (Some(text), Some(mut stdin)) = (input, child.stdin.take()) {
        let text = text.to_string();
        // Écrit à part : ffmpeg lit et écrit en même temps (pas de blocage sur un gros fichier).
        std::thread::spawn(move || {
            let _ = stdin.write_all(text.as_bytes());
        });
    }
    let output = child.wait_with_output().map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

/// Fichiers importés pour cette vidéo, qui existent encore.
fn imported(state: &AppState, id: i64) -> Vec<PathBuf> {
    let db = state.db.lock().unwrap();
    let Ok(mut stmt) = db.prepare_cached("SELECT path FROM media_subtitles WHERE media_id = ?1 ORDER BY added_at") else { return Vec::new() };
    stmt.query_map([id], |r| r.get::<_, String>(0))
        .map(|rows| rows.filter_map(Result::ok).map(PathBuf::from).filter(|p| p.is_file()).collect())
        .unwrap_or_default()
}

fn imported_track(path: &Path) -> SubTrack {
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    let stem = path.file_stem().map(|s| s.to_string_lossy().to_lowercase()).unwrap_or_default();
    SubTrack { key: format!("i:{}", path.display()), label: format!("{name} (importé)"), lang: language_in_name(&stem).map(|(c, _)| c.to_string()) }
}

/// Répliques d'un fichier de sous-titres (.srt, .vtt lus ici ; .ass, .ssa par ffmpeg).
fn file_cues(ff: Option<&Ffmpeg>, path: &Path) -> Result<Vec<Cue>, String> {
    let text = decode_text(&std::fs::read(path).map_err(|e| e.to_string())?);
    let ext = path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
    match ext.as_str() {
        "ass" | "ssa" => {
            let ff = ff.ok_or("ffmpeg est introuvable : ces sous-titres ne peuvent pas être lus.")?;
            Ok(parse_cues(&ffmpeg_webvtt(ff, &[], Some(&text), None)?))
        }
        _ => Ok(parse_cues(&text)),
    }
}

/// `imported` : fichiers importés pour cette vidéo (seuls chemins acceptés pour une clé `i:`).
fn read_cues(ff: Option<&Ffmpeg>, video: &Path, imported: &[PathBuf], key: &str) -> Result<Vec<Cue>, String> {
    let need_ffmpeg = || ff.ok_or_else(|| "ffmpeg est introuvable : ces sous-titres ne peuvent pas être lus.".to_string());
    if let Some(name) = key.strip_prefix("f:") {
        // Seulement un fichier à côté de la vidéo, portant son nom (jamais un autre chemin).
        let side = side_files(video).into_iter().find(|(n, _, _)| n == name).ok_or("Fichier de sous-titres introuvable.")?;
        return file_cues(ff, &video.with_file_name(&side.0));
    }
    if let Some(path) = key.strip_prefix("i:") {
        let path = imported.iter().find(|p| p.display().to_string() == path).ok_or("Fichier de sous-titres introuvable.")?;
        return file_cues(ff, path);
    }
    let index: u32 = key.strip_prefix("e:").and_then(|i| i.parse().ok()).ok_or("Piste inconnue.")?;
    let map = format!("0:{index}");
    Ok(parse_cues(&ffmpeg_webvtt(need_ffmpeg()?, &["-map", &map], None, Some(video))?))
}

/// Pistes de sous-titres d'une vidéo : fichiers à côté (par nom), puis pistes intégrées.
#[tauri::command]
pub async fn video_subtitles(state: State<'_, AppState>, id: i64) -> Result<Vec<SubTrack>, String> {
    let video = existing_path(&state, id).map_err(|e| e.message)?;
    let ff = state.thumbs.ffmpeg().cloned();
    let extra = imported(&state, id);
    tauri::async_runtime::spawn_blocking(move || {
        let mut tracks: Vec<SubTrack> = side_files(&video).iter().map(file_track).collect();
        if let Some(ff) = ff {
            tracks.extend(embedded_tracks(&ff, &video));
        }
        tracks.extend(extra.iter().map(|p| imported_track(p)));
        tracks
    })
    .await
    .map_err(|e| e.to_string())
}

/// Répliques d'une piste (gardées en mémoire pour les dernières lues).
#[tauri::command]
pub async fn subtitle_cues(state: State<'_, AppState>, id: i64, key: String) -> Result<Vec<Cue>, String> {
    if let Some((_, cues)) = CACHE.lock().unwrap().iter().find(|(k, _)| k.0 == id && k.1 == key) {
        return Ok(cues.as_ref().clone());
    }
    let video = existing_path(&state, id).map_err(|e| e.message)?;
    let ff = state.thumbs.ffmpeg().cloned();
    let extra = imported(&state, id);
    let k = key.clone();
    let cues = tauri::async_runtime::spawn_blocking(move || read_cues(ff.as_ref(), &video, &extra, &k)).await.map_err(|e| e.to_string())??;
    let mut cache = CACHE.lock().unwrap();
    cache.push_back(((id, key), Arc::new(cues.clone())));
    if cache.len() > KEPT {
        cache.pop_front();
    }
    Ok(cues)
}

/// « Importer un fichier » : fenêtre « Ouvrir » de Windows (formats de sous-titres) ; le chemin choisi est retenu
/// pour la vidéo. Renvoie la piste, ou rien si l'utilisateur annule.
#[tauri::command]
pub async fn import_subtitle(app: AppHandle, window: WebviewWindow, state: State<'_, AppState>, id: i64) -> Result<Option<SubTrack>, String> {
    let video = existing_path(&state, id).map_err(|e| e.message)?;
    let mut dialog = app
        .dialog()
        .file()
        .set_parent(&window)
        .set_title("Importer un fichier de sous-titres")
        .add_filter("Sous-titres (.srt, .vtt, .ass, .ssa)", &SIDE_EXTS);
    if let Some(dir) = video.parent() {
        dialog = dialog.set_directory(dir);
    }
    let Some(chosen) = dialog.blocking_pick_file() else { return Ok(None) };
    let path = chosen.into_path().map_err(|e| e.to_string())?;
    state
        .db
        .lock()
        .unwrap()
        .execute("INSERT OR IGNORE INTO media_subtitles (media_id, path, added_at) VALUES (?1, ?2, ?3)", params![id, path.display().to_string(), crate::db::now_ms()])
        .map_err(|e| e.to_string())?;
    Ok(Some(imported_track(&path)))
}

/// « Retirer le fichier importé » : la vidéo l'oublie (le fichier reste où il est).
#[tauri::command]
pub async fn remove_imported_subtitle(state: State<'_, AppState>, id: i64, key: String) -> Result<(), String> {
    let path = key.strip_prefix("i:").ok_or("Piste inconnue.")?;
    state
        .db
        .lock()
        .unwrap()
        .execute("DELETE FROM media_subtitles WHERE media_id = ?1 AND path = ?2", params![id, path])
        .map_err(|e| e.to_string())?;
    CACHE.lock().unwrap().retain(|(k, _)| !(k.0 == id && k.1 == key));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn srt_et_vtt() {
        let srt = "1\r\n00:00:01,000 --> 00:00:03,500\r\nBonjour {\\an8}à tous\r\n\r\n2\r\n00:00:04,000 --> 00:00:06,000\r\n<i>Deux</i>\r\nlignes\r\n";
        let cues = parse_cues(srt);
        assert_eq!(cues.len(), 2);
        assert_eq!(cues[0].start, 1.0);
        assert_eq!(cues[0].text, "Bonjour à tous");
        assert_eq!(cues[1].text, "<i>Deux</i>\nlignes");
        let vtt = "WEBVTT\n\n01:02.500 --> 01:04.000 line:90%\nCourt\n";
        assert_eq!(parse_cues(vtt)[0].start, 62.5);
    }

    #[test]
    fn encodage_windows() {
        assert_eq!(decode_text(b"\xE9t\xE9 \x80"), "été €");
        assert_eq!(decode_text("\u{feff}déjà".as_bytes()), "déjà");
    }
}
