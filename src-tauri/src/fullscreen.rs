//! Plein écran de la visionneuse (VIEW-18, VIEW-34) pour une fenêtre sans barre de titre Windows
//! (NAV-04).
//!
//! Le plein écran de Tauri garde, pour une fenêtre AGRANDIE sans barre de titre, la zone de dessin
//! au-dessus de la barre des tâches (mesuré le 13/10/2026 : 1040 px de haut au lieu de 1080). Retirer
//! puis remettre l'état « agrandie » faisait sauter l'image en sortant (fenêtre normale pendant
//! 3 images, ou animation d'agrandissement de Windows pendant 11 images : écran filmé à 60 i/s).
//!
//! Ici, la fenêtre reste agrandie du début à la fin, et trois choses sont interceptées :
//! - la zone de dessin (`WM_NCCALCSIZE`) : plein écran demandé ET fenêtre couvrant tout l'écran =
//!   zone de dessin sur tout l'écran ; sinon, rien ne change ;
//! - la position (`WM_WINDOWPOSCHANGING`) : agrandie, une fenêtre déborde de l'écran de 8 px de
//!   chaque côté (bordures invisibles, que Windows impose aux fenêtres au style « barre de titre »,
//!   gardé pour ses animations : mesuré le 14/10/2026). En plein écran, son coin (gauche, haut)
//!   garde ce débordement au lieu de commencer pile au bord : sinon il bougeait de 8 px et l'image
//!   apparaissait décalée pendant 1 à 3 images (« tremblement », filmé le 13/10/2026). À droite
//!   et en bas, le débordement n'est gardé que s'il ne tombe pas sur un écran voisin, où la
//!   bordure de Windows dessinait une ligne de 2 px. Limite : un écran voisin à gauche ou
//!   au-dessus garde cette ligne (le coin ne peut pas bouger sans tremblement). En entrant, la
//!   fenêtre prend sa place dès le premier changement de Tauri (il change le style ~70 ms avant
//!   la taille : le débordement sur l'écran voisin s'y voyait le temps d'une image, mesuré) ;
//! - le style (`WM_STYLECHANGING`) : en plein écran, Tauri retire les bordures de la fenêtre ; le
//!   débordement n'était alors plus invisible mais peint en noir sur l'écran voisin (mesuré). La
//!   fenêtre garde donc sa bordure de redimensionnement (invisible). En sortant, le style « barre
//!   de titre » n'est remis qu'une fois la bascule finie (`CAPTION_DELAY`) : remis tout de suite,
//!   Windows reposait le débordement sur l'écran voisin, peint en noir le temps d'une image
//!   (bande de 8 px, environ 1 sortie sur 20, mesuré le 14/10/2026).
//!
//! Entrer = seul le bas (et, s'il y a un écran voisin, le bord droit) de la fenêtre bouge ;
//! sortir = l'inverse.

use std::sync::atomic::{AtomicBool, AtomicI32, AtomicUsize, Ordering};
use std::time::Duration;

/// Plein écran demandé par la visionneuse.
static FULLSCREEN: AtomicBool = AtomicBool::new(false);
/// Débordement de la fenêtre agrandie à gauche et en haut de l'écran, en pixels.
static OVERHANG_X: AtomicI32 = AtomicI32::new(0);
static OVERHANG_Y: AtomicI32 = AtomicI32::new(0);
/// Sortie du plein écran en cours : la fenêtre reste sans style « barre de titre » (donc sans
/// débordement imposé par Windows) jusqu'à ce qu'il soit remis.
static LEAVING: AtomicBool = AtomicBool::new(false);
/// Numéro de la dernière bascule : une remise du style prévue pour une bascule dépassée (appuis
/// rapides sur F) est ignorée.
static SWITCH: AtomicUsize = AtomicUsize::new(0);
/// Message propre à MyBoard (`WM_APP` + 0x4D) : remettre le style « barre de titre ».
const WM_CAPTION_BACK: u32 = 0x8000 + 0x4D;
/// Délai avant de remettre ce style : la bascule (fenêtre et page) est finie.
const CAPTION_DELAY: Duration = Duration::from_millis(400);

