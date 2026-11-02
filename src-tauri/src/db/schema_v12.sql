-- MyBoard — schéma, version 12 (refonte des synonymes et des parents, lot R5-2 : case « Étendre », décision D11.3).
-- Note d'une règle étendue à tout le groupe pendant la fusion de ce tag (le parent posé aux médias du groupe) : la
-- défusion retire ces tags là où le tag fusionné ne revient pas.
ALTER TABLE tag_parent_media ADD COLUMN extended INTEGER REFERENCES tags (id) ON DELETE SET NULL;
