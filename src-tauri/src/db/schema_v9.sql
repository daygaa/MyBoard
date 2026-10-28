-- MyBoard — schéma, version 9 (refonte des synonymes et des parents, lot R3 : groupes de synonymes, TAGM-20,
-- D-047). Un groupe relie des noms autour d'un tag principal. Un nom relié est un vrai tag, à part (chercher un
-- nom du groupe trouve les médias de tout le groupe). Un nom fusionné n'est plus un tag : ses médias portent le
-- principal, et le groupe garde ce qu'il faut pour défaire la fusion à l'identique (GEN-21).

CREATE TABLE tag_groups (
    id           INTEGER PRIMARY KEY,
    principal_id INTEGER NOT NULL UNIQUE REFERENCES tags (id) ON DELETE CASCADE,
    created_at   INTEGER NOT NULL
);

-- Noms du groupe, hors principal : relié (`tag_id`, `name` vide) ou fusionné (`name`, `tag_id` vide, avec les
-- réglages du tag pour le recréer : catégorie NULL = nom qui n'a jamais été un tag).
CREATE TABLE tag_group_names (
    id             INTEGER PRIMARY KEY,
    group_id       INTEGER NOT NULL REFERENCES tag_groups (id) ON DELETE CASCADE,
    tag_id         INTEGER UNIQUE REFERENCES tags (id) ON DELETE CASCADE,
    name           TEXT    UNIQUE,
    category_id    INTEGER,
    description    TEXT,
    hidden         INTEGER NOT NULL DEFAULT 0,
    tag_created_at INTEGER,
    created_at     INTEGER NOT NULL,
    CHECK ((tag_id IS NULL) != (name IS NULL))
);
CREATE INDEX tag_group_names_group ON tag_group_names (group_id);

-- Médias d'un nom fusionné (à la fusion, ou tagués en tapant ce nom depuis) ; `had_principal` : ils avaient
-- déjà le principal par eux-mêmes (défaire la fusion le leur laisse).
CREATE TABLE tag_group_media (
    name_id       INTEGER NOT NULL REFERENCES tag_group_names (id) ON DELETE CASCADE,
    media_id      INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    had_principal INTEGER NOT NULL,
    PRIMARY KEY (name_id, media_id)
) WITHOUT ROWID;
CREATE INDEX tag_group_media_media ON tag_group_media (media_id);

-- Conversion des anciens synonymes (refonte, décision D12.1 ; cas A-01 à A-03, A-06) : un groupe par tag principal.
INSERT INTO tag_groups (principal_id, created_at) SELECT tag_id, MIN(created_at) FROM tag_aliases GROUP BY tag_id;
-- Nom seul décoché : un tag sans média, relié (proposition 1 A du lot R3).
INSERT INTO tags (name, category_id, hidden, created_at, description)
SELECT a.alias,
       COALESCE((SELECT id FROM tag_categories WHERE id = a.category_id), (SELECT id FROM tag_categories WHERE key = 'general')),
       a.hidden, COALESCE(a.tag_created_at, a.created_at), a.description
  FROM tag_aliases a
 WHERE a.enabled = 0 AND NOT EXISTS (SELECT 1 FROM tags t WHERE t.name = a.alias);
-- Synonyme décoché : nom relié (le tag du même nom), sauf s'il est lui-même le principal d'un groupe.
INSERT OR IGNORE INTO tag_group_names (group_id, tag_id, created_at)
SELECT g.id, t.id, a.created_at
  FROM tag_aliases a JOIN tags t ON t.name = a.alias JOIN tag_groups g ON g.principal_id = a.tag_id
 WHERE a.enabled = 0 AND t.id != a.tag_id AND NOT EXISTS (SELECT 1 FROM tag_groups o WHERE o.principal_id = t.id);
-- Synonyme coché : nom fusionné, avec sa liste de médias.
INSERT INTO tag_group_names (group_id, name, category_id, description, hidden, tag_created_at, created_at)
SELECT g.id, a.alias, a.category_id, a.description, a.hidden, a.tag_created_at, a.created_at
  FROM tag_aliases a JOIN tag_groups g ON g.principal_id = a.tag_id
 WHERE a.enabled = 1 AND NOT EXISTS (SELECT 1 FROM tags t WHERE t.name = a.alias);
INSERT INTO tag_group_media (name_id, media_id, had_principal)
SELECT n.id, m.media_id, m.had_target
  FROM tag_alias_media m JOIN tag_aliases a ON a.id = m.alias_id JOIN tag_group_names n ON n.name = a.alias
 WHERE a.enabled = 1;
DELETE FROM tag_groups WHERE NOT EXISTS (SELECT 1 FROM tag_group_names n WHERE n.group_id = tag_groups.id);

DROP TRIGGER alias_lists_tag_removed;
DROP TRIGGER search_generation_alias_added;
DROP TRIGGER search_generation_alias_changed;
DROP TRIGGER search_generation_alias_removed;
DROP TABLE tag_alias_media;
DROP TABLE tag_aliases;

-- Un groupe sans nom disparaît (dernier nom retiré, tag relié supprimé).
CREATE TRIGGER tag_group_emptied AFTER DELETE ON tag_group_names
WHEN NOT EXISTS (SELECT 1 FROM tag_group_names WHERE group_id = OLD.group_id)
BEGIN
    DELETE FROM tag_groups WHERE id = OLD.group_id;
END;

-- Principal retiré d'un média (à la main ou autrement) : le média sort des listes des noms fusionnés du groupe
-- (défaire la fusion ne lui rendra pas ces noms). La condition WHEN évite tout travail pour un tag sans groupe.
CREATE TRIGGER group_lists_tag_removed AFTER DELETE ON media_tags
WHEN EXISTS (SELECT 1 FROM tag_groups WHERE principal_id = OLD.tag_id)
BEGIN
    DELETE FROM tag_group_media
     WHERE media_id = OLD.media_id
       AND name_id IN (SELECT n.id FROM tag_group_names n JOIN tag_groups g ON g.id = n.group_id
                        WHERE g.principal_id = OLD.tag_id AND n.tag_id IS NULL);
END;

-- Un groupe change ce que trouve une recherche par nom (SRCH-17).
CREATE TRIGGER search_generation_group_added AFTER INSERT ON tag_groups BEGIN
    UPDATE search_generation SET n = n + 1;
END;
CREATE TRIGGER search_generation_group_changed AFTER UPDATE ON tag_groups BEGIN
    UPDATE search_generation SET n = n + 1;
END;
CREATE TRIGGER search_generation_group_removed AFTER DELETE ON tag_groups BEGIN
    UPDATE search_generation SET n = n + 1;
END;
CREATE TRIGGER search_generation_group_name_added AFTER INSERT ON tag_group_names BEGIN
    UPDATE search_generation SET n = n + 1;
END;
CREATE TRIGGER search_generation_group_name_changed AFTER UPDATE ON tag_group_names BEGIN
    UPDATE search_generation SET n = n + 1;
END;
CREATE TRIGGER search_generation_group_name_removed AFTER DELETE ON tag_group_names BEGIN
    UPDATE search_generation SET n = n + 1;
END;
