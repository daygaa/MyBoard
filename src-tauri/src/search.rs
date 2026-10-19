//! Recherche par tags (SRCH-02 à SRCH-05, SRCH-17) : plusieurs termes = ET ; `-tag` = exclusion ;
//! `tag*` = « commence par ». Les filtres par type et le tri n'en font jamais partie (FILT-02).
//!
//! Index en mémoire (SRCH-17, D-027) : pour chaque terme recherché, l'ensemble de ses médias est lu
//! une fois dans la base (ensemble de bits compressé, « roaring bitmap ») puis gardé ; combiner les
//! termes, compter les résultats et changer de page ne demande alors plus rien à la base (moins
//! d'une milliseconde à 300 000 médias, contre 0,25 à 1,1 s avec des sous-requêtes SQL). Le
//! compteur `search_generation`, tenu par des déclencheurs de la base (schéma v4), change à chaque
//! ajout ou retrait d'un lien tag-média ou d'un média : l'index repart alors de la base. Il a sa
//! propre connexion : une recherche n'attend jamais une écriture de l'interface.
//! Vue Favoris ou dossier (FAV-02, FOLD-04) : l'ensemble de ses médias limite le résultat ; les
//! médias en cours de suppression (DEL-01) en sont retirés. Recherche par nom de fichier (SRCH-26) :
//! les médias dont le nom contient le texte (sans tenir compte des majuscules, accents compris), en
//! plus des tags.

use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};

use roaring::RoaringBitmap;
use rusqlite::{Connection, params_from_iter};

use crate::library::{KINDS, ListPage, ListQuery, media_rows, order_by, paging, selected_kinds};
use crate::scope::Scope;
use crate::tags::normalize;

enum Term {
    Exact(String),
    /// Joker `tag*` : tous les tags qui commencent par ce texte.
    Prefix(String),
}

/// Termes de la recherche, avec leur sens (`true` = exclusion). Un joker seul (`*`) ou un terme
/// vide est ignoré.
fn parse(terms: &[String]) -> Vec<(Term, bool)> {
    let mut out = Vec::new();
    for raw in terms {
        let raw = raw.trim();
        let (exclude, body) = match raw.strip_prefix('-') {
            Some(rest) => (true, rest),
            None => (false, raw),
        };
        let prefix = body.ends_with('*');
        let Some(name) = normalize(body) else { continue };
        out.push((if prefix { Term::Prefix(name) } else { Term::Exact(name) }, exclude));
    }
    out
}

/// Ensembles gardés en mémoire, valables tant que `generation` n'a pas changé.
#[derive(Default)]
struct Cache {
    generation: i64,
    /// Médias d'un terme (`t:nom`, `p:début`), d'un type (`k:image`) ou de toute la bibliothèque.
    sets: HashMap<String, Arc<RoaringBitmap>>,
    /// Dernier résultat, pour changer de page sans recombiner.
    last: Option<(String, Arc<RoaringBitmap>)>,
}

/// Au-delà, les ensembles gardés sont oubliés (quelques Mo au plus).
const MAX_SETS: usize = 256;

pub struct SearchIndex {
    inner: Mutex<(Connection, Cache)>,
}

impl SearchIndex {
    pub fn open(db_path: &Path) -> anyhow::Result<Self> {
        Ok(Self { inner: Mutex::new((crate::db::open(db_path)?, Cache::default())) })
    }

    /// Page de résultats d'une recherche ; `None` si la demande n'a ni terme de recherche ni nom de
    /// fichier (la grille passe alors par `library::list`).
    pub fn list(&self, query: &ListQuery) -> rusqlite::Result<Option<ListPage>> {
        let terms = parse(&query.terms);
        if terms.is_empty() && query.file_text().is_none() {
            return Ok(None);
        }
        let mut guard = self.inner.lock().unwrap();
        let (db, cache) = &mut *guard;
        let result = result_of(db, cache, query, &terms)?;
        let (page, page_count, page_size) = paging(result.len(), query.page_size, query.page);
        let offset = ((page - 1) * page_size) as usize;
        let ids = page_ids(db, &result, query.scope(), &query.sort, query.seed, offset, page_size as usize)?;
        let items = media_rows(db, &ids)?;
        Ok(Some(ListPage { items, total: result.len(), page, page_count, page_size }))
    }

    /// Tous les résultats de la demande, toutes pages confondues, avec ou sans termes de recherche :
    /// « Sélectionner tous les résultats » (SEL-03).
    pub fn all_ids(&self, query: &ListQuery) -> rusqlite::Result<Vec<u32>> {
        let mut guard = self.inner.lock().unwrap();
        let (db, cache) = &mut *guard;
        Ok(result_of(db, cache, query, &parse(&query.terms))?.iter().collect())
    }
}

