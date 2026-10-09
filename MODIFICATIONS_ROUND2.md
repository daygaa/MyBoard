# MyBoard — Round 2 des modifications UI/UX

> Récapitulatif de toutes les modifications à appliquer, décomposées en 8 phases.
> Source : `modifUI-UX2.txt` (test utilisateur du 09/10/2026) + clarifications.
> Ordre : P1 → P7 (sans interruption), puis P8 (nettoyage) après test utilisateur.

## Phase 1 — Bugs critiques (P1)

| ID | Tâche | Détails |
|---|---|---|
| 1.1 | Fix visionneuse désactivée (bug critique Q26) | AlertDialog de suppression ne s'affiche pas mais reste ouvert en arrière-plan → désactive toutes les actions. Fix : s'assurer que le Dialog se ferme proprement + focus management |
| 1.2 | Fix favoris ne marchent pas (Q18) | Toggle favori bug, pas d'update temps réel. Fix : optimistic UI + CustomEvent + router.refresh() |
| 1.3 | Bouton 4 souris = Échap conditionnel (Q29) | Bouton 4 = Échap **seulement si Échap a une action** (visionneuse ouverte, dialog ouvert, batch mode actif). Sinon : retour arrière natif du navigateur |
| 1.4 | Fix scroll landing pendant zoom molette (déjà fait en Round 1, vérifier) | `document.body.style.overflow = "hidden"` quand lightbox ouverte |
| 1.5 | Fix bug update page courante (Q25) | Page courante ne se met pas à jour correctement quand on navigue image par image avec scrollbar présente. Debugger le calcul de page |

## Phase 2 — Zoom wikifeet (P2 — le plus ambitieux)

| ID | Tâche | Détails |
|---|---|---|
| 2.1 | Reproduire système zoom wikifeet | Basé sur l'analyse du code source `wfc.js` : zoom continu, min scale = `Math.min(vw/iw, vh/ih)`, max scale = 2 (ou adaptatif), clic = taille réelle, wheel = scale continu |
| 2.2 | Zoom au curseur | Formule : `ax = (cx - gpos[0]) / gscale`, puis `tx = cx - ax * nextscale`. Anchor au curseur |
| 2.3 | Clic sur image = zoom x1 (taille réelle) | Si déjà zoomé > 1 → revenir à 1. Si à 1 → aller à 1 (no-op) ou à max ? (wikifeet va à 1) |
| 2.4 | Clic sur fond gris (hors image) = fermer visionneuse | Comme wikifeet : `if (Math.abs(cx) > 0.5 * pw * minscale) SliderShow()` |
| 2.5 | Limiter zoom selon taille image | Image petite (689×689) → 5 ticks max. Image grande (6066×8256) → 10 ticks max. Calcul adaptatif |
| 2.6 | Pan fluide | Pan via mousemove avec `movementX/Y`. Si image centrée (pas de débordement), pas de pan |
| 2.7 | Dézoom = retour au centre | Quand scale revient à minscale, tx/ty = 0 (image recentrée) |
| 2.8 | Zoom sur vidéos : reporter à Tauri (Q28) | Garder `<video controls>` natif pour l'instant. Noter dans worklog "zoom custom vidéo = Tauri plus tard" |
| 2.9 | Échap + clic croix + bouton 4 souris ferment la visionneuse | Comportement unifié |

## Phase 3 — Suppression des médias (P3)

| ID | Tâche | Détails |
|---|---|---|
| 3.1 | Suppression en background (solution intermédiaire) | Solution : Promise.all batch 10 + cleanup au redémarrage (médias marqués "à supprimer" en DB nettoyés physiquement au prochain démarrage). Évite le soft-lock sans attendre Tauri. Noter "vraie suppression background = Tauri" dans worklog |
| 3.2 | Optimiser CPU (Q8) | Promise.all batch de 10 (parallélisation). Worker Node seulement si trop lent après |
| 3.3 | Checkbox "conserver les fichiers sur le disque" (Q9) | Ajouter dans le dialog de suppression. **Décochée par défaut** (supprime aussi du disque). Si cochée : supprime de la DB mais garde les fichiers dans `library/originals/` |
| 3.4 | Masquer médias immédiatement après confirmation | Optimistic UI : retirer les cartes de la grille instantanément, faire la suppression en arrière-plan |
| 3.5 | Feedback visuel pendant suppression | Toast "Suppression de X médias en cours..." + progress bar discrète |

