//! Bord haut de la fenêtre MyBoard (NAV-05). Windows agrandit une fenêtre en hauteur seulement
//! quand on double-clique sur son bord haut (curseur ↕) ; ici, ce double-clic l'agrandit comme le
//! bouton « Agrandir » de la barre de titre (choix de l'utilisateur). Le redimensionnement en
//! tirant ce bord ne change pas ; le bord bas garde le comportement de Windows.
//!
//! Sur une fenêtre sans barre de titre, la page (WebView2) recouvre tout : Tauri pose sur le bord
//! haut une petite fenêtre invisible qui reçoit ses clics et les transmet à la fenêtre MyBoard
//! (`TAURI_DRAG_RESIZE_BORDERS`). Le double-clic est donc intercepté sur elle.

/// Branche l'interception (une fois, au démarrage, depuis le fil de la fenêtre).
#[cfg(windows)]
pub fn install(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    use windows_sys::Win32::UI::Shell::SetWindowSubclass;
    use windows_sys::Win32::UI::WindowsAndMessaging::FindWindowExW;

    let wide = |text: &str| text.encode_utf16().chain(std::iter::once(0)).collect::<Vec<u16>>();
    let (class, name) = (wide("TAURI_DRAG_RESIZE_BORDERS"), wide("TAURI_DRAG_RESIZE_WINDOW"));
    let parent = window.hwnd()?.0;
    // SAFETY : recherche d'une fenêtre enfant de la fenêtre vivante de MyBoard, noms terminés par 0.
    let border = unsafe { FindWindowExW(parent, std::ptr::null_mut(), class.as_ptr(), name.as_ptr()) };
    if !border.is_null() {
        // SAFETY : fenêtre enfant vivante, sur le même fil ; `double_click` ne garde aucun état.
        // Identifiant propre à MyBoard, distinct de ceux de Tauri.
        unsafe { SetWindowSubclass(border, Some(double_click), 0x4D59_4244, 0) };
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn install(_window: &tauri::WebviewWindow) -> tauri::Result<()> {
    Ok(())
}

/// Double-clic sur le bord haut = agrandir la fenêtre MyBoard (comme le bouton carré ou un
/// double-clic sur une barre de titre de Windows, animation comprise).
#[cfg(windows)]
unsafe extern "system" fn double_click(
    border: windows_sys::Win32::Foundation::HWND,
    msg: u32,
    wparam: usize,
    lparam: isize,
    _id: usize,
    _data: usize,
) -> isize {
    use windows_sys::Win32::UI::Shell::DefSubclassProc;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetParent, HTTOP, SC_MAXIMIZE, SendMessageW, WM_NCLBUTTONDBLCLK, WM_SYSCOMMAND,
    };

    if msg == WM_NCLBUTTONDBLCLK && wparam == HTTOP as usize {
        // SAFETY : commande système standard envoyée à la fenêtre MyBoard (parente, vivante).
        unsafe { SendMessageW(GetParent(border), WM_SYSCOMMAND, SC_MAXIMIZE as usize, 0) };
        return 0;
    }
    // SAFETY : suite normale du traitement du message (Tauri, puis Windows).
    unsafe { DefSubclassProc(border, msg, wparam, lparam) }
}