/// Résultat de la demande (vue, termes, types), gardé pour changer de page sans recombiner.
fn result_of(db: &Connection, cache: &mut Cache, query: &ListQuery, terms: &[(Term, bool)]) -> rusqlite::Result<Arc<RoaringBitmap>> {
    let generation: i64 = db.query_row("SELECT n FROM search_generation", [], |r| r.get(0))?;
    if generation != cache.generation {
        *cache = Cache { generation, ..Cache::default() };
    }
    if cache.sets.len() > MAX_SETS {
        cache.sets.clear();
    }
    let kinds = selected_kinds(&query.kinds);
    let scope = query.scope();
    let file = query.file_text();
    let key = format!("{:?}|{:?}|{:?}|{:?}", query.terms, kinds, scope, file);
    Ok(match &cache.last {
        Some((last, set)) if *last == key => set.clone(),
        _ => {
            let set = Arc::new(matching(db, &mut cache.sets, terms, &kinds, scope, file)?);
            cache.last = Some((key, set.clone()));
            set
        }
    })
}

/// Ensemble gardé, lu dans la base la première fois (`sql` renvoie des identifiants de médias).
fn set(
    db: &Connection,
    sets: &mut HashMap<String, Arc<RoaringBitmap>>,
    key: String,
    sql: &str,
    params: &[&str],
) -> rusqlite::Result<Arc<RoaringBitmap>> {
    if let Some(set) = sets.get(&key) {
        return Ok(set.clone());
    }
    let mut stmt = db.prepare_cached(sql)?;
    let ids = stmt.query_map(params_from_iter(params), |r| r.get::<_, u32>(0))?;
    let set = Arc::new(ids.collect::<rusqlite::Result<RoaringBitmap>>()?);
    sets.insert(key, set.clone());
    Ok(set)
}

fn term_set(db: &Connection, sets: &mut HashMap<String, Arc<RoaringBitmap>>, term: &Term) -> rusqlite::Result<Arc<RoaringBitmap>> {
    match term {
        // Tag inexistant : ensemble vide (aucun résultat s'il est demandé, sans effet s'il est exclu).
        Term::Exact(name) => set(
            db,
            sets,
            format!("t:{name}"),
            "SELECT media_id FROM media_tags WHERE tag_id = (SELECT id FROM tags WHERE name = ?1) ORDER BY media_id",
            &[name],
        ),
        Term::Prefix(prefix) => set(
            db,
            sets,
            format!("p:{prefix}"),
            "SELECT media_id FROM media_tags WHERE tag_id IN (SELECT id FROM tags WHERE name >= ?1 AND name < ?2)",
            &[prefix, &format!("{prefix}\u{10FFFF}")],
        ),
    }
}

/// Médias dont le nom de fichier contient `text`, sans tenir compte des majuscules (SRCH-26). La
/// comparaison se fait ici et non dans SQLite, dont `lower()` ignore les lettres accentuées.
fn file_set(db: &Connection, sets: &mut HashMap<String, Arc<RoaringBitmap>>, text: &str) -> rusqlite::Result<Arc<RoaringBitmap>> {
    let needle = text.to_lowercase();
    let key = format!("f:{needle}");
    if let Some(set) = sets.get(&key) {
        return Ok(set.clone());
    }
    let mut stmt = db.prepare_cached("SELECT id, file_name FROM media")?;
    let mut set = RoaringBitmap::new();
    for row in stmt.query_map([], |r| Ok((r.get::<_, u32>(0)?, r.get::<_, String>(1)?)))? {
        let (id, name) = row?;
        if name.to_lowercase().contains(&needle) {
            set.insert(id);
        }
    }
    let set = Arc::new(set);
    sets.insert(key, set.clone());
    Ok(set)
}

