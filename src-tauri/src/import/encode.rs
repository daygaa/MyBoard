//! Réencodage d'une image à la qualité choisie (IMP-20) : JPEG et WebP fixes. La résolution ne change pas (IMP-25)
//! et les pixels ne sont pas tournés : les informations de la photo (EXIF, rotation comprise), le XMP, l'IPTC et
//! le profil de couleurs de l'original sont recopiés tels quels. PNG : règles d'IMP-62 (`png_out.rs`). Autre format
//! choisi : conversion (`convert.rs`, IMP-21).

use std::io::Cursor;

use anyhow::{Context, bail};
use image::{DynamicImage, ImageReader};

use super::plan::Action;

/// Contenu réencodé ; `None` : image à ne jamais traiter (GIF ou WebP animé : l'animation serait perdue).
pub fn reencode(bytes: &[u8], action: Action) -> anyhow::Result<Option<Vec<u8>>> {
    let quality = match action {
        Action::Convert { target, quality, compressed } => return super::convert::convert(bytes, target, quality, compressed),
        Action::Compress(quality) => quality,
    };
    if bytes.starts_with(&[0xFF, 0xD8]) {
        return jpeg(bytes, quality).map(Some);
    }
    if bytes.len() > 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return webp(bytes, quality);
    }
    if bytes.starts_with(b"\x89PNG") {
        let Some(source) = super::convert::read(bytes)? else { return Ok(None) };
        return super::png_out::encode(source.img, &source.meta, Some(quality)).map(Some);
    }
    bail!("contenu ni JPEG, ni WebP, ni PNG")
}

/// WebP animé (drapeau « animation » de l'en-tête VP8X).
pub fn animated_webp(bytes: &[u8]) -> bool {
    bytes.len() > 20 && &bytes[12..16] == b"VP8X" && bytes[20] & 0x02 != 0
}

fn decode(bytes: &[u8]) -> anyhow::Result<DynamicImage> {
    // Sans appliquer la rotation EXIF : elle reste dans les informations recopiées.
    Ok(ImageReader::new(Cursor::new(bytes)).with_guessed_format()?.decode()?)
}

fn jpeg(bytes: &[u8], quality: u8) -> anyhow::Result<Vec<u8>> {
    let (segments, components) = jpeg_segments(bytes);
    // CMJN (imprimerie) : le profil de couleurs de l'original ne correspondrait plus aux pixels.
    if components == Some(4) {
        bail!("JPEG en CMJN");
    }
    let img = decode(bytes)?;
    let (w, h) = (u16::try_from(img.width())?, u16::try_from(img.height())?);
    let mut out = Vec::with_capacity(bytes.len());
    let mut encoder = jpeg_encoder::Encoder::new(&mut out, quality);
    // Pas de tables de Huffman optimisées : avec elles, le crate écrit les 3 couleurs en passes séparées (JPEG valide
    // mais rare), que le décodeur des miniatures lit mal (miniatures vertes et rayées, IMP-61).
    for (marker, data) in segments {
        encoder.add_app_segment(marker - 0xE0, data).context("informations de la photo")?;
    }
    if components == Some(1) {
        encoder.encode(img.to_luma8().as_raw(), w, h, jpeg_encoder::ColorType::Luma)?;
    } else {
        encoder.encode(img.to_rgb8().as_raw(), w, h, jpeg_encoder::ColorType::Rgb)?;
    }
    Ok(out)
}

/// Segments de l'en-tête à recopier (EXIF, XMP, profil de couleurs, IPTC) et nombre de composantes de l'image.
/// Les autres segments ne sont pas repris : ils décrivent l'ancien encodage (Adobe) ou des images annexes (MPF).
fn jpeg_segments(bytes: &[u8]) -> (Vec<(u8, &[u8])>, Option<u8>) {
    let mut kept = Vec::new();
    let mut components = None;
    let mut i = 2;
    while i + 4 <= bytes.len() && bytes[i] == 0xFF {
        let marker = bytes[i + 1];
        if marker == 0xFF {
            i += 1; // octet de remplissage
            continue;
        }
        if marker == 0x01 || (0xD0..=0xD7).contains(&marker) {
            i += 2;
            continue;
        }
        if marker == 0xDA {
            break; // début des données de l'image
        }
        let len = u16::from_be_bytes([bytes[i + 2], bytes[i + 3]]) as usize;
        let Some(data) = bytes.get(i + 4..i + 2 + len) else { break };
        let keep = match marker {
            0xE1 => data.starts_with(b"Exif\0") || data.starts_with(b"http://ns.adobe.com/"),
            0xE2 => data.starts_with(b"ICC_PROFILE\0"),
            0xED => data.starts_with(b"Photoshop 3.0\0"),
            _ => false,
        };
        if keep {
            kept.push((marker, data));
        }
        if matches!(marker, 0xC0..=0xCF) && !matches!(marker, 0xC4 | 0xC8 | 0xCC) {
            components = data.get(5).copied();
        }
        i += 2 + len;
    }
    (kept, components)
}

