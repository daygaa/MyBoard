-- MyBoard — schéma, version 10 (refonte des synonymes et des parents, lot R3 bis ; décision B de l'utilisateur,
-- retour T3, point TAGM-15.22). Un tag fusionné reste un tag à part entière : la fusion lui retire seulement ses
-- médias (notés pour la défusion), qui reçoivent le principal. Chaque nom d'un groupe est donc un tag
-- (`tag_id`), fusionné ou non (`merged`). Les colonnes `name`, `category_id`, `description`, `hidden` et
-- `tag_created_at` de `tag_group_names` ne servent plus (toujours vides) : elles restent pour ne pas reconstruire
-- la table (sa reconstruction effacerait les listes de médias, liées par clé étrangère).

ALTER TABLE tag_group_names ADD COLUMN merged INTEGER NOT NULL DEFAULT 0;

-- Nom fusionné : son tag est recréé, sans média (ses médias portent le principal), avec ses réglages ; un nom
-- qui n'avait jamais été un tag (catégorie vide) devient un tag de la catégorie « Général ».
INSERT INTO tags (name, category_id, hidden, created_at, description)
SELECT n.name,
       COALESCE((SELECT id FROM tag_categories WHERE id = n.category_id), (SELECT id FROM tag_categories WHERE key = 'general')),
       n.hidden, COALESCE(n.tag_created_at, n.created_at), n.description
  FROM tag_group_names n
 WHERE n.tag_id IS NULL AND NOT EXISTS (SELECT 1 FROM tags t WHERE t.name = n.name);
UPDATE tag_group_names
   SET merged = 1, tag_id = (SELECT id FROM tags WHERE name = tag_group_names.name),
       name = NULL, category_id = NULL, description = NULL, hidden = 0, tag_created_at = NULL
 WHERE tag_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM tag_group_names o JOIN tags t ON t.id = o.tag_id WHERE t.name = tag_group_names.name)
   AND NOT EXISTS (SELECT 1 FROM tag_groups g JOIN tags t ON t.id = g.principal_id WHERE t.name = tag_group_names.name);
-- Cas impossible en principe (un tag du même nom déjà dans un groupe) : le nom est retiré.
DELETE FROM tag_group_names WHERE tag_id IS NULL;

-- Principal retiré d'un média : le média sort des listes des tags fusionnés du groupe (défaire la fusion ne leur
-- rendra pas ce média).
DROP TRIGGER group_lists_tag_removed;
CREATE TRIGGER group_lists_tag_removed AFTER DELETE ON media_tags
WHEN EXISTS (SELECT 1 FROM tag_groups WHERE principal_id = OLD.tag_id)
BEGIN
    DELETE FROM tag_group_media
     WHERE media_id = OLD.media_id
       AND name_id IN (SELECT n.id FROM tag_group_names n JOIN tag_groups g ON g.id = n.group_id
                        WHERE g.principal_id = OLD.tag_id AND n.merged = 1);
END;
