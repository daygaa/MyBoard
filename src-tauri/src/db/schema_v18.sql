-- MyBoard — schéma, version 18 : image compressée à l'import (IMP-20, IMP-27, D-058, 09/11). Le fichier compressé
-- est écrit à côté de l'original et le média pointe vers lui ; `original_hash` garde l'empreinte de l'original
-- (LIB-03), pour qu'un réimport de l'original soit reconnu comme le même média. Vide pour tous les autres médias.
ALTER TABLE media ADD COLUMN original_hash TEXT;
CREATE INDEX media_original_hash ON media (original_hash) WHERE original_hash IS NOT NULL;
