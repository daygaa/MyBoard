//! Variable réservée aux tests `MYBOARD_MONITOR` (DEV-05) : ouvre la fenêtre, agrandie, sur
//! l'écran choisi — par sa définition (`1920x1080`) ou son nom Windows (`DISPLAY1`).
//! Sans la variable, rien ne change : Windows choisit l'écran comme d'habitude.

use tauri::{Monitor, PhysicalPosition, WebviewWindow};

pub fn place(window: &WebviewWindow) -> tauri::Result<()> {
    let Ok(wanted) = std::env::var("MYBOARD_MONITOR") else { return Ok(()) };
    let wanted = wanted.trim().to_ascii_lowercase();
    let Some(monitor) = window.available_monitors()?.into_iter().find(|m| matches(m, &wanted)) else {
        eprintln!("MYBOARD_MONITOR : aucun écran « {wanted} »");
        return Ok(());
    };
    // Une fenêtre agrandie ne se déplace pas : on la rétablit, on la pose sur l'écran,
    // puis on l'agrandit de nouveau (elle remplit alors CET écran).
    window.unmaximize()?;
    let origin = monitor.position();
    window.set_position(PhysicalPosition::new(origin.x + 40, origin.y + 40))?;
    window.maximize()
}

fn matches(monitor: &Monitor, wanted: &str) -> bool {
    let size = monitor.size();
    let name = monitor.name().map(|n| n.trim_start_matches(r"\\.\").to_ascii_lowercase());
    format!("{}x{}", size.width, size.height) == wanted || name.as_deref() == Some(wanted)
}
