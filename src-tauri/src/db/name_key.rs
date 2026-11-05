//! Clé de tri du nom de fichier (FILT-09, schéma 15) : l'ordre de l'Explorateur de Windows, que SQLite
//! obtient par une simple comparaison de textes, avec un index (instantané même pour 100 000 médias).
//! Minuscules, accents retirés (« École » se range avec les « e »), et chaque nombre comparé par sa valeur
//! (« image2 » avant « image10 ») : il est précédé de son nombre de chiffres ; le nom passe avant l'extension
//! (« photo.jpg » avant « photo 2.jpg »). Calculée à partir du nom seulement : le fichier n'est jamais touché.

use rusqlite::{Connection, params};

/// Lettre de base d'un caractère accentué (alphabets latins), ou le caractère lui-même.
fn fold(c: char) -> &'static str {
    match c {
        'à' | 'á' | 'â' | 'ã' | 'ä' | 'å' | 'ā' | 'ă' | 'ą' => "a",
        'æ' => "ae",
        'ç' | 'ć' | 'č' => "c",
        'ď' | 'đ' => "d",
        'è' | 'é' | 'ê' | 'ë' | 'ē' | 'ė' | 'ę' | 'ě' => "e",
        'ì' | 'í' | 'î' | 'ï' | 'ī' | 'į' | 'ı' => "i",
        'ł' => "l",
        'ñ' | 'ń' | 'ň' => "n",
        'ò' | 'ó' | 'ô' | 'õ' | 'ö' | 'ø' | 'ō' | 'ő' => "o",
        'œ' => "oe",
        'ŕ' | 'ř' => "r",
        'ś' | 'š' | 'ş' => "s",
        'ß' => "ss",
        'ť' | 'ţ' => "t",
        'ù' | 'ú' | 'û' | 'ü' | 'ū' | 'ů' | 'ű' | 'ų' => "u",
        'ý' | 'ÿ' => "y",
        'ź' | 'ż' | 'ž' => "z",
        _ => "",
    }
}

/// Nombre écrit avec, devant, son nombre de chiffres sur 2 chiffres (zéros de tête ignorés) :
/// « 2 » → « 012 », « 10 » → « 0210 » ; un nombre plus court passe donc avant un plus long.
fn push_number(out: &mut String, digits: &str) {
    let n = digits.trim_start_matches('0');
    let n = if n.is_empty() { "0" } else { n };
    out.push_str(&format!("{:02}", n.len().min(99)));
    out.push_str(n);
}

/// Le nom sans son extension d'abord, puis l'extension, séparés par un caractère plus petit que tous les
/// autres : « photo.jpg » passe avant « photo 2.jpg », comme dans l'Explorateur.
pub fn name_key(name: &str) -> String {
    match name.rsplit_once('.') {
        Some((stem, ext)) if !stem.is_empty() => format!("{}\u{1}{}", part_key(stem), part_key(ext)),
        _ => part_key(name),
    }
}

fn part_key(name: &str) -> String {
    let mut out = String::with_capacity(name.len() + 8);
    let mut digits = String::new();
    for c in name.chars().flat_map(char::to_lowercase) {
        if c.is_ascii_digit() {
            digits.push(c);
            continue;
        }
        if !digits.is_empty() {
            push_number(&mut out, &digits);
            digits.clear();
        }
        match fold(c) {
            "" => out.push(c),
            base => out.push_str(base),
        }
    }
    if !digits.is_empty() {
        push_number(&mut out, &digits);
    }
    out
}

/// Remplit la clé des médias qui n'en ont pas (bibliothèque d'avant le schéma 15, ou médias écrits par un
/// outil de test) : une transaction ; rien à faire, une simple lecture de l'index.
pub fn fill_missing(conn: &mut Connection) -> anyhow::Result<()> {
    let tx = conn.transaction()?;
    let missing: Vec<(i64, String)> = tx
        .prepare("SELECT id, file_name FROM media WHERE name_key IS NULL")?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<Result<_, _>>()?;
    {
        let mut update = tx.prepare("UPDATE media SET name_key = ?1 WHERE id = ?2")?;
        for (id, name) in &missing {
            update.execute(params![name_key(name), id])?;
        }
    }
    tx.commit()?;
    Ok(())
}