/// Médias de la vue qui portent tous les termes demandés, aucun des termes exclus, d'un des types
/// cochés et dont le nom contient le texte cherché ; jamais ceux en cours de suppression.
fn matching(
    db: &Connection,
    sets: &mut HashMap<String, Arc<RoaringBitmap>>,
    terms: &[(Term, bool)],
    kinds: &[&str],
    scope: Scope,
    file: Option<&str>,
) -> rusqlite::Result<RoaringBitmap> {
    let mut included = Vec::new();
    let mut excluded = Vec::new();
    for (term, exclude) in terms {
        let set = term_set(db, sets, term)?;
        if *exclude { excluded.push(set) } else { included.push(set) }
    }
    // Le plus petit ensemble d'abord : les intersections suivantes ne peuvent que le réduire.
    included.sort_by_key(|s| s.len());
    let mut result = match included.first() {
        Some(first) => (**first).clone(),
        None if !kinds.is_empty() && kinds.len() < KINDS.len() => RoaringBitmap::new(),
        None => (*set(db, sets, "all".into(), "SELECT id FROM media ORDER BY id", &[])?).clone(),
    };
    for set in included.iter().skip(1) {
        result &= set.as_ref();
    }
    if !kinds.is_empty() && kinds.len() < KINDS.len() {
        let mut of_kinds = RoaringBitmap::new();
        for kind in kinds {
            of_kinds |= set(db, sets, format!("k:{kind}"), "SELECT id FROM media WHERE kind = ?1 ORDER BY id", &[kind])?.as_ref();
        }
        if included.is_empty() { result = of_kinds } else { result &= of_kinds }
    }
    for set in &excluded {
        result -= set.as_ref();
    }
    if let Some((key, sql)) = scope.set_query() {
        result &= set(db, sets, key, &sql, &[])?.as_ref();
    }
    if let Some(text) = file {
        result &= file_set(db, sets, text)?.as_ref();
    }
    result -= set(db, sets, "suppression".into(), "SELECT id FROM media WHERE pending_delete != 0 ORDER BY id", &[])?.as_ref();
    Ok(result)
}

/// Résultats au plus pour lesquels on trie dans la base (liste d'identifiants dans la requête) ;
/// au-delà, on parcourt l'index du tri en ne gardant que les résultats.
const SORT_IN_QUERY: u64 = 5000;

/// Identifiants de la page, dans l'ordre du tri (mêmes ordres que `library::order_by`, et tris d'ajout
/// des favoris et des dossiers, FAV-05).
fn page_ids(
    db: &Connection,
    result: &RoaringBitmap,
    scope: Scope,
    sort: &str,
    seed: u32,
    offset: usize,
    limit: usize,
) -> rusqlite::Result<Vec<u32>> {
    if let Some((source, dir)) = scope.added_source(sort) {
        let order = format!("ORDER BY added_at {dir}, media_id {dir}");
        return if result.len() <= SORT_IN_QUERY {
            let marks = vec!["?"; result.len() as usize].join(",");
            let sql = format!("{source} AND media_id IN ({marks}) {order} LIMIT {limit} OFFSET {offset}");
            let mut stmt = db.prepare(&sql)?;
            stmt.query_map(params_from_iter(result.iter()), |r| r.get::<_, u32>(0))?.collect()
        } else {
            let mut stmt = db.prepare_cached(&format!("{source} {order}"))?;
            first_in(stmt.query([])?, result, offset, limit)
        };
    }
    let sort = scope.sort(sort);
    let ids = match sort {
        "oldest" => result.iter().skip(offset).take(limit).collect(),
        "random" => {
            // Même mélange que la grille sans recherche : (id × grand nombre + graine) modulo un
            // nombre premier, puis l'id.
            let key = |id: u32| (i64::from(id) * 2_654_435_761 + i64::from(seed)) % 4_294_967_291;
            let mut keyed: Vec<(i64, u32)> = result.iter().map(|id| (key(id), id)).collect();
            let end = (offset + limit).min(keyed.len());
            if end < keyed.len() {
                keyed.select_nth_unstable(end);
            }
            keyed.truncate(end);
            keyed.sort_unstable();
            keyed.into_iter().skip(offset).map(|(_, id)| id).collect()
        }
        "recent" => result.iter().rev().skip(offset).take(limit).collect(),
        _ if result.len() <= SORT_IN_QUERY => {
            let marks = vec!["?"; result.len() as usize].join(",");
            let sql = format!("SELECT id FROM media WHERE id IN ({marks}) ORDER BY {} LIMIT {limit} OFFSET {offset}", order_by(sort));
            let mut stmt = db.prepare(&sql)?;
            stmt.query_map(params_from_iter(result.iter()), |r| r.get::<_, u32>(0))?.collect::<rusqlite::Result<_>>()?
        }
        _ => {
            let mut stmt = db.prepare_cached(&format!("SELECT id FROM media ORDER BY {}", order_by(sort)))?;
            first_in(stmt.query([])?, result, offset, limit)?
        }
    };
    Ok(ids)
}

/// Parcourt des identifiants déjà triés en ne gardant que les résultats : la page `offset..+limit`.
fn first_in(mut rows: rusqlite::Rows, result: &RoaringBitmap, offset: usize, limit: usize) -> rusqlite::Result<Vec<u32>> {
    let mut ids = Vec::with_capacity(limit);
    let mut skipped = 0;
    while let Some(row) = rows.next()? {
        let id: u32 = row.get(0)?;
        if !result.contains(id) {
            continue;
        }
        if skipped < offset {
            skipped += 1;
        } else {
            ids.push(id);
            if ids.len() == limit {
                break;
            }
        }
    }
    Ok(ids)
}
