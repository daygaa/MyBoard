//! Texte du presse-papiers de Windows, pour « Coller » du menu d'édition des champs de saisie
//! (CTX-03). Lu ici plutôt que par la page : WebView2 demanderait une autorisation à chaque fois.

/// Texte du presse-papiers ; `None` s'il n'y en a pas (presse-papiers vide, image, fichiers…).
#[tauri::command]
pub async fn read_clipboard_text() -> Option<String> {
    read()
}

#[cfg(windows)]
fn read() -> Option<String> {
    clipboard_win::get_clipboard_string().ok().filter(|text| !text.is_empty())
}

#[cfg(not(windows))]
fn read() -> Option<String> {
    None
}
