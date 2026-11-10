-- MyBoard — schéma, version 20 : versions écrites par MyBoard (IMP-68, 10/11). Une ligne par fichier compressé ou
-- converti : empreinte de la version → empreinte de l'original (BLAKE3, 32 octets chacune). Gardée même après la
-- suppression des médias : c'est elle qui reconnaît plus tard une paire que les noms ne suffisent pas à trouver
-- (« photo.webp » à côté de « photo.jpg »). Remplie au départ avec les versions déjà dans la bibliothèque.
CREATE TABLE versions (
    hash     BLOB NOT NULL PRIMARY KEY, -- empreinte de la version
    original BLOB NOT NULL              -- empreinte de l'original
) WITHOUT ROWID;
INSERT OR IGNORE INTO versions (hash, original)
    SELECT unhex(hash), unhex(original_hash) FROM media WHERE original_hash IS NOT NULL;
