//! Étiquette d'orientation (EXIF 274) écrite dans le fichier, sans toucher à l'image (VIEW-60, réponse Q24 A) : JPEG
//! (bloc EXIF de l'en-tête), TIFF et DNG (premier répertoire du fichier). Sa valeur, 1 à 8, dit comment tourner (et
//! retourner) l'image enregistrée pour l'afficher ; un quart de tour de plus la remplace.
//! - Étiquette présente : ses 2 octets sont réécrits sur place.
//! - Absente : le premier répertoire est recopié avec elle à la fin des données (rien d'autre ne bouge : les autres
//!   valeurs gardent leur place) ; JPEG sans bloc EXIF : un petit bloc est ajouté. Un JPEG qui change de taille est
//!   écrit à côté, puis remplace l'original (jamais d'original à moitié écrit), date de création gardée.

use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::Path;

use anyhow::{Context, bail};

const ORIENTATION: u16 = 0x0112;
const SHORT: u16 = 3;
const SOS: u8 = 0xDA;
const EOI: u8 = 0xD9;
const APP0: u8 = 0xE0;
const APP1: u8 = 0xE1;
const EXIF: &[u8] = b"Exif\0\0";

/// Valeurs 1 à 8 : quarts de tour dans le sens des aiguilles d'une montre, puis miroir horizontal.
const TURNS: [(u8, bool); 8] = [(0, false), (0, true), (2, false), (2, true), (1, true), (1, false), (3, true), (3, false)];

/// Valeur après un quart de tour de l'image affichée. Un miroir inverse le sens du tour enregistré.
pub fn turned(value: u16, clockwise: bool) -> u16 {
    let (k, mirror) = TURNS.get(usize::from(value).wrapping_sub(1)).copied().unwrap_or((0, false));
    let k = (k + if clockwise != mirror { 1 } else { 3 }) % 4;
    TURNS.iter().position(|&t| t == (k, mirror)).map_or(1, |i| i as u16 + 1)
}

/// Ordre des octets de la structure TIFF : `true` = « II » (Intel), `false` = « MM » (Motorola).
#[derive(Clone, Copy)]
struct Order(bool);

impl Order {
    fn u16(self, b: &[u8], at: usize) -> Option<u16> {
        let s: [u8; 2] = b.get(at..at + 2)?.try_into().ok()?;
        Some(if self.0 { u16::from_le_bytes(s) } else { u16::from_be_bytes(s) })
    }
    fn u32(self, b: &[u8], at: usize) -> Option<u32> {
        let s: [u8; 4] = b.get(at..at + 4)?.try_into().ok()?;
        Some(if self.0 { u32::from_le_bytes(s) } else { u32::from_be_bytes(s) })
    }
    fn put16(self, v: u16) -> [u8; 2] {
        if self.0 { v.to_le_bytes() } else { v.to_be_bytes() }
    }
    fn put32(self, v: u32) -> [u8; 4] {
        if self.0 { v.to_le_bytes() } else { v.to_be_bytes() }
    }
}

/// Premier répertoire d'une structure TIFF : sa position, ses entrées (12 octets chacune), le lien vers le suivant.
struct Ifd0 {
    order: Order,
    start: u32,
    entries: Vec<[u8; 12]>,
    next: [u8; 4],
}

/// `read(position, longueur)` : octets de la structure TIFF (depuis son début).
fn ifd0(read: &mut dyn FnMut(u64, usize) -> anyhow::Result<Vec<u8>>) -> anyhow::Result<Ifd0> {
    let head = read(0, 8)?;
    let order = match head.get(..4) {
        Some(b"II*\0") => Order(true),
        Some(b"MM\0*") => Order(false),
        _ => bail!("structure TIFF inconnue"),
    };
    let start = order.u32(&head, 4).context("en-tête TIFF")?;
    let count = usize::from(order.u16(&read(start.into(), 2)?, 0).context("répertoire TIFF")?);
    let body = read(u64::from(start) + 2, count * 12 + 4)?;
    let entries = body.as_chunks::<12>().0.to_vec();
    let next = body.get(count * 12..).and_then(|b| b.try_into().ok()).context("répertoire TIFF")?;
    Ok(Ifd0 { order, start, entries, next })
}

enum Plan {
    /// 2 octets à réécrire, à cette position de la structure TIFF.
    InPlace { at: u64, bytes: [u8; 2] },
    /// Nouveau premier répertoire à ajouter à la fin de la structure ; l'en-tête (position 4) pointera dessus.
    Append { ifd: Vec<u8> },
}

