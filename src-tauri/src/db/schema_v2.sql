-- MyBoard — schéma, version 2 (phase 2).

-- Ordre et couleurs des catégories (TAGM-03, Q-05 tranchée le 12/10/2026) :
-- « personnelles en premier », couleurs « convention booru ».
UPDATE tag_categories SET sort_order = 1, color = '#f9a8d4' WHERE key = 'people';
UPDATE tag_categories SET sort_order = 2, color = '#5eead4' WHERE key = 'place';
UPDATE tag_categories SET sort_order = 3, color = '#e7d7b0' WHERE key = 'date';
UPDATE tag_categories SET sort_order = 4, color = '#d48cf5' WHERE key = 'copyright';
UPDATE tag_categories SET sort_order = 5, color = '#4ade80' WHERE key = 'character';
UPDATE tag_categories SET sort_order = 6, color = '#f87171' WHERE key = 'artist';
UPDATE tag_categories SET sort_order = 7, color = '#7dd3fc' WHERE key = 'general';
UPDATE tag_categories SET sort_order = 8, color = '#fb923c' WHERE key = 'meta';