#[tauri::command]
pub fn set_viewer_fullscreen(window: tauri::WebviewWindow, on: bool) -> Result<(), String> {
    if on {
        let (x, y) = maximized_overhang(&window);
        OVERHANG_X.store(x, Ordering::SeqCst);
        OVERHANG_Y.store(y, Ordering::SeqCst);
    }
    // Avant Tauri : ses calculs de style, de position et de zone de dessin passent déjà par ces
    // règles.
    let switch = SWITCH.fetch_add(1, Ordering::SeqCst) + 1;
    LEAVING.store(!on, Ordering::SeqCst);
    FULLSCREEN.store(on, Ordering::SeqCst);
    let result = window.set_fullscreen(on).map_err(|e| e.to_string());
    if !on {
        caption_back_later(&window, switch);
    }
    result
}

/// Demande, après `CAPTION_DELAY`, la remise du style « barre de titre » (fil de la fenêtre).
#[cfg(windows)]
fn caption_back_later(window: &tauri::WebviewWindow, switch: usize) {
    use windows_sys::Win32::UI::WindowsAndMessaging::PostMessageW;

    let Ok(hwnd) = window.hwnd() else { return };
    // La fenêtre ne passe pas d'un fil à l'autre ; son numéro, si.
    let hwnd = hwnd.0 as isize;
    std::thread::spawn(move || {
        std::thread::sleep(CAPTION_DELAY);
        // SAFETY : simple message posté à la fenêtre ; sans effet si elle n'existe plus.
        unsafe { PostMessageW(hwnd as _, WM_CAPTION_BACK, switch, 0) };
    });
}

#[cfg(not(windows))]
fn caption_back_later(_window: &tauri::WebviewWindow, _switch: usize) {}

/// Branche l'interception sur la fenêtre (une fois, au démarrage, depuis le fil de la fenêtre).
#[cfg(windows)]
pub fn install(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    use windows_sys::Win32::UI::Shell::SetWindowSubclass;

    let hwnd = window.hwnd()?;
    // SAFETY : la fenêtre est vivante et appartient à ce fil ; `interception` ne garde aucun état
    // propre. Identifiant propre à MyBoard, distinct de ceux de Tauri.
    unsafe { SetWindowSubclass(hwnd.0, Some(interception), 0x4D59_424F, 0) };
    Ok(())
}

#[cfg(not(windows))]
pub fn install(_window: &tauri::WebviewWindow) -> tauri::Result<()> {
    Ok(())
}

/// Débordement (gauche, haut) de la fenêtre si elle est agrandie : coin de la zone de dessin moins
/// coin de la fenêtre. Fenêtre non agrandie : aucun.
#[cfg(windows)]
fn maximized_overhang(window: &tauri::WebviewWindow) -> (i32, i32) {
    use windows_sys::Win32::Foundation::{POINT, RECT};
    use windows_sys::Win32::Graphics::Gdi::ClientToScreen;
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetWindowRect, IsZoomed};

    let Ok(hwnd) = window.hwnd() else { return (0, 0) };
    let hwnd = hwnd.0;
    // SAFETY : lectures seules sur la fenêtre vivante de MyBoard.
    unsafe {
        if IsZoomed(hwnd) == 0 {
            return (0, 0);
        }
        let mut frame: RECT = std::mem::zeroed();
        let mut corner = POINT { x: 0, y: 0 };
        if GetWindowRect(hwnd, &mut frame) == 0 || ClientToScreen(hwnd, &mut corner) == 0 {
            return (0, 0);
        }
        ((corner.x - frame.left).max(0), (corner.y - frame.top).max(0))
    }
}

#[cfg(not(windows))]
fn maximized_overhang(_window: &tauri::WebviewWindow) -> (i32, i32) {
    (0, 0)
}

#[cfg(windows)]
type Rect = windows_sys::Win32::Foundation::RECT;

/// Écran (entier) et zone de travail (sans la barre des tâches) de l'écran qui contient `rect`.
#[cfg(windows)]
fn monitor_of(rect: &Rect) -> Option<windows_sys::Win32::Graphics::Gdi::MONITORINFO> {
    use windows_sys::Win32::Graphics::Gdi::{GetMonitorInfoW, MONITOR_DEFAULTTONEAREST, MONITORINFO, MonitorFromRect};

    // SAFETY : appels Windows en lecture seule.
    unsafe {
        let mut info: MONITORINFO = std::mem::zeroed();
        info.cbSize = size_of::<MONITORINFO>() as u32;
        (GetMonitorInfoW(MonitorFromRect(rect, MONITOR_DEFAULTTONEAREST), &mut info) != 0).then_some(info)
    }
}

