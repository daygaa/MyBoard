-- MyBoard — schéma, version 15 : tri par nom de fichier (FILT-09, lot 3 de la fin du retour de la phase 3, 06/11).
-- `name_key` : clé de tri du nom, calculée par MyBoard (db/name_key.rs : ordre de l'Explorateur de Windows,
-- majuscules et accents ignorés, nombres par leur valeur). Remplie à l'ouverture pour les médias déjà là.
ALTER TABLE media ADD COLUMN name_key TEXT;
CREATE INDEX media_name_key ON media (name_key, id);
