//! Conversion d'une image dans un autre format (IMP-21) : JPG / JFIF, PNG, WebP, AVIF. Réponses du 10/11 : image
//! transparente vers JPG sur fond blanc ; AVIF écrit par ffmpeg (libaom). Les pixels sont tournés comme MyBoard affiche
//! l'image (rotation EXIF, jamais pour un WebP, LIB-18) et l'EXIF recopié est remis « droit ». EXIF et profil de
//! couleurs gardés ; en AVIF, ajoutés par MyBoard (ffmpeg ne sait pas les écrire, IMP-67).

use std::io::{Cursor, Write};
use std::path::Path;
use std::process::Stdio;
use std::sync::OnceLock;
use std::sync::atomic::{AtomicU64, Ordering};

use anyhow::{Context, bail};
use image::codecs::gif::GifDecoder;
use image::metadata::Orientation;
use image::{AnimationDecoder, DynamicImage, ImageDecoder, ImageFormat, ImageReader};

use super::plan::Target;
use super::png_out::{self, Meta};

/// Image décodée, tournée comme MyBoard l'affiche, avec ses informations.
pub struct Source {
    pub img: DynamicImage,
    pub meta: Meta,
}

/// Contenu converti ; `None` : image animée (jamais convertie).
pub fn convert(bytes: &[u8], target: Target, quality: u8, compressed: bool) -> anyhow::Result<Option<Vec<u8>>> {
    let Some(source) = read(bytes)? else { return Ok(None) };
    Ok(Some(match target {
        Target::Jpg | Target::Jfif => jpeg(source, quality)?,
        Target::Png => png_out::encode(source.img, &source.meta, compressed.then_some(quality))?,
        Target::Webp => webp(source, quality),
        Target::Avif => avif(source, quality)?,
    }))
}

/// Décode avec les informations de la photo ; `None` : GIF ou WebP animé.
pub fn read(bytes: &[u8]) -> anyhow::Result<Option<Source>> {
    let reader = ImageReader::new(Cursor::new(bytes)).with_guessed_format()?;
    let format = reader.format();
    if format == Some(ImageFormat::WebP) && super::encode::animated_webp(bytes) {
        return Ok(None);
    }
    if format == Some(ImageFormat::Gif) && GifDecoder::new(Cursor::new(bytes))?.into_frames().take(2).count() > 1 {
        return Ok(None);
    }
    let mut decoder = reader.into_decoder()?;
    let icc = decoder.icc_profile().ok().flatten();
    let exif = decoder.exif_metadata().ok().flatten();
    let orientation = if format == Some(ImageFormat::WebP) {
        Orientation::NoTransforms
    } else {
        decoder.orientation().unwrap_or(Orientation::NoTransforms)
    };
    let mut img = DynamicImage::from_decoder(decoder)?;
    img.apply_orientation(orientation);
    let exif = exif.map(|e| upright(e.strip_prefix(b"Exif\0\0").map(<[u8]>::to_vec).unwrap_or(e)));
    Ok(Some(Source { img, meta: Meta { icc, exif } }))
}

/// Remet la rotation EXIF (balise 0x0112) à « droit » : les pixels sont déjà tournés.
fn upright(mut tiff: Vec<u8>) -> Vec<u8> {
    let le = tiff.starts_with(b"II");
    let u16_at = |t: &[u8], o: usize| t.get(o..o + 2).map(|b| if le { u16::from_le_bytes([b[0], b[1]]) } else { u16::from_be_bytes([b[0], b[1]]) });
    let u32_at = |t: &[u8], o: usize| {
        t.get(o..o + 4).map(|b| if le { u32::from_le_bytes([b[0], b[1], b[2], b[3]]) } else { u32::from_be_bytes([b[0], b[1], b[2], b[3]]) })
    };
    let Some(ifd) = u32_at(&tiff, 4).map(|o| o as usize) else { return tiff };
    let count = u16_at(&tiff, ifd).unwrap_or(0) as usize;
    for k in 0..count {
        let entry = ifd + 2 + k * 12;
        if u16_at(&tiff, entry) == Some(0x0112) && entry + 10 <= tiff.len() {
            let one: [u8; 2] = if le { 1u16.to_le_bytes() } else { 1u16.to_be_bytes() };
            tiff[entry + 8..entry + 10].copy_from_slice(&one);
        }
    }
    tiff
}

/// JPG / JFIF : transparence posée sur un fond blanc (réponse Q3 du 10/11 ; réglage à venir : SET-17).
fn jpeg(source: Source, quality: u8) -> anyhow::Result<Vec<u8>> {
    let img = &source.img;
    let (w, h) = (u16::try_from(img.width())?, u16::try_from(img.height())?);
    let mut out = Vec::new();
    let mut encoder = jpeg_encoder::Encoder::new(&mut out, quality);
    if let Some(exif) = &source.meta.exif {
        let segment = [b"Exif\0\0".as_slice(), exif].concat();
        if segment.len() <= 65533 {
            encoder.add_app_segment(1, &segment).context("informations de la photo")?;
        }
    }
    if let Some(icc) = &source.meta.icc {
        encoder.add_icc_profile(icc).context("profil de couleurs")?;
    }
    if img.color().has_color() || img.color().has_alpha() {
        encoder.encode(&on_white(img), w, h, jpeg_encoder::ColorType::Rgb)?;
    } else {
        encoder.encode(img.to_luma8().as_raw(), w, h, jpeg_encoder::ColorType::Luma)?;
    }
    Ok(out)
}

