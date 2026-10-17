-- MyBoard — schéma, version 5 (phase 3 : suppression, favoris, dossiers).

-- Suppression en arrière-plan (DEL-01 à DEL-03) : `media.pending_delete` (schéma v1) vaut 1 pour
-- un média à retirer de la bibliothèque, 2 pour un média à retirer ET dont le fichier est à effacer
-- du disque (DEL-04). Un média marqué disparaît aussitôt de toutes les pages ; le service de
-- suppression le retire ensuite réellement, et reprend au lancement suivant si MyBoard a été fermé
-- entre-temps. Index partiel : seuls les médias marqués y figurent (presque toujours aucun), pour les
-- soustraire des comptes sans relire toute la table.
CREATE INDEX media_pending ON media (kind) WHERE pending_delete != 0;

-- Réserve des données des médias retirés de la bibliothèque sans effacer leur fichier (DEL-05) :
-- gardées 1 mois, retrouvées par l'empreinte du fichier s'il est réimporté. Rangées à part (le média
-- est réellement supprimé) : elles ne comptent dans aucun compteur ni aucune recherche (D-032).
CREATE TABLE media_reserve (
    hash        TEXT    PRIMARY KEY,   -- empreinte BLAKE3 du fichier (LIB-03)
    file_name   TEXT    NOT NULL,
    path        TEXT    NOT NULL,
    deleted_at  INTEGER NOT NULL,      -- ms depuis 1970
    favorite_at INTEGER,               -- date d'ajout aux favoris ; NULL = pas favori
    notes       TEXT,
    tags        TEXT    NOT NULL,      -- JSON : [{"name": …, "category": id}]
    folders     TEXT    NOT NULL       -- JSON : [{"id": …, "name": …, "created": ms, "added": ms}]
);
CREATE INDEX media_reserve_deleted ON media_reserve (deleted_at);

-- Tris « Ajout aux favoris » et « Ajout au dossier » (FAV-05).
CREATE INDEX favorites_added ON favorites (added_at, media_id);
CREATE INDEX folder_media_added ON folder_media (folder_id, added_at, media_id);

-- L'index de recherche (SRCH-17) garde aussi l'ensemble des favoris, de chaque dossier et des
-- médias en cours de suppression : ils changent la génération, comme les tags.
CREATE TRIGGER search_generation_pending AFTER UPDATE OF pending_delete ON media BEGIN
    UPDATE search_generation SET n = n + 1;
END;
CREATE TRIGGER search_generation_favorite_added AFTER INSERT ON favorites BEGIN
    UPDATE search_generation SET n = n + 1;
END;
CREATE TRIGGER search_generation_favorite_removed AFTER DELETE ON favorites BEGIN
    UPDATE search_generation SET n = n + 1;
END;
CREATE TRIGGER search_generation_folder_added AFTER INSERT ON folder_media BEGIN
    UPDATE search_generation SET n = n + 1;
END;
CREATE TRIGGER search_generation_folder_removed AFTER DELETE ON folder_media BEGIN
    UPDATE search_generation SET n = n + 1;
END;