fn webp(bytes: &[u8], quality: u8) -> anyhow::Result<Option<Vec<u8>>> {
    let chunks = riff_chunks(bytes);
    // Drapeau « animation » de l'en-tête VP8X.
    if chunks.iter().any(|(id, data)| id == b"VP8X" && data.first().is_some_and(|f| f & 0x02 != 0)) {
        return Ok(None);
    }
    let meta = |name: &[u8; 4]| chunks.iter().find(|(id, _)| id == name).map(|(_, d)| *d);
    let img = decode(bytes)?;
    let (w, h) = (img.width(), img.height());
    let encoded = if img.color().has_alpha() {
        webp::Encoder::from_rgba(img.to_rgba8().as_raw(), w, h).encode(f32::from(quality)).to_vec()
    } else {
        webp::Encoder::from_rgb(img.to_rgb8().as_raw(), w, h).encode(f32::from(quality)).to_vec()
    };
    Ok(Some(with_meta(&encoded, w, h, meta(b"ICCP"), meta(b"EXIF"), meta(b"XMP "))))
}

/// Morceaux d'un fichier WebP (conteneur RIFF), après l'en-tête de 12 octets.
fn riff_chunks(bytes: &[u8]) -> Vec<([u8; 4], &[u8])> {
    let mut chunks = Vec::new();
    let mut i = 12;
    while i + 8 <= bytes.len() {
        let id: [u8; 4] = bytes[i..i + 4].try_into().unwrap_or_default();
        let len = u32::from_le_bytes(bytes[i + 4..i + 8].try_into().unwrap_or_default()) as usize;
        let Some(data) = bytes.get(i + 8..i + 8 + len) else { break };
        chunks.push((id, data));
        i += 8 + len + (len & 1);
    }
    chunks
}

/// WebP « étendu » (en-tête VP8X) avec le profil de couleurs, l'EXIF et le XMP de l'original.
pub fn with_meta(encoded: &[u8], w: u32, h: u32, icc: Option<&[u8]>, exif: Option<&[u8]>, xmp: Option<&[u8]>) -> Vec<u8> {
    if icc.is_none() && exif.is_none() && xmp.is_none() {
        return encoded.to_vec();
    }
    let image: Vec<_> = riff_chunks(encoded).into_iter().filter(|(id, _)| id != b"VP8X").collect();
    let mut flags = 0u8;
    if image.iter().any(|(id, _)| id == b"ALPH") {
        flags |= 0x10;
    }
    flags |= if icc.is_some() { 0x20 } else { 0 } | if exif.is_some() { 0x08 } else { 0 } | if xmp.is_some() { 0x04 } else { 0 };
    let mut vp8x = vec![flags, 0, 0, 0];
    vp8x.extend_from_slice(&(w - 1).to_le_bytes()[..3]);
    vp8x.extend_from_slice(&(h - 1).to_le_bytes()[..3]);

    let mut body = b"WEBP".to_vec();
    let mut push = |id: &[u8; 4], data: &[u8]| {
        body.extend_from_slice(id);
        body.extend_from_slice(&(data.len() as u32).to_le_bytes());
        body.extend_from_slice(data);
        if data.len() % 2 == 1 {
            body.push(0);
        }
    };
    push(b"VP8X", &vp8x);
    if let Some(icc) = icc {
        push(b"ICCP", icc);
    }
    for (id, data) in &image {
        push(id, data);
    }
    if let Some(exif) = exif {
        push(b"EXIF", exif);
    }
    if let Some(xmp) = xmp {
        push(b"XMP ", xmp);
    }
    let mut out = b"RIFF".to_vec();
    out.extend_from_slice(&(body.len() as u32).to_le_bytes());
    out.extend_from_slice(&body);
    out
}
