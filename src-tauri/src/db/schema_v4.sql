-- MyBoard — schéma, version 4.

-- Index de recherche en mémoire (SRCH-17) : il garde, pour chaque tag recherché, l'ensemble de
-- ses médias. Ce compteur augmente à chaque ajout ou retrait d'un lien tag-média et d'un média
-- (par n'importe quel chemin : visionneuse, import, futur gestionnaire de tags…) ; s'il a changé
-- depuis la dernière recherche, l'index repart de la base. Tenu par la base, jamais par le code.
CREATE TABLE search_generation (n INTEGER NOT NULL);
INSERT INTO search_generation (n) VALUES (0);

CREATE TRIGGER search_generation_tag_added AFTER INSERT ON media_tags BEGIN
    UPDATE search_generation SET n = n + 1;
END;
CREATE TRIGGER search_generation_tag_removed AFTER DELETE ON media_tags BEGIN
    UPDATE search_generation SET n = n + 1;
END;
CREATE TRIGGER search_generation_media_added AFTER INSERT ON media BEGIN
    UPDATE search_generation SET n = n + 1;
END;
CREATE TRIGGER search_generation_media_removed AFTER DELETE ON media BEGIN
    UPDATE search_generation SET n = n + 1;
END;
CREATE TRIGGER search_generation_media_kind AFTER UPDATE OF kind ON media BEGIN
    UPDATE search_generation SET n = n + 1;
END;

-- Tris « date ↑ » et « résolution ↑ » (dates et dimensions inconnues en dernier) : sans ces
-- index, la base retriait toute la bibliothèque à chaque page (≈ 150 ms à 300 000 médias, avec
-- ou sans recherche) ; avec, la page est lue directement (SRCH-17).
CREATE INDEX media_created_nulls_last ON media (file_created_at IS NULL, file_created_at, id);
CREATE INDEX media_pixels_nulls_last ON media (pixels IS NULL, pixels, id);