/// Un écran touche-t-il ce rectangle (bande d'un pixel juste au-delà d'un bord de l'écran) ?
#[cfg(windows)]
fn neighbor(strip: &Rect) -> bool {
    use windows_sys::Win32::Graphics::Gdi::{MONITOR_DEFAULTTONULL, MonitorFromRect};

    // SAFETY : appel Windows en lecture seule.
    !unsafe { MonitorFromRect(strip, MONITOR_DEFAULTTONULL) }.is_null()
}

/// Débordement gardé à droite et en bas de l'écran : aucun s'il tomberait sur un écran voisin.
#[cfg(windows)]
fn outer_overhangs(screen: &Rect, x: i32, y: i32) -> (i32, i32) {
    let beyond_right = Rect { left: screen.right, top: screen.top, right: screen.right + 1, bottom: screen.bottom };
    let beyond_bottom = Rect { left: screen.left, top: screen.bottom, right: screen.right, bottom: screen.bottom + 1 };
    (if neighbor(&beyond_right) { 0 } else { x }, if neighbor(&beyond_bottom) { 0 } else { y })
}

#[cfg(windows)]
fn same(a: &Rect, b: &Rect) -> bool {
    a.left == b.left && a.top == b.top && a.right == b.right && a.bottom == b.bottom
}

/// `outer` déborde-t-il de `inner` de tous les côtés (au sens large) ?
#[cfg(windows)]
fn covers(outer: &Rect, inner: &Rect) -> bool {
    outer.left <= inner.left && outer.top <= inner.top && outer.right >= inner.right && outer.bottom >= inner.bottom
}

/// Rectangle qu'aura la fenêtre (position ou taille gardées si Windows le précise).
#[cfg(windows)]
fn resulting_rect(
    hwnd: windows_sys::Win32::Foundation::HWND,
    pos: &windows_sys::Win32::UI::WindowsAndMessaging::WINDOWPOS,
) -> Rect {
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetWindowRect, SWP_NOMOVE, SWP_NOSIZE};

    let mut current: Rect = Rect { left: 0, top: 0, right: 0, bottom: 0 };
    // SAFETY : lecture seule sur la fenêtre vivante.
    unsafe { GetWindowRect(hwnd, &mut current) };
    let (left, top) = if pos.flags & SWP_NOMOVE != 0 { (current.left, current.top) } else { (pos.x, pos.y) };
    let (cx, cy) = if pos.flags & SWP_NOSIZE != 0 {
        (current.right - current.left, current.bottom - current.top)
    } else {
        (pos.cx, pos.cy)
    };
    Rect { left, top, right: left + cx, bottom: top + cy }
}

/// Pose la fenêtre sur `rect` (même si Windows ne demandait ni déplacement ni redimensionnement).
#[cfg(windows)]
fn place(pos: &mut windows_sys::Win32::UI::WindowsAndMessaging::WINDOWPOS, rect: Rect) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{SWP_NOMOVE, SWP_NOSIZE};

    pos.x = rect.left;
    pos.y = rect.top;
    pos.cx = rect.right - rect.left;
    pos.cy = rect.bottom - rect.top;
    pos.flags &= !(SWP_NOMOVE | SWP_NOSIZE);
}