/// Pixels RVB, la transparence fondue sur du blanc.
fn on_white(img: &DynamicImage) -> Vec<u8> {
    if !img.color().has_alpha() {
        return img.to_rgb8().into_raw();
    }
    img.to_rgba8()
        .pixels()
        .flat_map(|p| {
            let a = u16::from(p[3]);
            let mix = |c: u8| ((u16::from(c) * a + 255 * (255 - a)) / 255) as u8;
            [mix(p[0]), mix(p[1]), mix(p[2])]
        })
        .collect()
}

fn webp(source: Source, quality: u8) -> Vec<u8> {
    let img = &source.img;
    let (w, h) = (img.width(), img.height());
    let encoded = if img.color().has_alpha() {
        webp::Encoder::from_rgba(img.to_rgba8().as_raw(), w, h).encode(f32::from(quality)).to_vec()
    } else {
        webp::Encoder::from_rgb(img.to_rgb8().as_raw(), w, h).encode(f32::from(quality)).to_vec()
    };
    super::encode::with_meta(&encoded, w, h, source.meta.icc.as_deref(), source.meta.exif.as_deref(), None)
}

/// AVIF par ffmpeg (libaom), image fixe ; transparence dans un second flux. Qualité 90 → crf 18, 50 → 38. Le flux de
/// la transparence reçoit un espace de couleurs ordinaire : celui de l'image RVB d'entrée (« identité ») lui est
/// interdit par libaom, qui refusait toute image transparente (défaut du lot 4, corrigé le 10/11).
fn avif(source: Source, quality: u8) -> anyhow::Result<Vec<u8>> {
    static FFMPEG: OnceLock<Option<crate::ffmpeg::Ffmpeg>> = OnceLock::new();
    static NEXT: AtomicU64 = AtomicU64::new(0);
    let ff = FFMPEG.get_or_init(crate::ffmpeg::detect).as_ref().context("ffmpeg introuvable : AVIF impossible")?;
    let img = &source.img;
    let alpha = img.color().has_alpha();
    let pixels = if alpha { img.to_rgba8().into_raw() } else { img.to_rgb8().into_raw() };
    let crf = (63 - i32::from(quality) / 2).clamp(10, 55).to_string();
    let size = format!("{}x{}", img.width(), img.height());
    // Le format AVIF demande un fichier (pas un flux) : fichier provisoire, effacé après lecture.
    let tmp = std::env::temp_dir().join(format!("myboard-{}-{}.avif", std::process::id(), NEXT.fetch_add(1, Ordering::Relaxed)));
    let mut cmd = crate::ffmpeg::command(&ff.ffmpeg);
    cmd.args(["-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", if alpha { "rgba" } else { "rgb24" }])
        .args(["-s", &size, "-i", "-"]);
    if alpha {
        cmd.args(["-filter_complex", "[0:v]split[c][a];[a]alphaextract,setparams=colorspace=bt709[al];[c]format=yuv420p[co]", "-map", "[co]", "-map", "[al]"]);
    } else {
        cmd.args(["-pix_fmt", "yuv420p"]);
    }
    cmd.args(["-frames:v", "1", "-c:v", "libaom-av1", "-still-picture", "1", "-crf", &crf, "-cpu-used", "6", "-row-mt", "1"])
        .arg(&tmp)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    let mut child = cmd.spawn().context("lancement de ffmpeg")?;
    let mut stdin = child.stdin.take().context("entrée de ffmpeg")?;
    let writer = std::thread::spawn(move || stdin.write_all(&pixels));
    let output = child.wait_with_output()?;
    let _ = writer.join();
    let result = std::fs::read(&tmp);
    let _ = std::fs::remove_file(&tmp);
    if !output.status.success() {
        bail!("ffmpeg (AVIF) : {}", String::from_utf8_lossy(&output.stderr).trim());
    }
    Ok(enrich(ff, result?, &source.meta, &tmp))
}

/// EXIF et profil de couleurs ajoutés par MyBoard (IMP-67), gardés seulement si ffmpeg relit ensuite l'image (et sa
/// transparence) sans erreur ; sinon l'AVIF est gardé sans eux (choix de l'utilisateur, 10/11).
fn enrich(ff: &crate::ffmpeg::Ffmpeg, plain: Vec<u8>, meta: &Meta, tmp: &Path) -> Vec<u8> {
    let Some(enriched) = super::avif_meta::add(&plain, meta.exif.as_deref(), meta.icc.as_deref()) else { return plain };
    let readable = std::fs::write(tmp, &enriched).is_ok()
        && crate::ffmpeg::command(&ff.ffmpeg)
            .args(["-hide_banner", "-loglevel", "error", "-i"])
            .arg(tmp)
            .args(["-map", "0", "-f", "null", "-"])
            .output()
            .is_ok_and(|o| o.status.success() && o.stderr.is_empty());
    let _ = std::fs::remove_file(tmp);
    if readable {
        enriched
    } else {
        eprintln!("[import] AVIF : informations de la photo non ajoutées (fichier relu avec erreur)");
        plain
    }
}
