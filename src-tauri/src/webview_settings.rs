//! Réglages de WebView2 que Tauri ne propose pas. Ils valent pour la page ET pour ses cadres (le
//! lecteur PDF de la visionneuse), que le code de la page ne voit pas :
//! - le menu du clic droit du navigateur n'apparaît plus nulle part (CTX-01) : seuls ceux de
//!   MyBoard s'ouvrent (l'événement `contextmenu` arrive toujours à la page) ;
//! - raccourcis du navigateur sans objet dans une application (GEN-18) : F5, Maj + F5, Ctrl + F5
//!   (recharger), Ctrl + P (imprimer la page), Ctrl + F, F3, Ctrl + G (rechercher dans la page),
//!   Ctrl + S (enregistrer la page), F7 (navigation au clavier dans le texte). Ctrl + R et
//!   Ctrl + Maj + R restent (choix de l'utilisateur). Alt + ← / → ne font plus le retour du
//!   navigateur : la page en fait le précédent / suivant de MyBoard (`lib/browserKeys.ts`).
//!   Les touches arrivent toujours à la page, seule l'action du navigateur est retirée.

/// Applique les réglages (une fois, au démarrage).
#[cfg(windows)]
pub fn install(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    use webview2_com::AcceleratorKeyPressedEventHandler;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_KEY_EVENT_KIND, COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN, COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN,
        ICoreWebView2AcceleratorKeyPressedEventArgs2,
    };
    use windows_core::Interface;

    window.with_webview(|webview| {
        let controller = webview.controller();
        // SAFETY : objets COM vivants de WebView2, appelés sur le fil de la fenêtre (`with_webview`).
        unsafe {
            if let Ok(settings) = controller.CoreWebView2().and_then(|core| core.Settings()) {
                let _ = settings.SetAreDefaultContextMenusEnabled(false);
            }
            let handler = AcceleratorKeyPressedEventHandler::create(Box::new(|_, args| {
                let Some(args) = args else { return Ok(()) };
                let mut kind = COREWEBVIEW2_KEY_EVENT_KIND::default();
                let mut key = 0;
                args.KeyEventKind(&mut kind)?;
                args.VirtualKey(&mut key)?;
                let down = kind == COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN || kind == COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN;
                if down && blocked(key) {
                    // Interface plus récente : présente dans tout WebView2 encore pris en charge.
                    if let Ok(args) = args.cast::<ICoreWebView2AcceleratorKeyPressedEventArgs2>() {
                        args.SetIsBrowserAcceleratorKeyEnabled(false)?;
                    }
                }
                Ok(())
            }));
            let mut token = 0;
            let _ = controller.add_AcceleratorKeyPressed(&handler, &mut token);
        }
    })
}

#[cfg(not(windows))]
pub fn install(_window: &tauri::WebviewWindow) -> tauri::Result<()> {
    Ok(())
}

/// Raccourci du navigateur à retirer (GEN-18) ? `key` : code de touche virtuelle de Windows.
#[cfg(windows)]
fn blocked(key: u32) -> bool {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetKeyState, VK_CONTROL, VK_F3, VK_F5, VK_F7, VK_LEFT, VK_MENU, VK_RIGHT};

    // SAFETY : état des touches au moment du message clavier en cours (même fil).
    let pressed = |vk: u16| unsafe { GetKeyState(i32::from(vk)) } < 0;
    let (ctrl, alt) = (pressed(VK_CONTROL), pressed(VK_MENU));
    match u16::try_from(key).unwrap_or(0) {
        VK_F5 | VK_F3 | VK_F7 => true,
        k if b"PFGS".map(u16::from).contains(&k) => ctrl && !alt,
        VK_LEFT | VK_RIGHT => alt && !ctrl,
        _ => false,
    }
}
