-- MyBoard — schéma, version 14 : corbeille des tags (TAGM-19, lot 2 de la fin du retour de la phase 3, 05/11 ; D-049).
-- Un tag supprimé y est gardé 30 jours, un tag par ligne, indépendant des autres. `journal` (JSON) : ce que sa
-- suppression a changé dans la base (lignes retirées, ajoutées, modifiées), pour tout remettre comme avant.
-- `media`, `rules`, `synonyms` : ce à quoi il était lié au moment de la suppression (pop-ins).
CREATE TABLE tag_trash (
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL,
    category_id INTEGER,
    hidden      INTEGER NOT NULL DEFAULT 0,
    media       INTEGER NOT NULL,
    rules       INTEGER NOT NULL,
    synonyms    INTEGER NOT NULL,
    deleted_at  INTEGER NOT NULL,   -- ms depuis 1970
    journal     TEXT    NOT NULL
);
CREATE INDEX tag_trash_name ON tag_trash (name);
CREATE INDEX tag_trash_deleted ON tag_trash (deleted_at);
