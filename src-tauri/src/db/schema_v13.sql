-- MyBoard — schéma, version 13 (refonte des synonymes et des parents, lot R6-2 : tags proches ; réponses 3 et 4 du
-- lot R6). Ce que l'utilisateur écarte des tags proches est retenu par paires « ces deux tags ne sont pas synonymes »,
-- rangées par action pour la liste « Ignorés (N) » : « Ignorer » un bloc (`group` : toutes les paires entre ses
-- tags), ou décocher des tags avant de créer le groupe (`apart` : paires entre les tags écartés et les autres).
CREATE TABLE tag_similar_ignores (
    id         INTEGER PRIMARY KEY,
    kind       TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE TABLE tag_similar_ignore_tags (
    ignore_id INTEGER NOT NULL REFERENCES tag_similar_ignores (id) ON DELETE CASCADE,
    tag_id    INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
    -- Tag écarté ; les autres tags d'une action `apart` sont ceux qui ont été gardés.
    apart     INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (ignore_id, tag_id)
) WITHOUT ROWID;

-- Conversion : chaque groupe ignoré (liste exacte « 12,40,77 ») devient une action `group`.
CREATE TEMP TABLE old_ignored AS SELECT ROW_NUMBER() OVER (ORDER BY tag_ids) AS id, tag_ids FROM tag_similar_ignored;
INSERT INTO tag_similar_ignores (id, kind, created_at) SELECT id, 'group', 0 FROM old_ignored;
WITH RECURSIVE split (id, rest, tag) AS (
    SELECT id, tag_ids || ',', NULL FROM old_ignored
    UNION ALL
    SELECT id, substr(rest, instr(rest, ',') + 1), CAST(substr(rest, 1, instr(rest, ',') - 1) AS INTEGER) FROM split WHERE rest <> ''
)
INSERT OR IGNORE INTO tag_similar_ignore_tags (ignore_id, tag_id) SELECT id, tag FROM split WHERE tag IN (SELECT id FROM tags);
DROP TABLE old_ignored;
DROP TABLE tag_similar_ignored;
-- Un groupe dont il reste moins de deux tags n'écarte plus rien.
DELETE FROM tag_similar_ignores WHERE (SELECT COUNT(*) FROM tag_similar_ignore_tags t WHERE t.ignore_id = tag_similar_ignores.id) < 2;
