//! Vue affichée par la grille : toute la bibliothèque, les favoris (FAV-02) ou un dossier (FOLD-04),
//! et les tris qui en dépendent (« Ajout aux favoris », « Ajout au dossier », FAV-05). Partagé par la
//! grille sans recherche (`library.rs`) et l'index de recherche (`search.rs`).

use crate::library;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Scope {
    Library,
    Favorites,
    Folder(i64),
}

/// Tri par date d'ajout aux favoris ou au dossier ?
fn is_added(sort: &str) -> bool {
    sort == "added_desc" || sort == "added_asc"
}

impl Scope {
    pub fn new(favorites: bool, folder: Option<i64>) -> Self {
        match (favorites, folder) {
            (_, Some(id)) => Scope::Folder(id),
            (true, None) => Scope::Favorites,
            _ => Scope::Library,
        }
    }

    /// Tri appliqué : un tri d'ajout n'existe que dans les favoris et les dossiers ; ailleurs, la
    /// page s'affiche en « Récents » (FAV-05).
    pub fn sort(self, sort: &str) -> &str {
        if is_added(sort) && self == Scope::Library { "recent" } else { sort }
    }

    /// Jointure qui limite les médias à la vue (`x` : lien favori ou lien du dossier). Les
    /// identifiants sont des nombres : aucune injection possible.
    pub fn join(self) -> String {
        match self {
            Scope::Library => String::new(),
            Scope::Favorites => " JOIN favorites x ON x.media_id = media.id".into(),
            Scope::Folder(id) => format!(" JOIN folder_media x ON x.media_id = media.id AND x.folder_id = {id}"),
        }
    }

    /// ORDER BY d'une requête jointe par `join`.
    pub fn order_by(self, sort: &str) -> &'static str {
        match self.sort(sort) {
            "added_desc" => "x.added_at DESC, media.id DESC",
            "added_asc" => "x.added_at ASC, media.id ASC",
            other => library::order_by(other),
        }
    }

    /// Médias de la vue, pour l'index de recherche : clé de l'ensemble gardé et requête.
    pub fn set_query(self) -> Option<(String, String)> {
        match self {
            Scope::Library => None,
            Scope::Favorites => Some(("v:favoris".into(), "SELECT media_id FROM favorites ORDER BY media_id".into())),
            Scope::Folder(id) => Some((
                format!("v:dossier:{id}"),
                format!("SELECT media_id FROM folder_media WHERE folder_id = {id} ORDER BY media_id"),
            )),
        }
    }

    /// Tri d'ajout dans l'index de recherche : requête des liens de la vue (avec un `WHERE`, pour y
    /// ajouter des conditions par `AND`) et sens du tri. `None` hors tri d'ajout.
    pub fn added_source(self, sort: &str) -> Option<(String, &'static str)> {
        let dir = match self.sort(sort) {
            "added_desc" => "DESC",
            "added_asc" => "ASC",
            _ => return None,
        };
        let source = match self {
            Scope::Library => return None,
            Scope::Favorites => "SELECT media_id FROM favorites WHERE 1".to_string(),
            Scope::Folder(id) => format!("SELECT media_id FROM folder_media WHERE folder_id = {id}"),
        };
        Some((source, dir))
    }
}