fn plan(ifd: &Ifd0, clockwise: bool) -> Plan {
    let o = ifd.order;
    let found = ifd.entries.iter().position(|e| o.u16(e, 0) == Some(ORIENTATION));
    if let Some(i) = found {
        let e = &ifd.entries[i];
        // Valeur rangée dans l'entrée elle-même (un nombre de 16 bits) : le cas normal.
        if o.u16(e, 2) == Some(SHORT) && o.u32(e, 4) == Some(1) {
            let current = o.u16(e, 8).unwrap_or(1);
            return Plan::InPlace { at: u64::from(ifd.start) + 2 + i as u64 * 12 + 8, bytes: o.put16(turned(current, clockwise)) };
        }
    }
    // Absente (ou mal formée : remplacée) : entrée ajoutée à sa place dans l'ordre des numéros.
    let mut entries: Vec<[u8; 12]> = ifd.entries.iter().filter(|e| o.u16(e.as_slice(), 0) != Some(ORIENTATION)).copied().collect();
    let mut entry = [0u8; 12];
    entry[..2].copy_from_slice(&o.put16(ORIENTATION));
    entry[2..4].copy_from_slice(&o.put16(SHORT));
    entry[4..8].copy_from_slice(&o.put32(1));
    entry[8..10].copy_from_slice(&o.put16(turned(1, clockwise)));
    let at = entries.partition_point(|e| o.u16(e.as_slice(), 0).unwrap_or(0) < ORIENTATION);
    entries.insert(at, entry);
    let mut out = o.put16(entries.len() as u16).to_vec();
    entries.iter().for_each(|e| out.extend_from_slice(e));
    out.extend_from_slice(&ifd.next);
    Plan::Append { ifd: out }
}

fn read_at(file: &mut File, at: u64, len: usize) -> anyhow::Result<Vec<u8>> {
    let mut buf = vec![0; len];
    file.seek(SeekFrom::Start(at))?;
    file.read_exact(&mut buf)?;
    Ok(buf)
}

fn write_at(file: &mut File, at: u64, bytes: &[u8]) -> anyhow::Result<()> {
    file.seek(SeekFrom::Start(at))?;
    file.write_all(bytes)?;
    Ok(())
}

/// TIFF et DNG : le fichier entier est la structure TIFF ; un répertoire ajouté va à sa fin.
pub fn turn_tiff(path: &Path, clockwise: bool) -> anyhow::Result<()> {
    let mut file = OpenOptions::new().read(true).write(true).open(path)?;
    let ifd = ifd0(&mut |at, len| read_at(&mut file, at, len))?;
    match plan(&ifd, clockwise) {
        Plan::InPlace { at, bytes } => write_at(&mut file, at, &bytes)?,
        Plan::Append { ifd: data } => {
            let mut end = file.seek(SeekFrom::End(0))?;
            // Un répertoire commence à une position paire.
            if end % 2 == 1 {
                file.write_all(&[0])?;
                end += 1;
            }
            let start = u32::try_from(end).context("fichier TIFF trop grand")?;
            file.write_all(&data)?;
            file.sync_data()?;
            // Le lien de l'en-tête change en dernier : jusque-là, le fichier reste lisible tel qu'avant.
            write_at(&mut file, 4, &ifd.order.put32(start))?;
        }
    }
    file.sync_all()?;
    Ok(())
}

/// Bloc EXIF d'un JPEG : position du marqueur, début de la structure TIFF, fin du bloc.
type ExifBlock = (usize, usize, usize);

/// Bloc EXIF d'un JPEG et place d'un bloc à ajouter (après le bloc JFIF du début, s'il y en a un).
fn scan_jpeg(data: &[u8]) -> anyhow::Result<(Option<ExifBlock>, usize)> {
    if data.get(..2) != Some(&[0xFF, 0xD8]) {
        bail!("pas un fichier JPEG");
    }
    let (mut at, mut insert_at, mut exif) = (2, 2, None);
    loop {
        let (Some(&0xFF), Some(&marker)) = (data.get(at), data.get(at + 1)) else { bail!("en-tête JPEG abîmé") };
        if marker == 0xFF {
            at += 1; // octet de remplissage
            continue;
        }
        if marker == SOS || marker == EOI {
            return Ok((exif, insert_at));
        }
        if (0xD0..=0xD7).contains(&marker) || marker == 0x01 {
            at += 2;
            continue;
        }
        let len = usize::from(u16::from_be_bytes(data.get(at + 2..at + 4).context("en-tête JPEG abîmé")?.try_into()?));
        let end = at + 2 + len;
        if len < 2 || end > data.len() {
            bail!("en-tête JPEG abîmé");
        }
        if marker == APP1 && exif.is_none() && data[at + 4..end].starts_with(EXIF) {
            exif = Some((at, at + 4 + EXIF.len(), end));
        }
        if marker == APP0 && at == 2 {
            insert_at = end;
        }
        at = end;
    }
}

