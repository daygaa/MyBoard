-- MyBoard — schéma, version 6 (phase 3, lot 4 : gestionnaire de tags).

-- Description d'un tag (TAGM-14), comme le wiki de Danbooru : texte libre ; NULL = aucune.
ALTER TABLE tags ADD COLUMN description TEXT;

-- Groupes de « tags proches » que l'utilisateur a choisi d'ignorer (TAGM-13) : identifiants triés,
-- séparés par des virgules (« 12,40,77 »). Un groupe qui change (tag ajouté, renommé, fusionné) est
-- proposé à nouveau.
CREATE TABLE tag_similar_ignored (
    tag_ids TEXT PRIMARY KEY
) WITHOUT ROWID;

-- Un tag renommé (TAGM-04) : les recherches gardées en mémoire par nom ne valent plus (SRCH-17).
CREATE TRIGGER search_generation_tag_renamed AFTER UPDATE OF name ON tags BEGIN
    UPDATE search_generation SET n = n + 1;
END;
