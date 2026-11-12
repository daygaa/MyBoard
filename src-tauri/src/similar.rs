//! Tags proches (TAGM-13 ; refonte, décisions D8 à D8.3 ; lot R6-2). La détection se fait dans l'interface
//! (`lib/similarTags.ts`) ; ici : ce que l'utilisateur écarte, retenu par paires « ces deux tags ne sont pas
//! synonymes » et rangé par action pour « Ignorés (N) » (réponses 3 et 4 du lot R6), et « Créer des synonymes pour
//! tous » en une transaction. Une action dont un tag a été supprimé n'écarte plus que les paires qui restent.

use std::collections::HashMap;

use rusqlite::{Connection, TransactionBehavior, params};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{AppState, db, group_create};

/// Une action « Ignorer » (`group` : toutes les paires entre `apart`) ou un décochage (`apart` : paires entre les
/// tags écartés et `kept`).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Ignore {
    pub id: i64,
    pub kind: String,
    pub apart: Vec<i64>,
    pub kept: Vec<i64>,
}

/// Actions qui écartent encore au moins une paire.
pub fn ignores(db: &Connection) -> rusqlite::Result<Vec<Ignore>> {
    let mut out: Vec<Ignore> = Vec::new();
    let mut index: HashMap<i64, usize> = HashMap::new();
    let rows = db
        .prepare("SELECT i.id, i.kind, t.tag_id, t.apart FROM tag_similar_ignores i JOIN tag_similar_ignore_tags t ON t.ignore_id = i.id ORDER BY i.id DESC, t.tag_id")?
        .query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, i64>(2)?, r.get::<_, bool>(3)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    for (id, kind, tag, apart) in rows {
        let i = *index.entry(id).or_insert_with(|| {
            out.push(Ignore { id, kind, apart: Vec::new(), kept: Vec::new() });
            out.len() - 1
        });
        if apart { out[i].apart.push(tag) } else { out[i].kept.push(tag) }
    }
    out.retain(|i| if i.kind == "group" { i.apart.len() >= 2 } else { !i.apart.is_empty() && !i.kept.is_empty() });
    Ok(out)
}

/// Retient une action : `kept` vide = « Ignorer » le bloc `apart`.
pub fn ignore(db: &Connection, apart: &[i64], kept: &[i64], now: i64) -> rusqlite::Result<()> {
    if apart.is_empty() || (kept.is_empty() && apart.len() < 2) {
        return Ok(());
    }
    let kind = if kept.is_empty() { "group" } else { "apart" };
    db.execute("INSERT INTO tag_similar_ignores (kind, created_at) VALUES (?1, ?2)", params![kind, now])?;
    let id = db.last_insert_rowid();
    let mut stmt = db.prepare("INSERT OR IGNORE INTO tag_similar_ignore_tags (ignore_id, tag_id, apart) VALUES (?1, ?2, ?3)")?;
    for &t in apart {
        stmt.execute(params![id, t, true])?;
    }
    for &t in kept {
        stmt.execute(params![id, t, false])?;
    }
    Ok(())
}

/// Un bloc de « Créer des synonymes pour tous » : le groupe à créer ou compléter, et les tags décochés à écarter.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupItem {
    pub principal: i64,
    pub names: Vec<String>,
    pub merge: bool,
    pub apart: Vec<i64>,
    pub kept: Vec<i64>,
}

/// Crée tous les groupes ; `extend` : règles cochées « Étendre » dans la pop-in (D11.3).
pub fn create_all(db: &Connection, items: &[GroupItem], extend: &[i64], now: i64) -> anyhow::Result<()> {
    for item in items {
        group_create::create(db, item.principal, &item.names, item.merge, &[], extend, now)?;
        ignore(db, &item.apart, &item.kept, now)?;
    }
    Ok(())
}

fn write<T>(state: &State<'_, AppState>, f: impl FnOnce(&Connection, i64) -> anyhow::Result<T>) -> Result<T, String> {
    let mut conn = state.db.lock().unwrap();
    (|| -> anyhow::Result<T> {
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let out = f(&tx, db::now_ms())?;
        tx.commit()?;
        Ok(out)
    })()
    .map_err(|e| format!("{e:#}"))
}

/// « Ignorer » un bloc (`kept` vide) ou écarter des tags décochés.
#[tauri::command]
pub async fn ignore_similar(state: State<'_, AppState>, apart: Vec<i64>, kept: Vec<i64>) -> Result<(), String> {
    let _hold = state.tag_jobs.hold(); // après le travail sur les tags en arrière-plan (TAGM-23)
    write(&state, |db, now| Ok(ignore(db, &apart, &kept, now)?))
}

/// « Ne plus ignorer » (D8.3).
#[tauri::command]
pub async fn unignore_similar(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let _hold = state.tag_jobs.hold(); // après le travail sur les tags en arrière-plan (TAGM-23)
    write(&state, |db, _| Ok(db.execute("DELETE FROM tag_similar_ignores WHERE id = ?1", [id]).map(|_| ())?))
}

/// « Créer des synonymes pour tous » (retour T3, point TAGM-13.3 ; D8.2).
#[tauri::command]
pub async fn create_similar_groups(state: State<'_, AppState>, items: Vec<GroupItem>, extend: Vec<i64>) -> Result<(), String> {
    let _hold = state.tag_jobs.hold(); // après le travail sur les tags en arrière-plan (TAGM-23)
    write(&state, |db, now| create_all(db, &items, &extend, now))
}
