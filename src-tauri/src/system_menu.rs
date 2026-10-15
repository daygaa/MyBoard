//! Menu de la fenêtre (CTX-13). La barre de titre de Windows est retirée (NAV-04) : son menu
//! (Restaurer, Déplacer, Taille, Réduire, Agrandir, Fermer) est remplacé par celui de MyBoard,
//! ouvert au clic droit sur la barre de titre de MyBoard ou par Alt + Espace. Alt + Espace
//! ouvrait encore celui de Windows : la commande est interceptée ici et l'interface ouvre le sien.
//! Les entrées envoient à la fenêtre les commandes mêmes de Windows (animations comprises ;
//! Déplacer et Taille : déplacement au clavier, comme dans Windows).

use tauri::{AppHandle, Emitter, WebviewWindow};

/// Événement envoyé à l'interface (`EVENTS.windowMenu`).
const OPEN_MENU: &str = "menu-fenetre";

#[cfg(windows)]
static APP: std::sync::OnceLock<AppHandle> = std::sync::OnceLock::new();

/// Branche l'interception d'Alt + Espace (une fois, au démarrage).
#[cfg(windows)]
pub fn install(app: &AppHandle, window: &WebviewWindow) -> tauri::Result<()> {
    use windows_sys::Win32::UI::Shell::SetWindowSubclass;

    let _ = APP.set(app.clone());
    // SAFETY : fenêtre vivante de MyBoard, sur son fil ; `alt_space` ne garde aucun état.
    // Identifiant propre à MyBoard, distinct de ceux de Tauri et des autres interceptions.
    unsafe { SetWindowSubclass(window.hwnd()?.0, Some(alt_space), 0x4D59_4D4E, 0) };
    Ok(())
}

#[cfg(not(windows))]
pub fn install(_app: &AppHandle, _window: &WebviewWindow) -> tauri::Result<()> {
    Ok(())
}

#[cfg(windows)]
unsafe extern "system" fn alt_space(
    hwnd: windows_sys::Win32::Foundation::HWND,
    msg: u32,
    wparam: usize,
    lparam: isize,
    _id: usize,
    _data: usize,
) -> isize {
    use windows_sys::Win32::UI::Shell::DefSubclassProc;
    use windows_sys::Win32::UI::WindowsAndMessaging::{SC_KEYMENU, WM_SYSCOMMAND};

    // Alt + Espace : « menu clavier » demandé avec la touche Espace (Alt seul : autre chose).
    if msg == WM_SYSCOMMAND && (wparam & 0xFFF0) as u32 == SC_KEYMENU && lparam == isize::from(b' ') {
        if let Some(app) = APP.get() {
            let _ = app.emit(OPEN_MENU, ());
        }
        return 0;
    }
    // SAFETY : suite normale du traitement du message (autres interceptions, Tauri, Windows).
    unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) }
}

/// Entrée du menu de la fenêtre : la commande de Windows correspondante, envoyée à la fenêtre.
#[tauri::command]
pub fn window_command(window: WebviewWindow, command: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            PostMessageW, SC_CLOSE, SC_MAXIMIZE, SC_MINIMIZE, SC_MOVE, SC_RESTORE, SC_SIZE, WM_SYSCOMMAND,
        };
        let code = match command.as_str() {
            "restore" => SC_RESTORE,
            "move" => SC_MOVE,
            "size" => SC_SIZE,
            "minimize" => SC_MINIMIZE,
            "maximize" => SC_MAXIMIZE,
            "close" => SC_CLOSE,
            other => return Err(format!("commande de fenêtre inconnue : {other}")),
        };
        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0;
        // SAFETY : message posté (pas attendu) à la fenêtre vivante de MyBoard : Déplacer et Taille
        // ouvrent une boucle de Windows qui ne doit pas bloquer l'appel.
        unsafe { PostMessageW(hwnd, WM_SYSCOMMAND, code as usize, 0) };
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = (window, command);
        Err("Menu de la fenêtre : Windows seulement.".into())
    }
}
