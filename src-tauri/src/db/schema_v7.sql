-- MyBoard — schéma, version 7 (phase 3, lot 5 : synonymes et tags parents).
-- Principe (GEN-21) : chaque fusion ou règle garde la liste des médias concernés, pour être défaite.

-- Synonymes (TAGM-15) : un nom redirigé vers son tag principal (saisie, import, recherche). Quand le
-- synonyme vient d'un tag fusionné, ses réglages sont gardés pour le recréer à l'identique si l'on
-- décoche le synonyme (catégorie NULL : synonyme créé sans tag existant).
CREATE TABLE tag_aliases (
    id             INTEGER PRIMARY KEY,
    alias          TEXT    NOT NULL UNIQUE,
    tag_id         INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
    enabled        INTEGER NOT NULL DEFAULT 1,
    created_at     INTEGER NOT NULL,
    category_id    INTEGER,
    description    TEXT,
    hidden         INTEGER NOT NULL DEFAULT 0,
    tag_created_at INTEGER
);
CREATE INDEX tag_aliases_tag ON tag_aliases (tag_id);

-- Médias qui portaient le synonyme (à la fusion, ou tapé depuis) ; `had_target` : ils avaient déjà
-- le tag principal (décocher le leur laisse).
CREATE TABLE tag_alias_media (
    alias_id   INTEGER NOT NULL REFERENCES tag_aliases (id) ON DELETE CASCADE,
    media_id   INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    had_target INTEGER NOT NULL,
    PRIMARY KEY (alias_id, media_id)
) WITHOUT ROWID;
CREATE INDEX tag_alias_media_media ON tag_alias_media (media_id);

-- Règles de parents (TAGM-16) : poser l'enfant pose le parent. `enabled` = la case de la règle,
-- `auto` = l'interrupteur « Auto » (poser le parent aux prochains ajouts de l'enfant).
CREATE TABLE tag_parents (
    id         INTEGER PRIMARY KEY,
    child_id   INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
    parent_id  INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
    enabled    INTEGER NOT NULL DEFAULT 1,
    auto       INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    UNIQUE (child_id, parent_id)
);
CREATE INDEX tag_parents_parent ON tag_parents (parent_id);

-- Tags posés par une règle (le parent et, en chaîne, ses propres parents) sur chaque média :
-- décocher la règle les retire, la recocher les remet.
CREATE TABLE tag_parent_media (
    rule_id  INTEGER NOT NULL REFERENCES tag_parents (id) ON DELETE CASCADE,
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
    PRIMARY KEY (rule_id, media_id, tag_id)
) WITHOUT ROWID;
CREATE INDEX tag_parent_media_media ON tag_parent_media (media_id, tag_id);

-- Médias qui ont reçu l'enfant pendant que la règle ne s'appliquait pas (case décochée ou « Auto »
-- éteint) : la réactivation propose de leur ajouter le parent.
CREATE TABLE tag_parent_skipped (
    rule_id  INTEGER NOT NULL REFERENCES tag_parents (id) ON DELETE CASCADE,
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    PRIMARY KEY (rule_id, media_id)
) WITHOUT ROWID;

-- Retrait d'un tag d'un média (à la main ou autrement) : le média sort des listes des règles et des
-- synonymes ACTIFS qui le concernent (décocher puis recocher ne le lui remettra pas) ; pour une règle
-- dont c'est le parent, tout ce qu'elle avait posé sur ce média est oublié (ses parents en chaîne
-- restent, la règle ne touchera plus ce média). Les listes des règles et synonymes décochés sont
-- gardées : décocher retire les tags après avoir décoché. Les conditions WHEN évitent tout travail
-- pour un tag sans règle ni synonyme (le cas courant : retrait groupé, suppression de médias).
CREATE TRIGGER parent_lists_tag_removed AFTER DELETE ON media_tags
WHEN EXISTS (SELECT 1 FROM tag_parents WHERE parent_id = OLD.tag_id)
  OR EXISTS (SELECT 1 FROM tag_parent_media WHERE media_id = OLD.media_id AND tag_id = OLD.tag_id)
BEGIN
    DELETE FROM tag_parent_media
     WHERE media_id = OLD.media_id
       AND rule_id IN (SELECT id FROM tag_parents WHERE enabled = 1 AND parent_id = OLD.tag_id);
    DELETE FROM tag_parent_media
     WHERE media_id = OLD.media_id AND tag_id = OLD.tag_id
       AND rule_id IN (SELECT id FROM tag_parents WHERE enabled = 1);
END;
CREATE TRIGGER alias_lists_tag_removed AFTER DELETE ON media_tags
WHEN EXISTS (SELECT 1 FROM tag_aliases WHERE tag_id = OLD.tag_id AND enabled = 1)
BEGIN
    DELETE FROM tag_alias_media
     WHERE media_id = OLD.media_id
       AND alias_id IN (SELECT id FROM tag_aliases WHERE tag_id = OLD.tag_id AND enabled = 1);
END;

-- Un synonyme change ce que trouve une recherche par nom (SRCH-17).
CREATE TRIGGER search_generation_alias_added AFTER INSERT ON tag_aliases BEGIN
    UPDATE search_generation SET n = n + 1;
END;
CREATE TRIGGER search_generation_alias_changed AFTER UPDATE ON tag_aliases BEGIN
    UPDATE search_generation SET n = n + 1;
END;
CREATE TRIGGER search_generation_alias_removed AFTER DELETE ON tag_aliases BEGIN
    UPDATE search_generation SET n = n + 1;
END;
