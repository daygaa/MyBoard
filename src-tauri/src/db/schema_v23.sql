-- MyBoard — schéma, version 23 : rotation d'affichage (VIEW-60, réponses Q21 et Q24 A du 14/11). Quarts de tour dans le
-- sens des aiguilles d'une montre (0 à 3), appliqués par l'interface aux formats dont la rotation ne peut pas être écrite
-- dans le fichier (PNG, GIF, WebP, HEIF, AVIF, MKV, WebM…). JPEG, TIFF, DNG, MP4 et MOV : rotation écrite dans le
-- fichier, cette colonne reste à 0. Largeur et hauteur restent celles du fichier.
ALTER TABLE media ADD COLUMN rotation INTEGER NOT NULL DEFAULT 0;
