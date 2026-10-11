# Historique des versions

Format : une entrée par tâche livrée, la plus récente en haut. Les IDs renvoient à `docs/SPEC.md`.
La colonne « Backup » renvoie au dossier `Backups/vX` correspondant.

## Phase 0 — Décisions miniatures et ffmpeg (11/10/2026) — Backup v2

- D-011 / SPEC LIB-06, LIB-09 à LIB-11 : miniatures hybrides (petites d'avance, grandes à la demande).
- D-012 / SPEC IMP-48, IMP-49 : ffmpeg du PC pendant le développement, embarqué plus tard.
- Rust 1.99 (stable, MSVC) installé sur le PC et vérifié.

## Phase 0 — Fondations (11/10/2026) — Backup v1

- Analyse complète de l'historique (Python v4, LMArena, GLM v1 → v8) et diagnostic.
- Dépôt GitHub réorganisé : historique GLM conservé sur la branche `old_GLM`, `main` repart à zéro.
- Création du cahier des charges unique `docs/SPEC.md` (toutes les demandes numérotées).
- Création du journal des décisions `docs/DECISIONS.md` (D-001 à D-010).
- Règles de travail `CLAUDE.md`, `.gitignore` (aucun média / base / secret sur le dépôt public).
- Script de sauvegarde automatique `backup.ps1` (hors dépôt).
- Captures de référence de l'interface v8 (`docs/reference-ui/`, hors dépôt).
