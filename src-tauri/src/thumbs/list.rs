//! Aperçus de la liste avant l'import quand Windows n'en donne pas (IMP-10, IMP-59, IMP-78) : 1re page d'un PDF, image
//! lisible par MyBoard, sinon ffmpeg : image qu'il sait lire (AVIF, HEIC…) ou vidéo (image prise à 10 % de la durée,
//! comme sa miniature). Réponse Q3 A du 12/11 : avant, une vidéo n'était jamais lue ici (D-060) et gardait son icône.

use std::path::Path;

use ::image::DynamicImage;
use anyhow::Context;

use super::image::{THUMB_SIZE, fit_of, open_image, small_of};
use super::{is_pdf, pdf, video};
use crate::formats::{self, Kind};

/// Image d'où l'aperçu est tiré ; `side` : largeur de la page d'un PDF, ou petit côté de l'image prise par ffmpeg.
fn source(path: &Path, side: u32) -> anyhow::Result<DynamicImage> {
    if is_pdf(path) {
        return pdf::first_page(path, side);
    }
    let ext = formats::extension(path).unwrap_or_default();
    let ff = crate::ffmpeg::shared();
    match formats::kind_of_ext(&ext) {
        Some(Kind::Image) => open_image(path).or_else(|e| match ff {
            Some(ff) => video::list_frame(ff, path, false, side),
            None => Err(e),
        }),
        Some(Kind::Video) => video::list_frame(ff.context("ffmpeg introuvable")?, path, true, side),
        _ => anyhow::bail!("pas d'aperçu pour ce type de fichier"),
    }
}

/// Aperçu 128 px (carré) d'un fichier de la liste.
pub fn list_preview(path: &Path) -> anyhow::Result<Vec<u8>> {
    small_of(source(path, THUMB_SIZE)?)
}

/// Aperçu agrandi au survol d'une miniature de la liste (IMP-59), proportions gardées.
pub fn list_preview_fit(path: &Path, side: u32) -> anyhow::Result<Vec<u8>> {
    fit_of(source(path, side)?, side)
}
