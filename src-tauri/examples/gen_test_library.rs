//! Générateur de bibliothèque de test (DEV-02) pour mesurer la fluidité (D-008).
//!
//! Crée N faux médias (images, vidéos, audio, documents) avec une miniature unique
//! chacun, dans un dossier de données SÉPARÉ de la vraie bibliothèque. Les chemins
//! des médias sont fictifs (lecteur X:) : rien n'est lu ni écrit ailleurs.
//! Les miniatures sont écrites dans `thumbs.db` (D-014).
//!
//! Tags (DEV-04) : tirés de la banque `test_words.txt` (~600 mots, 8 catégories) avec une
//! répartition très inégale, comme dans la réalité : le tag le plus courant est sur ~75 % des
//! médias, les plus rares sur une dizaine de médias pour 100 000.
//!
//! Utilisation (depuis src-tauri) :
//!   cargo run --release --example gen_test_library -- "C:\...\MyBoard-test\100k" 100000
//!   cargo run --release --example gen_test_library -- "C:\...\MyBoard-test\100k" --tags-seulement
//!     (ajoute les tags à une bibliothèque de test déjà générée qui n'en a pas)
//! Puis lancer MyBoard avec la variable MYBOARD_DATA_DIR pointant sur ce dossier.

use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::time::Instant;

use myboard_lib::{db, paths, thumbs};
use rusqlite::{Connection, params};

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
    /// Nombre uniforme dans [0, 1).
    fn unit(&mut self) -> f64 {
        (self.next() >> 11) as f64 / (1u64 << 53) as f64
    }
}

const WORDS: &str = include_str!("test_words.txt");
/// Tags « couleur × objet » (red_hair, blue_sky…), ajoutés à la catégorie Général.
const COLORS: [&str; 14] = [
    "red", "blue", "green", "yellow", "black", "white", "pink", "purple", "orange", "brown", "grey", "silver", "gold", "blonde",
];
const OBJECTS: [&str; 12] = ["hair", "eyes", "dress", "shirt", "sky", "flower", "car", "background", "hat", "shoes", "wall", "light"];

/// Banque de tags (nom, clé de catégorie), du plus fréquent au plus rare.
fn tag_bank() -> Vec<(String, String)> {
    let mut words = Vec::new();
    let mut category = "general";
    for line in WORDS.lines().map(str::trim).filter(|l| !l.is_empty() && !l.starts_with('#')) {
        if let Some(key) = line.strip_prefix('[').and_then(|l| l.strip_suffix(']')) {
            category = key;
            continue;
        }
        words.extend(line.split_whitespace().map(|w| (w.to_string(), category.to_string())));
    }
    words.extend(COLORS.iter().flat_map(|c| OBJECTS.iter().map(move |o| (format!("{c}_{o}"), "general".to_string()))));
    let mut seen = HashSet::new();
    words.retain(|(name, _)| seen.insert(name.clone()));
    // Les 20 premiers mots généraux restent en tête (1girl, solo…) ; le reste est mélangé de
    // façon reproductible pour que chaque catégorie ait des tags fréquents et des tags rares.
    let mut rest = words.split_off(20);
    let mut rng = Rng(7);
    for i in (1..rest.len()).rev() {
        rest.swap(i, (rng.next() % (i as u64 + 1)) as usize);
    }
    words.extend(rest);
    words
}

/// Probabilité qu'un média porte le tag de rang `rank` (0 = le plus fréquent) : 75 % pour le
/// premier, décroissance lente, puis 100 tags très rares (de 1 à 0,1 pour mille).
fn probability(rank: usize, total: usize) -> f64 {
    let tail = 100.min(total / 5).max(1);
    if rank + tail >= total {
        let t = (rank + tail - total) as f64 / tail as f64;
        1e-3 * 0.1f64.powf(t)
    } else {
        0.75 * ((rank + 1) as f64).powf(-0.7)
    }
}

