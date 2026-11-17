//! Rotation d'une vidéo MP4 / MOV écrite dans le fichier (VIEW-60, réponse Q24 A) : la matrice d'affichage de la piste
//! vidéo (boîte `tkhd`, 36 octets) est réécrite sur place ; ni l'image ni le son ne sont touchés, le fichier garde sa
//! taille. Valeurs écrites comme ffmpeg et les iPhone (quart de tour + décalage), lues par WebView2 et ffmpeg.

use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::Path;

use anyhow::{Context, bail};

/// 1,0 en nombre à virgule fixe 16.16.
const ONE: i32 = 0x10000;
/// Boîte `moov` lue en mémoire au plus (index de la vidéo : quelques Mo même pour des heures).
const MAX_MOOV: u64 = 256 * 1024 * 1024;

/// Boîtes d'une suite de boîtes : (type, début du contenu, fin du contenu), positions dans `data`.
fn boxes(data: &[u8]) -> impl Iterator<Item = ([u8; 4], usize, usize)> + '_ {
    let mut at = 0usize;
    std::iter::from_fn(move || {
        let head = data.get(at..at + 8)?;
        let size32 = u32::from_be_bytes(head[..4].try_into().ok()?) as usize;
        let kind: [u8; 4] = head[4..8].try_into().ok()?;
        let (header, size) = match size32 {
            0 => (8, data.len() - at),
            1 => (16, usize::try_from(u64::from_be_bytes(data.get(at + 8..at + 16)?.try_into().ok()?)).ok()?),
            s => (8, s),
        };
        if size < header || at + size > data.len() {
            return None;
        }
        let found = (kind, at + header, at + size);
        at += size;
        Some(found)
    })
}

fn child<'a>(data: &'a [u8], kind: &[u8; 4]) -> Option<(usize, &'a [u8])> {
    boxes(data).find(|(k, ..)| k == kind).map(|(_, start, end)| (start, &data[start..end]))
}

/// Piste vidéo : `mdia` → `hdlr` de type « vide ».
fn is_video(trak: &[u8]) -> bool {
    child(trak, b"mdia").and_then(|(_, mdia)| child(mdia, b"hdlr")).is_some_and(|(_, hdlr)| hdlr.get(8..12) == Some(b"vide"))
}

/// Angle (sens horaire) d'une matrice qui n'est qu'un quart de tour ; autre chose (miroir, échelle) : `None`.
fn angle(m: &[u8]) -> Option<u32> {
    let v = |i: usize| m.get(i * 4..i * 4 + 4).and_then(|b| b.try_into().ok()).map(i32::from_be_bytes);
    match (v(0)?, v(1)?, v(3)?, v(4)?) {
        (ONE, 0, 0, ONE) => Some(0),
        (0, ONE, n, 0) if n == -ONE => Some(90),
        (a, 0, 0, d) if a == -ONE && d == -ONE => Some(180),
        (0, n, ONE, 0) if n == -ONE => Some(270),
        _ => None,
    }
}

/// Matrice d'un angle ; `w`, `h` : largeur et hauteur de la piste (16.16), pour le décalage.
fn matrix(angle: u32, w: i32, h: i32) -> [u8; 36] {
    let (a, b, c, d, x, y) = match angle {
        90 => (0, ONE, -ONE, 0, h, 0),
        180 => (-ONE, 0, 0, -ONE, w, h),
        270 => (0, -ONE, ONE, 0, 0, w),
        _ => (ONE, 0, 0, ONE, 0, 0),
    };
    let mut out = [0u8; 36];
    for (i, v) in [a, b, 0, c, d, 0, x, y, 0x4000_0000].into_iter().enumerate() {
        out[i * 4..i * 4 + 4].copy_from_slice(&v.to_be_bytes());
    }
    out
}

/// Contenu de la première boîte `kind` du haut du fichier : (position, longueur).
fn top_box(file: &mut File, kind: &[u8; 4]) -> anyhow::Result<Option<(u64, u64)>> {
    let len = file.metadata()?.len();
    let mut at = 0u64;
    while at + 8 <= len {
        let mut head = [0u8; 16];
        file.seek(SeekFrom::Start(at))?;
        let got = file.read(&mut head)?;
        let size32 = u64::from(u32::from_be_bytes(head[..4].try_into()?));
        let (header, size) = match size32 {
            0 => (8, len - at),
            1 if got >= 16 => (16, u64::from_be_bytes(head[8..16].try_into()?)),
            1 => bail!("boîte MP4 abîmée"),
            s => (8, s),
        };
        if size < header {
            bail!("boîte MP4 abîmée");
        }
        if &head[4..8] == kind {
            return Ok(Some((at + header, size - header)));
        }
        at += size;
    }
    Ok(None)
}

pub fn turn_mp4(path: &Path, clockwise: bool) -> anyhow::Result<()> {
    let mut file = OpenOptions::new().read(true).write(true).open(path)?;
    let (moov_at, moov_len) = top_box(&mut file, b"moov")?.context("index de la vidéo (moov) introuvable")?;
    if moov_len > MAX_MOOV {
        bail!("index de la vidéo trop grand");
    }
    let mut moov = vec![0u8; usize::try_from(moov_len)?];
    file.seek(SeekFrom::Start(moov_at))?;
    file.read_exact(&mut moov)?;
    let mut writes = Vec::new();
    for (kind, start, end) in boxes(&moov) {
        let trak = &moov[start..end];
        if &kind != b"trak" || !is_video(trak) {
            continue;
        }
        let (tkhd_at, tkhd) = child(trak, b"tkhd").context("en-tête de piste (tkhd) introuvable")?;
        // Après version et drapeaux, dates, numéro, durée (32 bits, ou 64 en version 1) : 40 ou 52 octets.
        let m = if tkhd.first() == Some(&1) { 52 } else { 40 };
        let size = |i: usize| tkhd.get(m + 36 + i * 4..m + 40 + i * 4).and_then(|b| b.try_into().ok()).map(i32::from_be_bytes);
        let (Some(current), Some(w), Some(h)) = (tkhd.get(m..m + 36).and_then(angle), size(0), size(1)) else {
            bail!("matrice d'affichage inhabituelle (miroir ou échelle) : non modifiée");
        };
        let next = (current + if clockwise { 90 } else { 270 }) % 360;
        writes.push((moov_at + (start + tkhd_at + m) as u64, matrix(next, w, h)));
    }
    if writes.is_empty() {
        bail!("aucune piste vidéo");
    }
    for (at, bytes) in writes {
        file.seek(SeekFrom::Start(at))?;
        file.write_all(&bytes)?;
    }
    file.sync_all()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matrices() {
        for a in [0, 90, 180, 270] {
            assert_eq!(angle(&matrix(a, 1920 << 16, 1080 << 16)), Some(a));
        }
    }
}
