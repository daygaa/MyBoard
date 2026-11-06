-- MyBoard — schéma, version 16 : fichiers de sous-titres importés pour une vidéo (VIEW-52, retour VIS.1.4, 06/11).
-- « Importer un fichier » (menus des sous-titres) : le chemin du fichier choisi est retenu pour cette vidéo et
-- proposé à chaque ouverture (choix de l'utilisateur) ; le fichier n'est jamais copié ni modifié. Fichier déplacé
-- ou supprimé : il n'est plus proposé.
CREATE TABLE media_subtitles (
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    path     TEXT    NOT NULL,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (media_id, path)
);
