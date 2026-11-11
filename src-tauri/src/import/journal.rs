//! Journal des fichiers en cours d'écriture (IMP-42, D-058, réponse Q13 du 11/11) : un petit fichier texte dans le
//! dossier des données, une ligne par fichier que MyBoard est en train d'écrire (version compressée ou convertie, à
//! l'import comme dans la visionneuse). La ligne est ajoutée AVANT l'écriture et retirée une fois le fichier enregistré
//! en base (ou abandonné). Après une fermeture ou un plantage, l'ouverture suivante efface ce qui reste : le fichier
//! provisoire « .myboard-tmp » et le fichier final, s'il n'est le fichier d'aucun média. Un nom du journal est toujours
//! un nom que MyBoard a choisi libre (`compress::free_name`) : jamais un fichier de l'utilisateur.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::Connection;

struct Journal {
    file: PathBuf,
    entries: Vec<PathBuf>,
}

static JOURNAL: Mutex<Option<Journal>> = Mutex::new(None);

/// Nom du journal dans le dossier des données.
const FILE_NAME: &str = "ecritures-en-cours.txt";

/// Au lancement : efface les restes d'une écriture interrompue, puis ouvre un journal vide.
pub fn init(data_dir: &Path, conn: &Connection) {
    let file = data_dir.join(FILE_NAME);
    let left: Vec<PathBuf> = std::fs::read_to_string(&file)
        .map(|text| text.lines().filter(|l| !l.trim().is_empty()).map(PathBuf::from).collect())
        .unwrap_or_default();
    for path in &left {
        let _ = std::fs::remove_file(super::compress::tmp_of(path));
        let used = conn
            .prepare_cached("SELECT 1 FROM media WHERE path = ?1")
            .and_then(|mut s| s.exists([path.to_string_lossy()]))
            .unwrap_or(true);
        if !used && path.is_file() {
            match std::fs::remove_file(path) {
                Ok(()) => eprintln!("[journal] reste d'une écriture interrompue effacé : {}", path.display()),
                Err(e) => eprintln!("[journal] {} : {e}", path.display()),
            }
        }
    }
    let journal = Journal { file, entries: Vec::new() };
    save(&journal);
    *JOURNAL.lock().unwrap() = Some(journal);
}

/// Avant d'écrire `path` (nom final ; son fichier provisoire est déduit).
pub fn add(path: &Path) {
    let mut guard = JOURNAL.lock().unwrap();
    if let Some(journal) = guard.as_mut() {
        journal.entries.push(path.to_path_buf());
        save(journal);
    }
}

/// Fichiers enregistrés en base, ou abandonnés et déjà effacés.
pub fn remove(paths: &[PathBuf]) {
    if paths.is_empty() {
        return;
    }
    let mut guard = JOURNAL.lock().unwrap();
    if let Some(journal) = guard.as_mut() {
        journal.entries.retain(|e| !paths.contains(e));
        save(journal);
    }
}

/// Écrit d'abord à côté puis remplace : un journal n'est jamais à moitié écrit (une ligne coupée pourrait désigner un
/// autre fichier).
fn save(journal: &Journal) {
    let text: String = journal.entries.iter().map(|p| format!("{}\n", p.display())).collect();
    let tmp = journal.file.with_extension("txt.tmp");
    if let Err(e) = std::fs::write(&tmp, text).and_then(|()| std::fs::rename(&tmp, &journal.file)) {
        eprintln!("[journal] écriture : {e}");
    }
}
