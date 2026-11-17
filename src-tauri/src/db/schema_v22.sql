-- MyBoard — schéma, version 22 : le PSD (fichier de Photoshop) devient un document (lot R7, réponse Q55 A du 17/11) :
-- filtre Documents, jamais compressé ni converti ; sa miniature et la visionneuse montrent toujours son image aplatie.
-- Les PSD importés comme images par la v146 sont rangés avec les documents (miniature et dimensions gardées).
UPDATE media SET kind = 'document' WHERE lower(ext) = 'psd' AND kind = 'image';
