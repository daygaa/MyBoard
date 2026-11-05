// Retrait d'un tag d'un média : les parents que sa chaîne de règles y avait posés, proposés au retrait (TAGM-22, cas
// P-08 du test complet de la refonte). Même calcul que la suppression d'une règle avec sa case : retrait en chaîne
// d'après les notes `tag_parent_media` (`remove_cascade`), puis ceux qu'une autre règle allumée justifie encore sont
// remis (`restore_justified`). Un parent déjà là avant la règle n'a pas de note : il n'est jamais proposé.

use std::collections::{HashMap, HashSet};

use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params};
use serde::Serialize;
use tauri::State;

use crate::tagging::{remove_cascade, restore_justified};
use crate::{AppState, parents};

/// Ce qui partirait : les parents (dans l'ordre de la chaîne), pour chacun le nombre de médias d'où il partirait
/// (`counts`, même ordre : texte d'une sélection, réponse du 05/11), le nombre de médias touchés et les tags d'où
/// viennent les chaînes (« via la chaîne de parents de « essai chaton » »).
#[derive(Debug, Default, Serialize)]
pub struct ChainParents {
    pub parents: Vec<String>,
    pub counts: Vec<usize>,
    pub media: usize,
    pub origins: Vec<String>,
}

/// Tag d'où part la chaîne qui a posé `tag` : on descend les règles qui l'ont posé sur le média, tant que leur enfant
/// y est encore (« chat » retiré, posé par « essai chaton » → « chat » : l'origine est « essai chaton »).
fn origin(db: &Connection, media: i64, tag: i64) -> rusqlite::Result<i64> {
    let mut seen = HashSet::from([tag]);
    let mut current = tag;
    loop {
        let below: Option<i64> = db
            .prepare_cached(
                "SELECT r.child_id FROM tag_parent_media l JOIN tag_parents r ON r.id = l.rule_id
                 JOIN media_tags c ON c.media_id = l.media_id AND c.tag_id = r.child_id
                 WHERE l.media_id = ?1 AND l.tag_id = ?2 ORDER BY r.id LIMIT 1",
            )?
            .query_row(params![media, current], |r| r.get(0))
            .optional()?;
        match below {
            Some(child) if seen.insert(child) => current = child,
            _ => return Ok(current),
        }
    }
}

fn name(db: &Connection, tag: i64) -> rusqlite::Result<String> {
    db.query_row("SELECT name FROM tags WHERE id = ?1", [tag], |r| r.get(0))
}

/// Retire de `media` ce que les chaînes des `tags` (déjà retirés) y ont posé et remet ce qui reste justifié.
fn run(db: &Connection, media: &[i64], tags: &[i64]) -> rusqlite::Result<ChainParents> {
    let mut plan = Vec::new();
    for &m in media {
        for &t in tags {
            plan.push((m, origin(db, m, t)?, remove_cascade(db, m, t)?));
        }
    }
    let all: Vec<(i64, i64)> = plan.iter().flat_map(|(_, _, removed)| removed.iter().copied()).collect();
    restore_justified(db, &all)?;
    let (mut out, mut parents, mut origins, mut touched) = (ChainParents::default(), Vec::new(), HashSet::new(), HashSet::new());
    let mut where_gone: HashMap<i64, HashSet<i64>> = HashMap::new();
    for (m, from, removed) in &plan {
        let mut gone = false;
        for &(_, parent) in removed {
            let present: bool = db
                .prepare_cached("SELECT EXISTS(SELECT 1 FROM media_tags WHERE media_id = ?1 AND tag_id = ?2)")?
                .query_row(params![m, parent], |r| r.get(0))?;
            if !present {
                gone = true;
                if !parents.contains(&parent) {
                    parents.push(parent);
                }
                where_gone.entry(parent).or_default().insert(*m);
            }
        }
        if gone {
            touched.insert(*m);
            if origins.insert(*from) {
                out.origins.push(name(db, *from)?);
            }
        }
    }
    let ordered = chain_order(db, parents)?;
    out.counts = ordered.iter().map(|p| where_gone.get(p).map_or(0, HashSet::len)).collect();
    out.parents = ordered.into_iter().map(|t| name(db, t)).collect::<rusqlite::Result<_>>()?;
    out.media = touched.len();
    Ok(out)
}

/// Les parents dans l'ordre de la chaîne : un tag avant ses propres parents (« chat » avant « animal ») ; les notes,
/// elles, rangent sous la première règle tout ce que la chaîne a posé.
fn chain_order(db: &Connection, mut tags: Vec<i64>) -> rusqlite::Result<Vec<i64>> {
    let mut out = Vec::with_capacity(tags.len());
    while !tags.is_empty() {
        let mut pick = 0;
        'find: for (i, &t) in tags.iter().enumerate() {
            for &other in &tags {
                if other != t && parents::reaches(db, other, t)? {
                    continue 'find;
                }
            }
            pick = i;
            break;
        }
        out.push(tags.remove(pick));
    }
    Ok(out)
}

fn with_tx<T>(state: &State<'_, AppState>, commit: bool, f: impl FnOnce(&Connection) -> rusqlite::Result<T>) -> Result<T, String> {
    let mut conn = state.db.lock().unwrap();
    (|| {
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let out = f(&tx)?;
        if commit {
            tx.commit()?;
        }
        Ok(out)
    })()
    .map_err(|e: rusqlite::Error| e.to_string())
}

/// Ce que retirerait « Oui » : le retrait est fait puis annulé. À demander AVANT de retirer le tag : son retrait
/// efface la note « posé par telle règle » (déclencheur `parent_lists_tag_removed`), qui donne l'origine de la chaîne.
#[tauri::command]
pub async fn chain_parents(state: State<'_, AppState>, media: Vec<i64>, tags: Vec<i64>) -> Result<ChainParents, String> {
    with_tx(&state, false, |db| run(db, &media, &tags))
}

/// « Oui » : retire ces parents.
#[tauri::command]
pub async fn remove_chain_parents(state: State<'_, AppState>, media: Vec<i64>, tags: Vec<i64>) -> Result<ChainParents, String> {
    with_tx(&state, true, |db| run(db, &media, &tags))
}
