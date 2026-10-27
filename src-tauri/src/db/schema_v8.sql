-- MyBoard — schéma, version 8 (refonte des synonymes et des parents, lot R2 : règles de parents, TAGM-20,
-- D-047). Une règle n'a plus qu'un interrupteur (`enabled`) : allumée, chaque nouvel ajout de l'enfant pose le
-- parent ; éteinte, elle ne pose plus rien et ne retire rien. « Auto » et les médias « sautés » disparaissent.

-- Conversion (cas A-04) : case cochée et « Auto » allumé → allumée ; tous les autres états → éteinte. Aucun
-- média ne change.
UPDATE tag_parents SET enabled = 0 WHERE auto = 0;
DROP TRIGGER parent_lists_tag_removed;
ALTER TABLE tag_parents DROP COLUMN auto;
DROP TABLE tag_parent_skipped;

-- La liste d'une règle ne sert plus qu'à la case de retrait de sa suppression : elle ne garde que les tags
-- encore présents (une règle décochée avant la version 8 avait retiré ses tags en gardant sa liste).
DELETE FROM tag_parent_media
 WHERE NOT EXISTS (SELECT 1 FROM media_tags m WHERE m.media_id = tag_parent_media.media_id AND m.tag_id = tag_parent_media.tag_id);

-- Retrait d'un tag d'un média (à la main ou autrement) : chaque règle, allumée ou éteinte, oublie ce tag sur ce
-- média (la case de retrait ne le reprendra pas) ; pour une règle dont c'est le parent, tout ce qu'elle avait
-- posé sur ce média est oublié (ses parents en chaîne restent, la règle ne touchera plus ce média). Les
-- conditions WHEN évitent tout travail pour un tag sans règle (le cas courant).
CREATE TRIGGER parent_lists_tag_removed AFTER DELETE ON media_tags
WHEN EXISTS (SELECT 1 FROM tag_parents WHERE parent_id = OLD.tag_id)
  OR EXISTS (SELECT 1 FROM tag_parent_media WHERE media_id = OLD.media_id AND tag_id = OLD.tag_id)
BEGIN
    DELETE FROM tag_parent_media
     WHERE media_id = OLD.media_id
       AND rule_id IN (SELECT id FROM tag_parents WHERE parent_id = OLD.tag_id);
    DELETE FROM tag_parent_media WHERE media_id = OLD.media_id AND tag_id = OLD.tag_id;
END;
