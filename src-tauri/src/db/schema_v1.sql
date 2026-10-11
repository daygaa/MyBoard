-- MyBoard — schéma de la base, version 1.
-- Règle (D-005) : les compteurs (médias par tag, tags par média, médias par dossier)
-- sont tenus par des déclencheurs SQL, jamais recalculés à la main par l'application.

-- Médias référencés sur place (LIB-01) : on stocke le chemin, jamais une copie.
CREATE TABLE media (
    id               INTEGER PRIMARY KEY,
    hash             TEXT    NOT NULL UNIQUE,              -- BLAKE3 du contenu (LIB-03)
    path             TEXT    NOT NULL UNIQUE COLLATE NOCASE, -- chemin absolu (Windows ignore la casse)
    file_name        TEXT    NOT NULL,
    ext              TEXT    NOT NULL,                     -- minuscules, sans le point
    kind             TEXT    NOT NULL CHECK (kind IN ('image', 'video', 'audio', 'document')),
    size             INTEGER NOT NULL,                     -- poids en octets
    width            INTEGER,                              -- dimensions affichées (rotation EXIF appliquée)
    height           INTEGER,
    pixels           INTEGER GENERATED ALWAYS AS (width * height) VIRTUAL, -- tri par résolution
    duration_ms      INTEGER,                              -- vidéos
    file_created_at  INTEGER,                              -- ms depuis 1970 (FILT-05)
    file_modified_at INTEGER,                              -- sert à repérer un fichier modifié
    imported_at      INTEGER NOT NULL,
    tag_count        INTEGER NOT NULL DEFAULT 0,           -- tenu par déclencheurs
    -- 0 à faire · 1 prête · 2 erreur · 3 pas de miniature (audio, documents) · 4 ffmpeg absent
    thumb_status     INTEGER NOT NULL DEFAULT 0,
    missing_since    INTEGER,                              -- fichier introuvable (Q-01, plus tard)
    pending_delete   INTEGER NOT NULL DEFAULT 0            -- suppression en cours (DEL-03, plus tard)
);

-- Index des tris et filtres (l'id sert de départage pour une pagination stable).
CREATE INDEX media_kind_id     ON media (kind, id);
CREATE INDEX media_created     ON media (file_created_at, id);
CREATE INDEX media_size        ON media (size, id);
CREATE INDEX media_pixels      ON media (pixels, id);
CREATE INDEX media_tag_count   ON media (tag_count, id);
CREATE INDEX media_thumb_todo  ON media (id) WHERE thumb_status = 0;

-- Catégories de tags = données (TAGM-01), modifiables plus tard par le gestionnaire.
CREATE TABLE tag_categories (
    id         INTEGER PRIMARY KEY,
    key        TEXT    NOT NULL UNIQUE,
    name       TEXT    NOT NULL,
    color      TEXT    NOT NULL,
    sort_order INTEGER NOT NULL
);

CREATE TABLE tags (
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL UNIQUE,
    category_id INTEGER NOT NULL REFERENCES tag_categories (id),
    media_count INTEGER NOT NULL DEFAULT 0,                -- tenu par déclencheurs
    hidden      INTEGER NOT NULL DEFAULT 0,                -- TAGM-05
    created_at  INTEGER NOT NULL
);
CREATE INDEX tags_category ON tags (category_id);

CREATE TABLE media_tags (
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
    PRIMARY KEY (media_id, tag_id)
) WITHOUT ROWID;
CREATE INDEX media_tags_tag ON media_tags (tag_id, media_id);

CREATE TRIGGER media_tags_after_insert AFTER INSERT ON media_tags BEGIN
    UPDATE tags  SET media_count = media_count + 1 WHERE id = NEW.tag_id;
    UPDATE media SET tag_count   = tag_count + 1   WHERE id = NEW.media_id;
END;

CREATE TRIGGER media_tags_after_delete AFTER DELETE ON media_tags BEGIN
    UPDATE tags  SET media_count = media_count - 1 WHERE id = OLD.tag_id;
    UPDATE media SET tag_count   = tag_count - 1   WHERE id = OLD.media_id;
END;

-- Favoris : système dédié, une seule source de vérité (FAV-01).
CREATE TABLE favorites (
    media_id INTEGER PRIMARY KEY REFERENCES media (id) ON DELETE CASCADE,
    added_at INTEGER NOT NULL
);

-- Dossiers manuels, indépendants des tags (FOLD-01).
CREATE TABLE folders (
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    color       TEXT,
    hidden      INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    media_count INTEGER NOT NULL DEFAULT 0,                -- tenu par déclencheurs
    created_at  INTEGER NOT NULL
);

CREATE TABLE folder_media (
    folder_id INTEGER NOT NULL REFERENCES folders (id) ON DELETE CASCADE,
    media_id  INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    added_at  INTEGER NOT NULL,
    PRIMARY KEY (folder_id, media_id)
) WITHOUT ROWID;
CREATE INDEX folder_media_media ON folder_media (media_id);

CREATE TRIGGER folder_media_after_insert AFTER INSERT ON folder_media BEGIN
    UPDATE folders SET media_count = media_count + 1 WHERE id = NEW.folder_id;
END;

CREATE TRIGGER folder_media_after_delete AFTER DELETE ON folder_media BEGIN
    UPDATE folders SET media_count = media_count - 1 WHERE id = OLD.folder_id;
END;

-- Réglages de l'application (clé → valeur JSON).
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Catégories initiales (TAGM-02). Ordre et couleurs provisoires : question Q-05.
INSERT INTO tag_categories (key, name, color, sort_order) VALUES
    ('copyright', 'Copyright',  '#e879f9', 1),
    ('character', 'Personnage', '#34d399', 2),
    ('artist',    'Artiste',    '#fb7185', 3),
    ('general',   'Général',    '#7dd3fc', 4),
    ('meta',      'Méta',       '#fcd34d', 5),
    ('people',    'Personnes',  '#fdba74', 6),
    ('date',      'Date',       '#5eead4', 7),
    ('place',     'Lieu',       '#bef264', 8);
