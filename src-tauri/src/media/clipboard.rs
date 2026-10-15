//! « Copier » (VIEW-35) : met le fichier lui-même dans le presse-papiers de Windows, comme
//! Ctrl + C sur un fichier dans l'Explorateur. On peut ensuite le coller dans un dossier, une
//! conversation, un site… Le presse-papiers est vidé d'abord : un ancien texte copié ne reste pas
//! à côté du fichier.
//! « Copier l'image » (CTX-06) : l'image elle-même (ses pixels), comme « Copier l'image » d'un
//! navigateur, à coller dans Paint, une conversation, un document…

use std::path::Path;

use image::DynamicImage;

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

/// L'image dans le presse-papiers : en bitmap (lu par tous les programmes, Paint compris ; une
/// image transparente y est posée sur du blanc) et, si elle a de la transparence, aussi en PNG
/// (navigateurs, messageries, Office…).
#[cfg(windows)]
pub fn copy_image(image: &DynamicImage) -> Result<(), OpenFailure> {
    use std::io::Cursor;

    use clipboard_win::{Clipboard, ErrorCode, options::DoClear, raw};
    use image::{ImageFormat, Rgb, RgbImage};

    let fail = |e: ErrorCode| OpenFailure::from(std::io::Error::from_raw_os_error(e.raw_code()));
    let encode = |e: image::ImageError| OpenFailure::new(None, e.to_string());
    let transparent = image.color().has_alpha();
    let rgb = if transparent {
        let rgba = image.to_rgba8();
        RgbImage::from_fn(rgba.width(), rgba.height(), |x, y| {
            let [r, g, b, a] = rgba.get_pixel(x, y).0;
            let on_white = |c: u8| ((u32::from(c) * u32::from(a) + 255 * (255 - u32::from(a))) / 255) as u8;
            Rgb([on_white(r), on_white(g), on_white(b)])
        })
    } else {
        image.to_rgb8()
    };
    let mut bmp = Vec::new();
    DynamicImage::ImageRgb8(rgb).write_to(&mut Cursor::new(&mut bmp), ImageFormat::Bmp).map_err(encode)?;
    let _open = Clipboard::new_attempts(10).map_err(fail)?;
    raw::set_bitmap_with(&bmp, DoClear).map_err(fail)?;
    if transparent && let Some(format) = raw::register_format("PNG") {
        let mut png = Vec::new();
        image.write_to(&mut Cursor::new(&mut png), ImageFormat::Png).map_err(encode)?;
        raw::set_without_clear(format.get(), &png).map_err(fail)?;
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn copy_image(_image: &DynamicImage) -> Result<(), OpenFailure> {
    Err(OpenFailure::new(None, "Copier une image n'est possible que sous Windows."))
}
