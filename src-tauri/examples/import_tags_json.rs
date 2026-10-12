//! Import de tags depuis des fichiers JSON (DEV-01), outil de test hors version finale.
//!
//! Pour chaque `ABC.json` trouvé dans le dossier (et ses sous-dossiers), les tags sont ajoutés
//! au média `ABC.*` de la bibliothèque — en priorité celui qui est dans le même dossier que
//! le JSON. Formats lus : `tags` (texte « tag1 tag2 … », format Safebooru) et, s'il existe,
//! `tags_by_category` ({ "artist": [...], "character": [...], … }) qui donne la catégorie
//! de chaque tag (banque DEV-03). Sans catégorie, un tag nouveau va dans « Général ».
//!
//! Idempotent : relancer ne crée ni doublon ni compteur faux (liens « INSERT OR IGNORE »,
//! compteurs tenus par les déclencheurs SQL, D-005). Tout se fait en une transaction.
//!
//! Utilisation : `scripts\import-tags-json.ps1` (voir CLAUDE.md), ou depuis src-tauri :
//!   cargo run --release --example import_tags_json -- "<dossier de données>" "<dossier des .json>"

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Instant;

use myboard_lib::{db, paths, tags};
use serde_json::Value;

fn lower(path: Option<&Path>) -> String {
    path.map(|p| p.to_string_lossy().to_lowercase()).unwrap_or_default()
}

/// Tags du JSON avec la clé de leur catégorie (`None` = pas précisée).
fn tags_of(json: &Value) -> Vec<(String, Option<String>)> {
    if let Some(by_category) = json["tags_by_category"].as_object() {
        return by_category
            .iter()
            .flat_map(|(key, list)| {
                list.as_array().into_iter().flatten().filter_map(|t| t.as_str()).map(|t| (t.to_string(), Some(key.clone())))
            })
            .collect();
    }
    json["tags"].as_str().unwrap_or("").split_whitespace().map(|t| (t.to_string(), None)).collect()
}

fn main() -> anyhow::Result<()> {
    let mut args = std::env::args().skip(1);
    let (Some(data_dir), Some(json_dir)) = (args.next(), args.next()) else {
        anyhow::bail!("usage : import_tags_json <dossier de données> <dossier des .json>");
    };
    let data = paths::DataPaths::at(PathBuf::from(&data_dir))?;
    if !data.db.exists() {
        anyhow::bail!("aucune bibliothèque dans {data_dir} (myboard.db introuvable)");
    }
    let start = Instant::now();
    let mut conn = db::open_and_migrate(&data.db)?;

    // Médias de la bibliothèque, par nom sans extension.
    let mut by_stem: HashMap<String, Vec<(i64, String)>> = HashMap::new();
    {
        let mut stmt = conn.prepare("SELECT id, path FROM media")?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?)))?;
        for row in rows {
            let (id, path) = row?;
            let path = Path::new(&path);
            let stem = lower(path.file_stem().map(Path::new));
            by_stem.entry(stem).or_default().push((id, lower(path.parent())));
        }
    }
    let categories: HashMap<String, i64> = conn
        .prepare("SELECT key, id FROM tag_categories")?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<Result<_, _>>()?;

    let count = |conn: &rusqlite::Connection, sql: &str| conn.query_row(sql, [], |r| r.get::<_, i64>(0));
    let (tags_before, links_before) = (count(&conn, "SELECT COUNT(*) FROM tags")?, count(&conn, "SELECT COUNT(*) FROM media_tags")?);
    let (mut read, mut matched, mut not_found, mut ambiguous, mut invalid) = (0, 0, 0, 0, 0);
    let mut missing_examples = Vec::new();

    let tx = conn.transaction()?;
    let now = db::now_ms();
    for entry in walkdir::WalkDir::new(&json_dir).into_iter().filter_map(Result::ok) {
        let path = entry.path();
        if !entry.file_type().is_file() || !path.extension().is_some_and(|e| e.eq_ignore_ascii_case("json")) {
            continue;
        }
        read += 1;
        let stem = lower(path.file_stem().map(Path::new));
        let candidates = by_stem.get(&stem).map(Vec::as_slice).unwrap_or_default();
        let folder = lower(path.parent());
        let media_id = match candidates {
            [] => None,
            [(id, _)] => Some(*id),
            many => {
                let same_folder: Vec<_> = many.iter().filter(|(_, dir)| *dir == folder).collect();
                if let [(id, _)] = same_folder.as_slice() {
                    Some(*id)
                } else {
                    ambiguous += 1;
                    continue;
                }
            }
        };
        let Some(media_id) = media_id else {
            not_found += 1;
            if missing_examples.len() < 10 {
                missing_examples.push(path.display().to_string());
            }
            continue;
        };
        let Ok(json) = std::fs::read(path).map_err(anyhow::Error::from).and_then(|b| Ok(serde_json::from_slice::<Value>(&b)?)) else {
            invalid += 1;
            continue;
        };
        matched += 1;
        for (name, key) in tags_of(&json) {
            let category_id = key.and_then(|k| categories.get(&k).copied());
            if let Some(tag_id) = tags::get_or_create(&tx, &tags::NewTag { name, category_id }, now)? {
                tags::attach(&tx, media_id, tag_id)?;
            }
        }
    }
    tx.commit()?;

    let created = count(&conn, "SELECT COUNT(*) FROM tags")? - tags_before;
    let links = count(&conn, "SELECT COUNT(*) FROM media_tags")? - links_before;
    println!("{read} fichiers JSON lus en {:.1} s", start.elapsed().as_secs_f32());
    println!("  {matched} médias trouvés et tagués, {created} tags créés, {links} liens média-tag ajoutés");
    if not_found > 0 {
        println!("  {not_found} JSON sans média correspondant dans la bibliothèque, par exemple :");
        for example in &missing_examples {
            println!("    {example}");
        }
    }
    if ambiguous > 0 {
        println!("  {ambiguous} JSON ignorés : plusieurs médias portent ce nom, aucun dans le même dossier");
    }
    if invalid > 0 {
        println!("  {invalid} JSON illisibles ignorés");
    }
    Ok(())
}
