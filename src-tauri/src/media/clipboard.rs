//! « Copier » (VIEW-35) : met le fichier lui-même dans le presse-papiers de Windows, comme
//! Ctrl + C sur un fichier dans l'Explorateur. On peut ensuite le coller dans un dossier, une
//! conversation, un site… Le presse-papiers est vidé d'abord : un ancien texte copié ne reste pas
//! à côté du fichier.

use std::path::Path;

use super::OpenFailure;

/// Valeur Windows « le collage fait une copie » (et non un déplacement, comme après Ctrl + X).
#[cfg(windows)]
const DROPEFFECT_COPY: u32 = 1;

#[cfg(windows)]
pub fn copy_file(path: &Path) -> Result<(), OpenFailure> {
    use clipboard_win::{Clipboard, ErrorCode, options::DoClear, raw};

    // Code d'erreur Windows et message de Windows, comme les autres ouvertures (VIEW-28).
    let fail = |e: ErrorCode| OpenFailure::from(std::io::Error::from_raw_os_error(e.raw_code()));
    // Un autre programme peut tenir le presse-papiers un court instant : plusieurs essais.
    let _open = Clipboard::new_attempts(10).map_err(fail)?;
    raw::set_file_list_with(&[path.to_string_lossy()], DoClear).map_err(fail)?;
    if let Some(format) = raw::register_format("Preferred DropEffect") {
        raw::set_without_clear(format.get(), &DROPEFFECT_COPY.to_le_bytes()).map_err(fail)?;
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn copy_file(_path: &Path) -> Result<(), OpenFailure> {
    Err(OpenFailure::new(None, "Copier un fichier n'est possible que sous Windows."))
}
