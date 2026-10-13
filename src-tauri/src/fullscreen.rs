//! Plein écran de la visionneuse (VIEW-18, VIEW-34) pour une fenêtre sans barre de titre Windows
//! (NAV-04).
//!
//! Le plein écran de Tauri garde, pour une fenêtre AGRANDIE sans barre de titre, la zone de dessin
//! au-dessus de la barre des tâches (mesuré le 13/10/2026 : 1040 px de haut au lieu de 1080). Retirer
//! puis remettre l'état « agrandie » faisait sauter l'image en sortant (fenêtre normale pendant
//! 3 images, ou animation d'agrandissement de Windows pendant 11 images : écran filmé à 60 i/s).
//!
//! Ici, la fenêtre reste agrandie du début à la fin ; seul le calcul de sa zone de dessin
//! (`WM_NCCALCSIZE`) est intercepté : plein écran demandé ET fenêtre couvrant tout l'écran =
//! zone de dessin sur tout l'écran ; sinon, rien ne change. Entrer = le bas de la fenêtre descend
//! jusqu'en bas de l'écran ; sortir = il remonte. Le haut ne bouge jamais : rien ne saute.

use std::sync::atomic::{AtomicBool, Ordering};

/// Plein écran demandé par la visionneuse.
static FULLSCREEN: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub fn set_viewer_fullscreen(window: tauri::WebviewWindow, on: bool) -> Result<(), String> {
    // Avant Tauri : ses calculs de zone de dessin passent déjà par la nouvelle règle.
    FULLSCREEN.store(on, Ordering::SeqCst);
    window.set_fullscreen(on).map_err(|e| e.to_string())
}

/// Branche l'interception sur la fenêtre (une fois, au démarrage, depuis le fil de la fenêtre).
#[cfg(windows)]
pub fn install(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    use windows_sys::Win32::UI::Shell::SetWindowSubclass;

    let hwnd = window.hwnd()?;
    // SAFETY : la fenêtre est vivante et appartient à ce fil ; `zone_de_dessin` ne garde aucun état.
    // Identifiant propre à MyBoard, distinct de ceux de Tauri.
    unsafe { SetWindowSubclass(hwnd.0, Some(zone_de_dessin), 0x4D59_424F, 0) };
    Ok(())
}

#[cfg(not(windows))]
pub fn install(_window: &tauri::WebviewWindow) -> tauri::Result<()> {
    Ok(())
}

/// Zone de dessin = tout l'écran quand le plein écran est demandé et que la fenêtre le couvre.
#[cfg(windows)]
unsafe extern "system" fn zone_de_dessin(
    hwnd: windows_sys::Win32::Foundation::HWND,
    msg: u32,
    wparam: usize,
    lparam: isize,
    _id: usize,
    _data: usize,
) -> isize {
    use windows_sys::Win32::Graphics::Gdi::{GetMonitorInfoW, MONITOR_DEFAULTTONULL, MONITORINFO, MonitorFromRect};
    use windows_sys::Win32::UI::Shell::DefSubclassProc;
    use windows_sys::Win32::UI::WindowsAndMessaging::{NCCALCSIZE_PARAMS, WM_NCCALCSIZE};

    if msg == WM_NCCALCSIZE && wparam != 0 && FULLSCREEN.load(Ordering::SeqCst) {
        // SAFETY : pour WM_NCCALCSIZE avec wparam non nul, lparam pointe sur NCCALCSIZE_PARAMS.
        let params = unsafe { &mut *(lparam as *mut NCCALCSIZE_PARAMS) };
        let window = params.rgrc[0];
        let mut info: MONITORINFO = unsafe { std::mem::zeroed() };
        info.cbSize = size_of::<MONITORINFO>() as u32;
        // SAFETY : appels Windows en lecture seule.
        let found = unsafe { GetMonitorInfoW(MonitorFromRect(&window, MONITOR_DEFAULTTONULL), &mut info) } != 0;
        let screen = info.rcMonitor;
        let covers = window.left <= screen.left
            && window.top <= screen.top
            && window.right >= screen.right
            && window.bottom >= screen.bottom;
        if found && covers {
            params.rgrc[0] = screen;
            return 0;
        }
    }
    // SAFETY : suite normale du traitement du message (Tauri, puis Windows).
    unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) }
}