## Phase 4 — Page importer des médias (P4)

| ID | Tâche | Détails |
|---|---|---|
| 4.1 | Corriger marge div card (point 1) | La div n°2 (card) doit faire la même largeur que la div n°1 (options). Alignement horizontal avec div n°3 |
| 4.2 | Boutons "Importer un fichier" / "Importer un dossier" (Q1) | Renommer "Parcourir" → "Importer un fichier", "Parcourir un dossier" → "Importer un dossier". Fix : le bouton dossier doit utiliser `<input webkitdirectory>` (actuellement les 2 utilisent l'API fichiers) |
| 4.3 | Texte "et X supplémentaires" + bouton "voir plus" (point 3) | Renommer "et X de plus..." → "et X supplémentaires". Ajouter bouton "voir plus" qui affiche 100 aperçus supplémentaires |
| 4.4 | Progression intégrée à la div d'import (Q2) | Déplacer l'élément de progression DANS la div `<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/40 px-4 py-3">`. Caché au départ, s'affiche pendant l'import, placé au-dessus de la liste des fichiers sélectionnés |
| 4.5 | Slider qualité vidéo 5 paliers (Q3) | Remplacer les 5 boutons par un Slider avec 5 points fixes (snapping) : Minimale/Basse/Moyenne/Haute/Max. `step=1, min=0, max=4` |
| 4.6 | Fix Popover ⓘ (Q4) | Popover avec icône Info pour les tooltips des codecs vidéo. Actuellement ne s'ouvre ni au hover ni au clic. Fix : utiliser shadcn Popover correctement |
| 4.7 | Fix miniatures vidéo (Q5, Q6) | ffmpeg est installé chez l'utilisateur. Vérifier le pipeline de génération de thumbnails vidéo. Si toujours KO, télécharger ffmpeg automatiquement au 1er lancement si non détecté |
| 4.8 | Bouton 4 souris (Q29) | Uniquement dans la visionneuse, pas dans la page import |

## Phase 5 — Sélection des médias (P5)

| ID | Tâche | Détails |
|---|---|---|
| 5.1 | Menu 3 points à gauche du bouton "Tout sélectionner" (point 1) | Déplacer le menu 3 points verticaux pour qu'il apparaisse juste à droite de "Tout sélectionner" dans la même div. Supprimer le texte "Utilisez le menu 3 points à gauche..." |
| 5.2 | Échap pour sortir du mode sélection (point 2) | Quand batch mode actif, Échap déclenche la même fonction que le bouton "Terminer" |
| 5.3 | Checkbox alignée au favori (Q10) | Checkbox passe de `h-5 w-5` à `h-6 w-6` (24×24). Position : `left-1.5 top-1.5` (comme favori qui est à `right-1.5 top-1.5`) |
| 5.4 | Réduire taille checkbox + étoile de 25% à partir de 20 colonnes (ajout Q10) | Si `gridDensity >= 20` : checkbox et étoile passent de `h-6 w-6` (24px) à `h-4.5 w-4.5` (18px). Adapter aussi la taille de l'icône |
| 5.5 | Sélection rubber band (Q11) | Implémenter un rectangle de sélection ("rubber band") qui apparaît pendant le clic-glissé et sélectionne tous les médias qu'il touche. Comme l'explorateur Windows |
| 5.6 | Fix bug sélection multiple "Tout" (déjà fait Round 1) | Vérifier que selectAll fait bien ADD (pas REPLACE) |

## Phase 6 — Menu burger + Dossiers + Tags (P6)

| ID | Tâche | Détails |
|---|---|---|
| 6.1 | Renommer "Groupes" en "Dossiers" (Q19) | Label UI seulement, DB garde le modèle `Group` |
| 6.2 | Menu 3 points par dossier (Q20) | À gauche du compteur de médias. 3 actions : Renommer / Masquer / Supprimer (avec confirmation). "Masquer" = cache du menu burger mais garde en DB |
| 6.3 | Bouton "Gestionnaire de Tags" (Q21) | Dans le nav du menu burger. Ouvre une page dédiée `/tags` qui liste tous les tags avec : nom, catégorie, postCount, actions (renommer, supprimer, masquer, changer catégorie) |
| 6.4 | Déplacer "Paramètres" dans le nav (Q22) | Bouton "Paramètres" devient le dernier item du `<nav>`. Style harmonisé avec les autres boutons. Reste inactif pour l'instant (placeholder) |
| 6.5 | Sidebar tags dans `/groups/[id]` (ajout Q19) | Quand on est dans un dossier, la sidebar tags doit être visible et fonctionnelle (recherche tags à l'intérieur du dossier) |
| 6.6 | Gestionnaire de dossiers (plus tard) | Noter dans worklog : "gestionnaire de dossiers (réafficher dossiers masqués, etc.) = plus tard" |

## Phase 7 — Landing page + Favoris (P7)

| ID | Tâche | Détails |
|---|---|---|
| 7.1 | Supprimer chips de tri dans le header (Q12) | Les chips qui apparaissent dans le header SOUS la barre de recherche (dans `<div class="flex flex-wrap items-center gap-1.5">`) doivent être supprimés |
| 7.2 | Filtres multi-sélection (Q13) | Le segmented control (Tout/Images/Vidéos/Audio/Documents) doit permettre la multi-sélection (ex: Images + Vidéos + Documents) |
| 7.3 | Supprimer chips des filtres (Q13) | Les filtres type:image etc. ne doivent pas s'afficher comme chips. Le segmented control suffit |
| 7.4 | Tri gardé en mémoire (Q14) | Le tri (Récents/Anciens/Taille/etc.) doit être stocké dans localStorage et restauré après visionneuse |
| 7.5 | Fix bug %3F dans URL + perf (Q15) | Le `router.replace` ajoute `%3F` dans l'URL. Fix ça. Implémenter une vraie virtualisation (rendre seulement les thumbs visibles + buffer 2-3 rows, démonter hors viewport) pour supporter 300+ images sans lag |
| 7.6 | Supprimer barre de recherche du header (Q16) | Garder la barre de recherche de la sidebar, supprimer celle du header. Le logo prend sa place |
| 7.7 | Favoris comme table dédiée (Q17) | Créer modèle `Favorite` (many-to-many Media ↔ User) au lieu d'utiliser le tag "favorite". Schema DB + migration + API + UI |
| 7.8 | Fix favoris update temps réel (Q18) | Favori toggle depuis visionneuse → étoile sur thumb landing se met à jour en temps réel (CustomEvent + router.refresh) |
| 7.9 | Bouton 4 souris = Échap conditionnel (déjà P1.3) | Reporté |

## Phase 8 — Nettoyage des noms de divs (P8 — après test utilisateur)

| ID | Tâche | Détails |
|---|---|---|
| 8.1 | Extraire composants répétitifs | Remplacer les `<div class="rounded-lg border...">` par des composants nommés (`<Card>`, `<Button>`, etc.) |
| 8.2 | Ajouter classNames sémantiques | `<div className="media-grid">` au lieu de juste `<div>` |
| 8.3 | Commentaires de section dans le code | Documenter chaque section |
| 8.4 | Repasser plusieurs fois sur le travail | Être extrêmement consciencieux, vérifier cohérence |

## Notes techniques

### À reporter dans le worklog (modifications importantes pour Tauri)
- **Suppression vraie en background** (Q7) : la solution intermédiaire (cleanup au redémarrage) sera remplacée par un vrai worker en background avec Tauri
- **Zoom custom sur vidéos** (Q28) : actuellement `<video controls>` natif. Zoom custom wikifeet sur vidéos = Tauri plus tard (besoin d'un lecteur vidéo custom)
- **Gestionnaire de dossiers** (Q20) : réafficher dossiers masqués + autres options avancées = plus tard
- **Bouton "Explorer"** : ouverture dans l'explorateur de fichiers = Tauri seulement (impossible en webapp)

### Stack technique confirmée
- **ffmpeg** (pas HandBrakeCLI) pour transcodage vidéo + thumbnails
- **@tanstack/react-virtual** ou implémentation manuelle pour la vraie virtualisation
- **shadcn Popover** pour les tooltips ⓘ
- **shadcn AlertDialog** pour les confirmations de suppression
- **Promise.all batch 10** pour la suppression parallélisée

### Ordre d'exécution
1. P1 (bugs critiques) — je le fais moi-même
2. P2 (zoom wikifeet) — subagent dédié
3. P3 (suppression) — subagent dédié
4. P4 (import) — subagent dédié
5. P5 (sélection) — subagent dédié
6. P6 (burger + dossiers + tags) — subagent dédié
7. P7 (landing + favoris) — subagent dédié
8. P8 (nettoyage) — après test utilisateur
