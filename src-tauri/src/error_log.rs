//! Journal des erreurs du travail en arrière-plan (TAGM-23, réponse Q1 A du 13/11) : `erreurs.txt` dans le dossier de
//! données. La version finale n'a pas de console : sans ce fichier, une erreur ne laisserait aucune trace.

use std::io::Write;
use std::path::Path;

/// Au-delà, le fichier repart de zéro (le précédent est gardé sous `erreurs.ancien.txt`).
const MAX_BYTES: u64 = 256 * 1024;

/// Ajoute une ligne datée (heure locale) à `erreurs.txt`.
pub fn note(dir: &Path, what: &str) {
    eprintln!("{what}");
    let path = dir.join("erreurs.txt");
    if std::fs::metadata(&path).is_ok_and(|m| m.len() > MAX_BYTES) {
        let _ = std::fs::rename(&path, dir.join("erreurs.ancien.txt"));
    }
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(file, "{} {what}", now());
    }
}

#[cfg(windows)]
fn now() -> String {
    use windows_sys::Win32::System::SystemInformation::GetLocalTime;
    // SAFETY : GetLocalTime remplit seulement la structure qu'on lui donne.
    let t = unsafe {
        let mut t = std::mem::zeroed();
        GetLocalTime(&mut t);
        t
    };
    format!("{:02}/{:02}/{} {:02}:{:02}:{:02}", t.wDay, t.wMonth, t.wYear, t.wHour, t.wMinute, t.wSecond)
}

#[cfg(not(windows))]
fn now() -> String {
    crate::db::now_ms().to_string()
}