/// Bloc APP1 « Exif » autour d'une structure TIFF.
fn app1(tiff: &[u8]) -> anyhow::Result<Vec<u8>> {
    let len = u16::try_from(2 + EXIF.len() + tiff.len()).context("bloc EXIF trop grand")?;
    let mut out = vec![0xFF, APP1];
    out.extend_from_slice(&len.to_be_bytes());
    out.extend_from_slice(EXIF);
    out.extend_from_slice(tiff);
    Ok(out)
}

pub fn turn_jpeg(path: &Path, clockwise: bool) -> anyhow::Result<()> {
    let data = std::fs::read(path)?;
    let (exif, insert_at) = scan_jpeg(&data)?;
    let Some((start, tiff, end)) = exif else {
        // Pas de bloc EXIF : structure minimale (« MM »), une seule entrée.
        let mut block = b"MM\0*\0\0\0\x08\0\x01".to_vec();
        block.extend_from_slice(&ORIENTATION.to_be_bytes());
        block.extend_from_slice(&SHORT.to_be_bytes());
        block.extend_from_slice(&1u32.to_be_bytes());
        block.extend_from_slice(&turned(1, clockwise).to_be_bytes());
        block.extend_from_slice(&[0; 6]); // fin de la valeur, puis « pas de répertoire suivant »
        return replace(path, &[&data[..insert_at], &app1(&block)?, &data[insert_at..]].concat());
    };
    let blob = &data[tiff..end];
    let ifd = ifd0(&mut |at, len| {
        let from = usize::try_from(at)?;
        Ok(blob.get(from..from + len).context("bloc EXIF abîmé")?.to_vec())
    })?;
    match plan(&ifd, clockwise) {
        Plan::InPlace { at, bytes } => {
            let mut file = OpenOptions::new().write(true).open(path)?;
            write_at(&mut file, tiff as u64 + at, &bytes)?;
            file.sync_all()?;
            Ok(())
        }
        Plan::Append { ifd: added } => {
            let mut new = blob.to_vec();
            if new.len() % 2 == 1 {
                new.push(0);
            }
            let at = u32::try_from(new.len())?;
            new.extend_from_slice(&added);
            new[4..8].copy_from_slice(&ifd.order.put32(at));
            replace(path, &[&data[..start], &app1(&new)?, &data[end..]].concat())
        }
    }
}

/// Écrit le nouveau contenu à côté, puis remplace l'original ; sa date de création est remise (tri par date, FILT-05).
fn replace(path: &Path, bytes: &[u8]) -> anyhow::Result<()> {
    let created = std::fs::metadata(path)?.created().ok();
    let name = path.file_name().context("nom de fichier")?.to_string_lossy();
    let temp = path.with_file_name(format!(".{name}.myboard-rotation"));
    let written = (|| -> anyhow::Result<()> {
        let mut file = File::create(&temp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        std::fs::rename(&temp, path)?;
        Ok(())
    })();
    if written.is_err() {
        let _ = std::fs::remove_file(&temp);
    }
    written?;
    if let Some(created) = created {
        set_created(path, created);
    }
    Ok(())
}

#[cfg(windows)]
fn set_created(path: &Path, created: std::time::SystemTime) {
    use std::os::windows::fs::FileTimesExt;
    if let Ok(file) = OpenOptions::new().write(true).open(path) {
        let _ = file.set_times(std::fs::FileTimes::new().set_created(created));
    }
}

#[cfg(not(windows))]
fn set_created(_path: &Path, _created: std::time::SystemTime) {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quarts_de_tour() {
        // Sans miroir : 1 → 6 → 3 → 8 → 1 dans le sens horaire, l'inverse dans l'autre.
        assert_eq!([1, 6, 3, 8].map(|v| turned(v, true)), [6, 3, 8, 1]);
        assert_eq!([1, 6, 3, 8].map(|v| turned(v, false)), [8, 1, 6, 3]);
        // Avec miroir : un tour puis l'inverse revient au départ.
        for v in 1..=8 {
            assert_eq!(turned(turned(v, true), false), v);
            assert_eq!((0..4).fold(v, |x, _| turned(x, true)), v);
        }
    }

    #[test]
    fn jpeg_sans_exif_puis_sur_place() {
        let dir = std::env::temp_dir().join(format!("myboard-rotation-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("a.jpg");
        let img = image::RgbImage::from_pixel(4, 2, image::Rgb([200, 10, 10]));
        img.save(&path).unwrap();
        turn_jpeg(&path, true).unwrap();
        let read = || {
            let mut d = image::ImageReader::open(&path).unwrap().with_guessed_format().unwrap().into_decoder().unwrap();
            image::ImageDecoder::orientation(&mut d).unwrap()
        };
        assert_eq!(read(), image::metadata::Orientation::Rotate90);
        let size = std::fs::metadata(&path).unwrap().len();
        turn_jpeg(&path, true).unwrap();
        assert_eq!(read(), image::metadata::Orientation::Rotate180);
        assert_eq!(std::fs::metadata(&path).unwrap().len(), size, "2e tour : sur place");
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
