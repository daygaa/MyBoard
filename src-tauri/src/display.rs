//! Densité réelle de l'écran où se trouve la fenêtre (GRID-11) : points par pouce mesurés par
//! Windows à partir de la taille physique que l'écran annonce (EDID). L'interface s'en sert pour
//! régler les vignettes selon leur taille réelle, en centimètres, quel que soit l'écran.
//! Mesuré le 13/10/2026 : 93 pour l'écran 24" 1920×1080, 108 pour l'écran 27" 2560×1440.

/// Points par pouce réels de l'écran de la fenêtre ; `None` si l'écran ne donne pas sa taille.
#[tauri::command]
pub fn screen_dpi(window: tauri::WebviewWindow) -> Option<u32> {
    raw_dpi(&window)
}

#[cfg(windows)]
fn raw_dpi(window: &tauri::WebviewWindow) -> Option<u32> {
    use windows_sys::Win32::Graphics::Gdi::{MONITOR_DEFAULTTONEAREST, MonitorFromWindow};
    use windows_sys::Win32::UI::HiDpi::{GetDpiForMonitor, MDT_RAW_DPI};

    let hwnd = window.hwnd().ok()?.0;
    let (mut x, mut y) = (0u32, 0u32);
    // SAFETY : appels Windows en lecture seule ; `hwnd` est la fenêtre vivante de MyBoard.
    let result = unsafe {
        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        GetDpiForMonitor(monitor, MDT_RAW_DPI, &mut x, &mut y)
    };
    (result == 0 && x > 0).then_some(x)
}

#[cfg(not(windows))]
fn raw_dpi(_window: &tauri::WebviewWindow) -> Option<u32> {
    None
}