/// Style, position (coin immobile, rien sur l'écran voisin) et zone de dessin (tout l'écran) en
/// plein écran et à sa sortie.
#[cfg(windows)]
unsafe extern "system" fn interception(
    hwnd: windows_sys::Win32::Foundation::HWND,
    msg: u32,
    wparam: usize,
    lparam: isize,
    _id: usize,
    _data: usize,
) -> isize {
    use windows_sys::Win32::UI::Shell::DefSubclassProc;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GWL_STYLE, GetWindowLongW, NCCALCSIZE_PARAMS, STYLESTRUCT, SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE,
        SWP_NOSIZE, SWP_NOZORDER, SetWindowLongW, SetWindowPos, WINDOWPOS, WM_NCCALCSIZE, WM_STYLECHANGING,
        WM_WINDOWPOSCHANGING, WS_CAPTION, WS_THICKFRAME,
    };

    let fullscreen = FULLSCREEN.load(Ordering::SeqCst);
    let leaving = LEAVING.load(Ordering::SeqCst) && !fullscreen;

    if msg == WM_CAPTION_BACK {
        if leaving && wparam == SWITCH.load(Ordering::SeqCst) {
            LEAVING.store(false, Ordering::SeqCst);
            // Windows repose ici le débordement de la fenêtre agrandie : bascule finie, rien ne
            // bouge plus à l'écran.
            // SAFETY : fenêtre vivante, sur son fil (message traité par elle).
            unsafe {
                SetWindowLongW(hwnd, GWL_STYLE, GetWindowLongW(hwnd, GWL_STYLE) | WS_CAPTION as i32);
                let flags = SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE;
                SetWindowPos(hwnd, std::ptr::null_mut(), 0, 0, 0, 0, flags);
            }
        }
        return 0;
    }
    if !fullscreen && !leaving {
        // SAFETY : suite normale du traitement du message (Tauri, puis Windows).
        return unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) };
    }

    if msg == WM_STYLECHANGING && wparam as i32 == GWL_STYLE {
        // SAFETY : pour WM_STYLECHANGING, lparam pointe sur l'ancien et le nouveau style.
        let change = unsafe { &mut *(lparam as *mut STYLESTRUCT) };
        if fullscreen {
            // Tauri retire les bordures du plein écran : on garde la bordure de redimensionnement
            // de la fenêtre agrandie (débordement invisible) ; pas le titre, avec lequel Windows
            // refuse d'agrandir la fenêtre au-delà de la zone de travail (mesuré).
            change.styleNew |= change.styleOld & WS_THICKFRAME;
        } else {
            // Sortie : Tauri rend ses styles ; le titre attendra la fin de la bascule.
            change.styleNew &= !WS_CAPTION;
        }
    } else if msg == WM_WINDOWPOSCHANGING {
        // Tauri d'abord : en plein écran, il recale la fenêtre pile sur l'écran ; la place de la
        // fenêtre est corrigée APRÈS lui (Windows lit la position une fois le message traité).
        // SAFETY : suite normale du traitement du message.
        let result = unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) };
        // SAFETY : pour WM_WINDOWPOSCHANGING, lparam pointe sur la position demandée.
        let pos = unsafe { &mut *(lparam as *mut WINDOWPOS) };
        let asked = resulting_rect(hwnd, pos);
        if let Some(m) = monitor_of(&asked) {
            let (s, w) = (m.rcMonitor, m.rcWork);
            let (x, y) = (OVERHANG_X.load(Ordering::SeqCst), OVERHANG_Y.load(Ordering::SeqCst));
            let (right, below) = outer_overhangs(&s, x, y);
            if fullscreen {
                // Tauri demande l'écran entier, ou change d'abord le style de la fenêtre encore
                // agrandie : elle prend tout de suite sa place de plein écran, coin immobile.
                if same(&asked, &s) || (covers(&asked, &w) && !covers(&asked, &s)) {
                    place(pos, Rect { left: s.left - x, top: s.top - y, right: s.right + right, bottom: s.bottom + below });
                }
            } else if covers(&asked, &w) {
                // Sortie : de nouveau agrandie (zone de travail et débordement), sauf du côté
                // d'un écran voisin tant que le titre n'est pas revenu.
                place(pos, Rect { left: w.left - x, top: w.top - y, right: w.right + right, bottom: w.bottom + y });
            }
        }
        return result;
    } else if msg == WM_NCCALCSIZE && wparam != 0 && fullscreen {
        // SAFETY : pour WM_NCCALCSIZE avec wparam non nul, lparam pointe sur NCCALCSIZE_PARAMS.
        let params = unsafe { &mut *(lparam as *mut NCCALCSIZE_PARAMS) };
        let window = params.rgrc[0];
        if let Some(screen) = monitor_of(&window).map(|m| m.rcMonitor).filter(|s| covers(&window, s)) {
            params.rgrc[0] = screen;
            return 0;
        }
    }
    // SAFETY : suite normale du traitement du message (Tauri, puis Windows).
    unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) }
}
