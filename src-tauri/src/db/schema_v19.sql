-- MyBoard — schéma, version 19 : la recherche par nom de fichier (SRCH-26) garde ses résultats en mémoire tant que
-- `search_generation` ne change pas. Depuis IMP-60 (lot 3 de la phase 4), une image compressée garde sa fiche mais
-- change de nom (« photo (compressé).jpg ») : le nouveau nom doit être trouvé aussitôt (SRCH-30, 10/11).
CREATE TRIGGER search_generation_file_renamed AFTER UPDATE OF file_name ON media BEGIN
    UPDATE search_generation SET n = n + 1;
END;
