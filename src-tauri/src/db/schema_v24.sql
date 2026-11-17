-- MyBoard — schéma, version 24 : empreintes d'avant une rotation (VIEW-60, réponse Q64 A du 17/11). Chaque fois que
-- MyBoard écrit une rotation dans un fichier (JPEG, TIFF, DNG, RAW, MP4…), l'empreinte que le fichier avait juste
-- avant est gardée ici avec son média (BLAKE3, 32 octets) : la même photo non tournée, importée d'ailleurs, est
-- reconnue comme doublon de ce média, quel que soit le sens. Effacées avec le média.
CREATE TABLE turned_hashes (
    hash     BLOB NOT NULL PRIMARY KEY,                                   -- empreinte d'avant une rotation
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE      -- média tourné
) WITHOUT ROWID;
CREATE INDEX idx_turned_hashes_media ON turned_hashes(media_id);
