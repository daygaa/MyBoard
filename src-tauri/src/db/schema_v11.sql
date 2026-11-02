-- MyBoard — schéma, version 11 (refonte des synonymes et des parents, lot R5 : les règles de parents suivent la
-- fusion et reviennent à la défusion ; retour T3, point TAGM-16.4 ; décisions D11 à D11.3 ; D-047).

-- Règle déplacée par la fusion d'un tag : ce tag, du côté de l'enfant ou du parent, pour la ramener à la défusion
-- (vide : règle ordinaire). Le tag d'origine supprimé : la règle reste où elle est, ordinaire (réponse 5a du lot R5).
ALTER TABLE tag_parents ADD COLUMN child_from INTEGER REFERENCES tags (id) ON DELETE SET NULL;
ALTER TABLE tag_parents ADD COLUMN parent_from INTEGER REFERENCES tags (id) ON DELETE SET NULL;

-- Note d'une règle (« elle a posé ce tag sur ce média ») passée au principal par la fusion de ce tag : elle revient
-- sur lui à la défusion.
ALTER TABLE tag_parent_media ADD COLUMN moved_from INTEGER REFERENCES tags (id) ON DELETE SET NULL;

-- Retrait d'un tag d'un média (version 8), sauf pour un tag fusionné : la fusion lui retire tous ses médias et range
-- elle-même les notes des règles (celles des règles mises de côté restent pour la défusion).
DROP TRIGGER parent_lists_tag_removed;
CREATE TRIGGER parent_lists_tag_removed AFTER DELETE ON media_tags
WHEN (EXISTS (SELECT 1 FROM tag_parents WHERE parent_id = OLD.tag_id)
      OR EXISTS (SELECT 1 FROM tag_parent_media WHERE media_id = OLD.media_id AND tag_id = OLD.tag_id))
 AND NOT EXISTS (SELECT 1 FROM tag_group_names WHERE tag_id = OLD.tag_id AND merged = 1)
BEGIN
    DELETE FROM tag_parent_media
     WHERE media_id = OLD.media_id
       AND rule_id IN (SELECT id FROM tag_parents WHERE parent_id = OLD.tag_id);
    DELETE FROM tag_parent_media WHERE media_id = OLD.media_id AND tag_id = OLD.tag_id;
END;
