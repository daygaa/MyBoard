//! « Annuler l'import » (IMP-43 ; réponses du 09/11 et Q9 A du 11/11) : pendant l'import, MyBoard garde en mémoire ce
//! qu'il a changé (perdu à la fin de l'import ou à la fermeture de MyBoard : il ne sert qu'à cette annulation), puis
//! défait tout : médias ajoutés retirés (sans réserve DEL-05 : ils viennent d'arriver), fiches existantes remises dans
//! leur état d'avant (nouvelle version d'IMP-60, nouveau chemin de LIB-05), tags par défaut retirés des médias déjà
//! présents (avec les parents qu'ils avaient posés), tags créés par l'import effacés s'ils ne servent plus, fichiers
//! écrits par l'import effacés. Un fichier modifié au même endroit (fiche mise à jour) reste à jour. Les fichiers de
//! l'utilisateur ne sont jamais touchés ; impossible avec « Supprimer les originaux » ou « Supprimer du stockage… »
//! (réponses du 11/11 : bouton grisé).

use std::path::PathBuf;

use rusqlite::{Connection, TransactionBehavior, params};
use serde::Serialize;

use super::relocate::Before;
use crate::tagging::{remove_cascade, restore_justified};

#[derive(Default)]
pub struct Changes {
    /// Médias ajoutés par l'import.
    pub added: Vec<i64>,
    /// Tags par défaut posés sur des médias déjà présents (média, tag).
    pub tags: Vec<(i64, i64)>,
    /// Tags créés au départ (tags par défaut qui n'existaient pas).
    pub created_tags: Vec<i64>,
    /// Fiches existantes changées par l'import, dans leur état d'avant.
    pub before: Vec<Before>,
    /// Fichiers écrits par l'import (versions compressées ou converties).
    pub written: Vec<PathBuf>,
}

/// Ce que l'annulation a défait (bilan « Import annulé », réponse Q12 A).
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Undone {
    pub removed: u64,
    pub restored: u64,
    pub erased: u64,
}

impl Changes {
    /// Une transaction pour la base ; les fichiers sont effacés ensuite, s'ils ne sont plus le fichier d'aucun média.
    pub fn undo(&self, conn: &mut Connection) -> anyhow::Result<Undone> {
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        for before in self.before.iter().rev() {
            before.restore(&tx)?;
        }
        for &(media, tag) in self.tags.iter().rev() {
            let removed = remove_cascade(&tx, media, tag)?;
            restore_justified(&tx, &removed)?;
        }
        {
            let mut stmt = tx.prepare_cached("UPDATE media SET pending_delete = ?1 WHERE id = ?2 AND pending_delete = 0")?;
            for id in &self.added {
                stmt.execute(params![crate::deletion::UNDONE, id])?;
            }
        }
        for tag in &self.created_tags {
            tx.execute(
                "DELETE FROM tags WHERE id = ?1
                   AND NOT EXISTS (SELECT 1 FROM media_tags t JOIN media m ON m.id = t.media_id WHERE t.tag_id = ?1 AND m.pending_delete = 0)
                   AND NOT EXISTS (SELECT 1 FROM tag_parents p WHERE ?1 IN (p.child_id, p.parent_id))",
                [tag],
            )?;
        }
        tx.commit()?;
        let mut erased = 0;
        for path in &self.written {
            let used = conn
                .prepare_cached("SELECT 1 FROM media WHERE path = ?1 AND pending_delete = 0")?
                .exists([path.to_string_lossy()])?;
            if !used && std::fs::remove_file(path).is_ok() {
                erased += 1;
            }
        }
        super::journal::remove(&self.written);
        Ok(Undone { removed: self.added.len() as u64, restored: self.before.len() as u64, erased })
    }
}
