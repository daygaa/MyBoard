//! Générateur de bibliothèque de test (DEV-02) pour mesurer la fluidité (D-008).
//!
//! Crée N faux médias (images, vidéos, audio, documents) avec une miniature unique
//! chacun, dans un dossier de données SÉPARÉ de la vraie bibliothèque. Les chemins
//! des médias sont fictifs (lecteur X:) : rien n'est lu ni écrit ailleurs.
//! Les miniatures sont écrites dans `thumbs.db` (D-014).
//!
//! Utilisation (depuis src-tauri) :
//!   cargo run --release --example gen_test_library -- "C:\...\MyBoard-test\100k" 100000
//! Puis lancer MyBoard avec la variable MYBOARD_DATA_DIR pointant sur ce dossier.

use std::path::PathBuf;
use std::time::Instant;

use myboard_lib::{db, paths, thumbs};
use rusqlite::params;

/// Petit générateur pseudo-aléatoire reproductible (SplitMix64).
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }
    fn range(&mut self, min: u64, max: u64) -> u64 {
        min + self.next() % (max - min + 1)
    }
}

const SIZES: &[(i64, i64)] = &[(4032, 3024), (3024, 4032), (1920, 1080), (1080, 1920), (1280, 720), (800, 600), (2048, 2048), (640, 480)];

struct Fake {
    hash: String,
    kind: &'static str,
    ext: &'static str,
}

fn fake(index: u64) -> Fake {
    let hash = blake3::hash(&index.to_le_bytes()).to_hex().to_string();
    let roll = index % 100;
    let (kind, ext) = match roll {
        0..=59 => ("image", "jpg"),
        60..=74 => ("image", "png"),
        75..=79 => ("image", "gif"),
        80..=94 => ("video", "mp4"),
        95..=97 => ("audio", "mp3"),
        _ => ("document", "pdf"),
    };
    Fake { hash, kind, ext }
}

/// Miniature synthétique unique : dégradé coloré + motif + grain, proche du poids d'une vraie.
fn thumbnail(index: u64) -> Vec<u8> {
    let size = thumbs::THUMB_SIZE as usize;
    let mut rng = Rng(index.wrapping_mul(7919) + 1);
    let (r0, g0, b0) = (rng.range(20, 235) as f32, rng.range(20, 235) as f32, rng.range(20, 235) as f32);
    let (r1, g1, b1) = (rng.range(20, 235) as f32, rng.range(20, 235) as f32, rng.range(20, 235) as f32);
    let (cx, cy, radius) = (rng.range(40, 280) as f32, rng.range(40, 280) as f32, rng.range(30, 140) as f32);
    let stripes = rng.range(4, 24) as f32;
    let mut pixels = vec![0u8; size * size * 3];
    for y in 0..size {
        for x in 0..size {
            let t = (x + y) as f32 / (2 * size) as f32;
            let mut c = [r0 + (r1 - r0) * t, g0 + (g1 - g0) * t, b0 + (b1 - b0) * t];
            let (dx, dy) = (x as f32 - cx, y as f32 - cy);
            if dx * dx + dy * dy < radius * radius {
                c = [255.0 - c[0], 255.0 - c[1], 255.0 - c[2]];
            }
            let wave = ((x as f32 / size as f32 * stripes).sin() * 18.0) as i32;
            let noise = (rng.next() % 25) as i32 - 12;
            let o = (y * size + x) * 3;
            for k in 0..3 {
                pixels[o + k] = (c[k] as i32 + wave + noise).clamp(0, 255) as u8;
            }
        }
    }
    webp::Encoder::from_rgb(&pixels, size as u32, size as u32).encode(78.0).to_vec()
}

fn main() -> anyhow::Result<()> {
    let mut args = std::env::args().skip(1);
    let dir = PathBuf::from(args.next().ok_or_else(|| anyhow::anyhow!("dossier de destination manquant"))?);
    let count: u64 = args.next().as_deref().unwrap_or("100000").parse()?;
    if dir.join("myboard.db").exists() {
        anyhow::bail!("{} contient déjà une bibliothèque : choisissez un dossier vide", dir.display());
    }
    let data = paths::DataPaths::at(dir)?;
    let start = Instant::now();

    // 1. Les lignes en base, en une seule transaction.
    let mut conn = db::open_and_migrate(&data.db)?;
    let now = db::now_ms();
    let tx = conn.transaction()?;
    {
        let mut insert = tx.prepare(
            "INSERT INTO media (hash, path, file_name, ext, kind, size, width, height, duration_ms,
                                file_created_at, file_modified_at, imported_at, thumb_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10, ?11, ?12)",
        )?;
        let mut rng = Rng(42);
        for index in 0..count {
            let f = fake(index);
            let name = format!("media_{index:06}.{}", f.ext);
            let path = format!(r"X:\bibliotheque-de-test\dossier_{:03}\{name}", index / 1000);
            let visual = f.kind == "image" || f.kind == "video";
            let (w, h) = SIZES[(rng.next() % SIZES.len() as u64) as usize];
            let size = match f.kind {
                "video" => rng.range(5_000_000, 2_000_000_000),
                "image" => rng.range(50_000, 20_000_000),
                _ => rng.range(10_000, 15_000_000),
            } as i64;
            let duration = (f.kind == "video").then(|| rng.range(3_000, 1_200_000) as i64);
            let created = now - rng.range(0, 10 * 365 * 24 * 3600 * 1000) as i64;
            let status = if visual { thumbs::status::READY } else { thumbs::status::NONE };
            insert.execute(params![
                f.hash,
                path,
                name,
                f.ext,
                f.kind,
                size,
                visual.then_some(w),
                visual.then_some(h),
                duration,
                created,
                now + index as i64,
                status
            ])?;
        }
    }
    tx.commit()?;
    println!("{count} médias enregistrés en {:.1} s", start.elapsed().as_secs_f32());

    // 2. Les miniatures : fabriquées en parallèle, écrites dans thumbs.db en une transaction.
    let threads = std::thread::available_parallelism().map_or(4, |n| n.get()) as u64;
    let mut store = thumbs::store::open_writer(&data.thumbs_db)?;
    let tx = store.transaction()?;
    let (sender, receiver) = std::sync::mpsc::sync_channel::<(String, Vec<u8>)>(1024);
    std::thread::scope(|scope| -> anyhow::Result<()> {
        for t in 0..threads {
            let sender = sender.clone();
            scope.spawn(move || {
                for index in (t..count).step_by(threads as usize) {
                    let f = fake(index);
                    if f.kind == "image" || f.kind == "video" {
                        let _ = sender.send((f.hash, thumbnail(index)));
                    }
                }
            });
        }
        drop(sender);
        for (hash, webp) in receiver {
            thumbs::store::put(&tx, &hash, &webp)?;
        }
        Ok(())
    })?;
    tx.commit()?;
    println!("Miniatures créées. Total : {:.1} s — dossier : {}", start.elapsed().as_secs_f32(), data.root.display());
    Ok(())
}
