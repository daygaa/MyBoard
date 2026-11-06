//! Images lues directement par WebView2 sur le disque (VIEW-53, retours AUT.7.2 et AUT.7.3, D-053).
//!
//! Mesuré le 06/11 : le protocole `media://` passe le fichier à la fenêtre par le fil principal de MyBoard, à
//! ~16 ms par Mo (0,40 s pour 28 Mo), une lecture à la fois ; pendant ce temps, miniatures, appels au cœur et
//! touches du clavier (traitées par MyBoard, GEN-18) attendent (jusqu'à 0,6 s). Ici, chaque disque qui contient
//! un média de la bibliothèque est confié à WebView2, en lecture seule, sous un nom d'hôte à lui
//! (`https://disque-c.myboard/…`) : le moteur lit le fichier lui-même (43 ms pour 28 Mo), sans passer par MyBoard.
//! Choix de l'utilisateur (06/11) : les disques entiers ; seule la fenêtre de MyBoard voit ces adresses, et sa
//! règle de sécurité interdit toute connexion vers l'extérieur.
//!
//! WebView2 n'applique ce réglage qu'aux pages chargées APRÈS lui (mesuré) : les disques sont confiés au démarrage,
//! avant le chargement de la page. Un disque qui reçoit son premier média pendant la séance (import) passe par
//! `media://` jusqu'au prochain lancement. Chemins réseau (`\\serveur\…`), formats convertis par ffmpeg (TIFF, HEIC) :
//! `media://`, comme avant. En cas d'échec de lecture, l'interface repasse aussi par `media://`.

use std::sync::Mutex;

use rusqlite::Connection;

/// Formats d'image affichés tels quels par WebView2 (les autres sont convertis par `protocol.rs`).
const DIRECT: [&str; 9] = ["jpg", "jpeg", "jpe", "jfif", "png", "gif", "webp", "bmp", "avif"];

/// Lettres des disques confiés à WebView2 au démarrage.
static DRIVES: Mutex<Vec<char>> = Mutex::new(Vec::new());

/// Nom d'hôte d'un disque : `disque-c.myboard`.
fn host(letter: char) -> String {
    format!("disque-{}.myboard", letter.to_ascii_lowercase())
}

/// Disques qui contiennent au moins un média (index du chemin, insensible à la casse : 26 lectures, < 1 ms
/// pour 100 000 médias), et qui existent.
pub fn media_drives(db: &Connection) -> Vec<char> {
    let Ok(mut stmt) = db.prepare("SELECT 1 FROM media WHERE path >= ?1 AND path < ?2 LIMIT 1") else { return Vec::new() };
    ('A'..='Z')
        // `]` suit `\` : tous les chemins qui commencent par « X:\ ».
        .filter(|l| stmt.exists([format!("{l}:\\"), format!("{l}:]")]).unwrap_or(false))
        .filter(|l| std::path::Path::new(&format!("{l}:\\")).exists())
        .collect()
}

/// Confie ces disques à WebView2 (au démarrage, avant le chargement de la page).
pub fn install(window: &tauri::WebviewWindow, drives: Vec<char>) {
    if drives.is_empty() {
        return;
    }
    *DRIVES.lock().unwrap() = drives.clone();
    map(window, drives);
}

/// Adresse directe d'une image (`https://disque-c.myboard/Users/…/a%20b.png`), ou `None` : autre sorte de
/// média, format converti, chemin réseau, disque non confié.
pub fn file_url(path: &str, kind: &str, ext: &str) -> Option<String> {
    if kind != "image" || !DIRECT.contains(&ext) {
        return None;
    }
    let letter = path.chars().next().filter(char::is_ascii_alphabetic)?.to_ascii_uppercase();
    let rest = path.get(1..)?.strip_prefix(":\\")?;
    if !DRIVES.lock().unwrap().contains(&letter) {
        return None;
    }
    let encoded: Vec<String> = rest.split('\\').map(encode).collect();
    Some(format!("https://{}/{}", host(letter), encoded.join("/")))
}

/// Partie d'un chemin écrite dans une adresse : tout sauf lettres, chiffres et `-._~` est encodé (%XX, UTF-8).
fn encode(part: &str) -> String {
    let mut out = String::with_capacity(part.len());
    for b in part.bytes() {
        if b.is_ascii_alphanumeric() || b"-._~".contains(&b) {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

#[cfg(windows)]
fn map(window: &tauri::WebviewWindow, drives: Vec<char>) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW, ICoreWebView2_3};
    use windows_core::{HSTRING, Interface};

    let _ = window.with_webview(move |webview| {
        // SAFETY : objets COM vivants de WebView2, appelés sur le fil de la fenêtre (`with_webview`).
        unsafe {
            let Ok(core) = webview.controller().CoreWebView2().and_then(|core| core.cast::<ICoreWebView2_3>()) else { return };
            for letter in drives {
                // ALLOW : le fil à part des copies (imageCache.worker.ts) lit le fichier par `fetch`.
                let _ = core.SetVirtualHostNameToFolderMapping(
                    &HSTRING::from(host(letter)),
                    &HSTRING::from(format!("{letter}:\\")),
                    COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW,
                );
            }
        }
    });
}

#[cfg(not(windows))]
fn map(_window: &tauri::WebviewWindow, _drives: Vec<char>) {}
