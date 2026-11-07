-- MyBoard — schéma, version 17 : dernière ouverture d'un dossier (FOLD-10, retour AUT.13, 07/11), pour le tri
-- « Ouverts : récents / anciens » de la liste des dossiers. Notée quand la page du dossier s'affiche ou qu'un média
-- y est ajouté ou retiré (choix de l'utilisateur) ; vide = jamais ouvert : compte comme ouvert à sa création.
ALTER TABLE folders ADD COLUMN opened_at INTEGER;
