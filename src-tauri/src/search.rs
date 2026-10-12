//! Recherche par tags (SRCH-02 à SRCH-05) : transforme les termes de la recherche en
//! conditions SQL. Plusieurs termes = ET ; `-tag` = exclusion ; `tag*` = « commence par ».
//! Les filtres par type et le tri n'en font jamais partie (FILT-02).

use rusqlite::types::Value;

use crate::tags::normalize;

enum Term {
    Exact(String),
    /// Joker `tag*` : tous les tags qui commencent par ce texte.
    Prefix(String),
}

/// Ensemble des médias qui portent le terme (sous-requête sur `media_tags`).
fn media_with(term: &Term, params: &mut Vec<Value>) -> String {
    match term {
        Term::Exact(name) => {
            params.push(Value::Text(name.clone()));
            // Tag inexistant : la sous-requête ne renvoie rien, donc aucun résultat.
            "SELECT media_id FROM media_tags WHERE tag_id = (SELECT id FROM tags WHERE name = ?)".into()
        }
        Term::Prefix(prefix) => {
            params.push(Value::Text(prefix.clone()));
            params.push(Value::Text(format!("{prefix}\u{10FFFF}")));
            "SELECT media_id FROM media_tags WHERE tag_id IN (SELECT id FROM tags WHERE name >= ? AND name < ?)".into()
        }
    }
}

/// Conditions SQL (à joindre par AND) et leurs paramètres pour les termes donnés.
/// Un joker seul (`*`) ou un terme vide est ignoré.
pub fn conditions(terms: &[String], params: &mut Vec<Value>) -> Vec<String> {
    let mut out = Vec::new();
    for raw in terms {
        let raw = raw.trim();
        let (exclude, body) = match raw.strip_prefix('-') {
            Some(rest) => (true, rest),
            None => (false, raw),
        };
        let prefix = body.ends_with('*');
        let Some(name) = normalize(body) else { continue };
        let term = if prefix { Term::Prefix(name) } else { Term::Exact(name) };
        let set = media_with(&term, params);
        out.push(format!("id {} ({set})", if exclude { "NOT IN" } else { "IN" }));
    }
    out
}
