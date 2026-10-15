//! Texte du presse-papiers de Windows : lu pour « Coller » du menu d'édition des champs de saisie
//! (CTX-03), écrit par les entrées « Copier le tag / le nom / le chemin / le lien… » des menus du
//! clic droit (CTX-04 à CTX-10, CTX-19). Passé par ici plutôt que par la page : WebView2
//! demanderait une autorisation pour lire, et écrire exige que la page ait le focus.

/// Texte du presse-papiers ; `None` s'il n'y en a pas (presse-papiers vide, image, fichiers…).
#[tauri::command]
pub async fn read_clipboard_text() -> Option<String> {
    read()
}

/// Met `text` dans le presse-papiers (à la place de ce qui s'y trouvait).
#[tauri::command]
pub async fn write_clipboard_text(text: String) -> Result<(), String> {
    write(&text)
}

#[cfg(windows)]
fn read() -> Option<String> {
    clipboard_win::get_clipboard_string().ok().filter(|text| !text.is_empty())
}

#[cfg(windows)]
fn write(text: &str) -> Result<(), String> {
    clipboard_win::set_clipboard_string(text).map_err(|e| e.to_string())
}

#[cfg(not(windows))]
fn read() -> Option<String> {
    None
}

#[cfg(not(windows))]
fn write(_text: &str) -> Result<(), String> {
    Err("Le presse-papiers n'est accessible que sous Windows.".into())
}