/// Crée les tags de la banque et les répartit sur les médias (dans la transaction de l'appelant).
fn add_tags(tx: &Connection, media_ids: &[i64], now: i64) -> anyhow::Result<usize> {
    let bank = tag_bank();
    let categories: HashMap<String, i64> = tx
        .prepare("SELECT key, id FROM tag_categories")?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<Result<_, _>>()?;
    let mut tag_ids = Vec::with_capacity(bank.len());
    let mut insert = tx.prepare("INSERT INTO tags (name, category_id, created_at) VALUES (?1, ?2, ?3)")?;
    for (name, key) in &bank {
        insert.execute(params![name, categories[key], now])?;
        tag_ids.push(tx.last_insert_rowid());
    }
    let probabilities: Vec<f64> = (0..bank.len()).map(|r| probability(r, bank.len())).collect();
    let mut link = tx.prepare("INSERT INTO media_tags (media_id, tag_id) VALUES (?1, ?2)")?;
    let mut rng = Rng(1234);
    let mut links = 0;
    for &media in media_ids {
        for (rank, &p) in probabilities.iter().enumerate() {
            if rng.unit() < p {
                link.execute(params![media, tag_ids[rank]])?;
                links += 1;
            }
        }
    }
    println!("{} tags répartis sur {} médias ({links} liens)", bank.len(), media_ids.len());
    Ok(links)
}

/// Mode `--tags-seulement` : ajoute les tags à une bibliothèque de test existante.
fn tags_only(dir: PathBuf) -> anyhow::Result<()> {
    let data = paths::DataPaths::at(dir)?;
    let mut conn = db::open_and_migrate(&data.db)?;
    if conn.query_row("SELECT COUNT(*) FROM tags", [], |r| r.get::<_, i64>(0))? > 0 {
        anyhow::bail!("cette bibliothèque a déjà des tags");
    }
    let start = Instant::now();
    let ids: Vec<i64> = conn.prepare("SELECT id FROM media")?.query_map([], |r| r.get(0))?.collect::<Result<_, _>>()?;
    let tx = conn.transaction()?;
    add_tags(&tx, &ids, db::now_ms())?;
    tx.commit()?;
    println!("Terminé en {:.1} s", start.elapsed().as_secs_f32());
    Ok(())
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

/// Image synthétique unique (320 × 320) : dégradé coloré + motif + grain, proche d'une vraie
/// miniature ; passée ensuite par le même encodage que l'application (320 et 128 px).
fn thumbnail(index: u64) -> image::DynamicImage {
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
    image::DynamicImage::ImageRgb8(image::RgbImage::from_raw(size as u32, size as u32, pixels).expect("taille"))
}

fn main() -> anyhow::Result<()> {
    let mut args = std::env::args().skip(1);
    let dir = PathBuf::from(args.next().ok_or_else(|| anyhow::anyhow!("dossier de destination manquant"))?);
    let second = args.next();
    if second.as_deref() == Some("--tags-seulement") {
        return tags_only(dir);
    }
    let count: u64 = second.as_deref().unwrap_or("100000").parse()?;
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
        let mut ids = Vec::with_capacity(count as usize);
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
            ids.push(tx.last_insert_rowid());
        }
        add_tags(&tx, &ids, now)?;
    }
    tx.commit()?;
    println!("{count} médias enregistrés en {:.1} s", start.elapsed().as_secs_f32());

    // 2. Les miniatures : fabriquées en parallèle, écrites dans thumbs.db en une transaction.
    let threads = std::thread::available_parallelism().map_or(4, |n| n.get()) as u64;
    let mut store = thumbs::store::open_writer(&data.thumbs_db)?;
    let tx = store.transaction()?;
    let (sender, receiver) = std::sync::mpsc::sync_channel::<(String, thumbs::Thumb)>(1024);
    std::thread::scope(|scope| -> anyhow::Result<()> {
        for t in 0..threads {
            let sender = sender.clone();
            scope.spawn(move || {
                for index in (t..count).step_by(threads as usize) {
                    let f = fake(index);
                    if f.kind == "image" || f.kind == "video" {
                        let made = thumbs::thumbs_of(thumbnail(index)).expect("encodage d'une miniature");
                        let _ = sender.send((f.hash, made));
                    }
                }
            });
        }
        drop(sender);
        for (hash, made) in receiver {
            thumbs::store::put_thumbs(&tx, &hash, &made.webp, &made.small)?;
        }
        Ok(())
    })?;
    tx.commit()?;
    println!("Miniatures créées. Total : {:.1} s — dossier : {}", start.elapsed().as_secs_f32(), data.root.display());
    Ok(())
}
