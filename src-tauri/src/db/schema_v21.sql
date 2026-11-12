-- MyBoard — schéma, version 21 : travail en arrière-plan sur les tags (TAGM-23, 12/11). Mettre des tags à la corbeille,
-- les supprimer définitivement ou les restaurer est immédiat à l'écran ; le travail en base se fait ensuite, par petits
-- paquets. Une ligne par tag en attente, retirée dans la transaction qui le traite : MyBoard fermé entre-temps, le
-- travail reprend exactement là où il s'était arrêté au lancement suivant (réponse Q6 A, comme DEL-03).
CREATE TABLE tag_jobs (
    seq          INTEGER PRIMARY KEY,         -- ordre de traitement
    request      INTEGER NOT NULL,            -- une demande (pop-in, bouton) = un numéro
    kind         INTEGER NOT NULL,            -- 1 = à la corbeille, 2 = suppression définitive, 3 = restauration
    target       INTEGER NOT NULL,            -- le tag (1, 2) ou la ligne de la corbeille (3)
    strip        INTEGER NOT NULL DEFAULT 0,  -- cases de la pop-in de suppression (TAGM-04, TAGM-16)
    remove_posed INTEGER NOT NULL DEFAULT 0,
    -- À la corbeille : ce à quoi le tag était lié au moment de la demande (pop-in « Voulez-vous restaurer… ? »).
    name         TEXT,
    category_id  INTEGER,
    hidden       INTEGER,
    media        INTEGER,
    rules        INTEGER,
    synonyms     INTEGER,
    at           INTEGER                      -- date de la demande (ms depuis 1970)
);
