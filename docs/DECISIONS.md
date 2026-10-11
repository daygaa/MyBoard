# MyBoard — Journal des décisions

> Chaque choix d'architecture important, **pourquoi** il a été fait, et ce qu'il implique.
> On ajoute en bas, on ne réécrit pas l'histoire : une décision remplacée est marquée
> « remplacée par D-0XX ».

---

## D-001 — Réécriture complète, sans reprendre le code GLM (11/10/2026)

**Contexte.** La v8 (Next.js + Prisma, écrite par GLM 5.2) fonctionnait pour ~300 images mais
accumulait des défauts de fond : détection de ffmpeg écrite pour Linux, compteurs de tags
corrompus par des écritures concurrentes, deux systèmes de favoris, envoi des fichiers locaux
par HTTP à un serveur local, erreurs de code ignorées, fichiers de 900 à 1 300 lignes,
duplication de composants, suivi arrêté après la v5.

**Décision.** Nouvelle base. On récupère le **savoir** (cahier des charges, comportements
validés, algorithme du zoom, réglages vidéo, syntaxe de recherche, apparence), pas le code.
L'ancien code reste consultable dans `Versions historiques/` et sur la branche Git `old_GLM`.

## D-002 — Tauri 2 : cerveau en Rust, interface web (11/10/2026)

**Pourquoi.** Une application locale n'a pas besoin de serveur web. Avec Tauri, le travail
lourd (lecture des fichiers, empreintes, miniatures, base de données, ffmpeg) est fait en Rust,
nativement, et l'interface est affichée par WebView2 (le moteur d'Edge, déjà présent sous
Windows). Résultat : un `.exe` léger, accès direct aux fichiers (pas d'envoi par HTTP),
boutons « ouvrir dans l'explorateur », tâches de fond qui survivent à la fermeture,
comportement identique quel que soit le navigateur de l'utilisateur.

**Écarté.** Electron (≈150 Mo, plus gourmand) ; interface 100 % Rust (egui/Iced/Slint :
lecture vidéo, menus et styles bien plus coûteux à réaliser, gain de vitesse négligeable).

## D-003 — Interface : React + TypeScript + Vite + Tailwind + shadcn/ui (11/10/2026)

**Pourquoi.** Permet de reproduire **à l'identique l'apparence de la v8** que l'utilisateur
apprécie (mêmes classes Tailwind, mêmes composants shadcn, icônes Lucide, police Geist
embarquée). Pas de Next.js : il n'y a pas de serveur dans une app Tauri.

## D-004 — Référencement des médias sur place (11/10/2026)

**Pourquoi.** Avec 100 000+ fichiers dont des vidéos, copier tout dans une bibliothèque
doublerait l'espace disque. L'application indexe les fichiers là où ils sont.
Le mode « bibliothèque gérée » (copie dans des sous-dossiers par hash) deviendra une option
dans les paramètres (SPEC LIB-02).

**Conséquences à traiter** : fichiers déplacés hors de l'app (Q-01), conversion à l'import
(Q-03), sens du bouton Supprimer (Q-04).

## D-005 — Base SQLite gérée par le backend Rust, compteurs fiables par construction (11/10/2026)

**Pourquoi.** La corruption des compteurs « nombre de médias par tag » venait de mises à jour
faites « à la main » par plusieurs requêtes simultanées. Désormais : les compteurs sont tenus
par la base elle-même (déclencheurs SQL) ou calculés ; toute opération multiple (suppression
de 300 médias, ajout de tags en lot) se fait dans **une seule transaction** — rapide et
tout-ou-rien.

## D-006 — Catégories de tags stockées en base (11/10/2026)

Les catégories (nom, couleur, ordre) sont des données, pas du code : on démarre avec
Safebooru (général, artiste, personnage, copyright, méta) + personnes, date, lieu, et le
gestionnaire de tags pourra en créer d'autres plus tard.

## D-007 — ffmpeg fourni avec l'application (11/10/2026)

ffmpeg est embarqué dans l'application : il ne peut plus être « introuvable », quelle que
soit l'installation de l'utilisateur. Calendrier précisé par D-012.

## D-008 — Principes de performance de la grille (11/10/2026)

- Seules les vignettes **visibles** (plus une petite marge) existent dans la page (virtualisation).
- Miniatures de la **bonne taille** pour la densité affichée, format compact.
- Aucun effet coûteux répété sur chaque vignette (flou d'arrière-plan, ombres animées…).
- Cocher une vignette ne redessine **que cette vignette**.
- Changer de densité ne recharge rien : c'est un calcul d'affichage.
- Chaque phase est mesurée sur une bibliothèque de test de 10 000 à 100 000 médias **avant**
  de passer à la suivante.

## D-009 — Organisation Git et sauvegardes (11/10/2026)

- Dépôt **public** `daygaa/MyBoard`. Branche `old_GLM` = tout l'historique GLM (v3 → v8).
  Branche `main` = la réécriture, repartie d'un historique vide.
- Un commit par tâche livrée ; jamais de médias, de base ni de secrets dans Git (`.gitignore`).
- Après chaque tâche livrée pour test : sauvegarde complète du Workspace dans
  `Backups/vX` (sans les dossiers régénérables `node_modules`, `target`, `dist`)
  via `Clean Claude Code Version/backup.ps1`.

## D-010 — Plan par phases (11/10/2026)

0. Fondations : règles, cahier des charges, outils (cette étape).
1. Socle : base de données, import d'un dossier (référencement), grille virtualisée,
   miniatures — **test de fluidité à 10k–100k médias**. Contenu détaillé validé le 11/10 :
   - projet Tauri + React avec l'apparence de la v8 (en-tête, barre latérale, grille) ;
   - schéma complet de la base, compteurs de tags tenus par la base ;
   - import d'un dossier sur place (sélecteur Windows, sous-dossiers, doublons, progression) ;
   - petites miniatures en arrière-plan, images et vidéos (D-011, D-012) ;
   - grille 4–30 colonnes, pagination adaptée à la densité, filtres par type, tri ;
   - mesure de fluidité chiffrée sur 10 000 à 100 000 médias avant livraison.
2. Visionneuse (zoom wikifeet), tags, recherche, barre latérale.
3. Favoris, dossiers, gestionnaire de tags, sélection, suppression.
4. Options d'import (conversion, compression).
5. et après : doublons, paramètres, scanner, IA…

Chaque phase : livraison → test par l'utilisateur → retours numérotés → corrections → sauvegarde.

## D-011 — Miniatures hybrides : petites d'avance, grandes à la demande (11/10/2026)

**Contexte.** L'utilisateur se demandait s'il fallait vraiment stocker une miniature par
média. Coût réel : ~10–20 Ko par miniature WebP, soit ~1 à 2 Go pour 100 000 médias
(< 1 % de la taille des médias). Tout générer à la demande obligerait à relire et décoder
l'original (30–100 ms par photo, 200–500 ms par vidéo, plus lent sur HDD) : plusieurs
secondes de cases vides à chaque page de 500 vignettes. Un effacement « après X jours »
ferait repayer cette attente en revenant sur d'anciennes photos.

**Décision (validée par l'utilisateur).**
- Petites miniatures (~320 px, WebP) générées **en arrière-plan après l'import**, sur le SSD.
- Grands aperçus (~640 px) pour 4–6 colonnes **à la demande** : la petite miniature
  s'affiche tout de suite puis est remplacée ; demande seulement après ~150 ms de
  visibilité ; annulation des demandes hors écran ; travail en arrière-plan côté Rust.
- Cache des grands aperçus de taille limitée (suppression des moins récemment utilisés).
- Plus tard : réglages du cache dans les paramètres (SPEC LIB-11).

## D-012 — ffmpeg : celui du PC pendant le développement, embarqué en version finale (11/10/2026)

Pendant le développement, l'application utilise le ffmpeg déjà installé sur le PC de
l'utilisateur, **détecté de façon fiable sous Windows** (c'était la cause du bug
« ffmpeg introuvable » de la v8 : une commande Linux). Le binaire ffmpeg sera embarqué dans
l'application finale (D-007) ; son téléchargement se fera avec l'accord de l'utilisateur.

## D-013 — Choix techniques de la phase 1 (11/10/2026)

**Données de l'application.** Base `myboard.db` et miniatures `thumbs.db` (D-014) dans
`%LOCALAPPDATA%\MyBoard` (disque système = SSD, LIB-07). Copier ce dossier, application
fermée, suffit à tout sauvegarder (LIB-08). La variable `MYBOARD_DATA_DIR` permet d'ouvrir
une autre bibliothèque (tests, mesures) sans toucher à la vraie.

**Import.**
- Empreinte BLAKE3 du contenu complet (LIB-03) : plusieurs fois plus rapide que SHA-256 ;
  c'est la lecture du disque qui limite, pas le calcul.
- Un fichier déjà indexé (même chemin, même taille, même date de modification) n'est pas
  relu : relancer l'import d'un dossier déjà importé est quasi instantané.
- Fichiers lus un par un (adapté au disque dur) ; la lecture parallèle sur SSD (IMP-06) sera
  ajoutée si les mesures sur de vrais dossiers la justifient.
- Enregistrement en base par lots de 200 fichiers (une transaction par lot, D-005).
- L'état de l'import est tenu par le cœur Rust : quitter la page d'import ne l'interrompt pas.

**Miniatures.**
- Recadrées au centre en **carré 320 × 320** : c'est exactement ce que montre la vignette
  carrée de la grille ; moins de pixels à décoder = grille plus fluide à 30 colonnes.
  Une image plus petite n'est jamais agrandie. Rotation EXIF appliquée.
- Vidéos : image prise à **10 % de la durée** (la v8 prenait la première image, souvent noire).
- Images que Rust ne sait pas lire (AVIF, HEIC…) : passées à ffmpeg.
- Fils de travail et ffmpeg en **priorité basse**, sans fenêtre console : l'interface reste
  fluide pendant la génération. La page affichée passe en premier, puis les plus récents.
- Rangement et service des miniatures : voir D-014.

**Grille.**
- Changer de densité redessine immédiatement les colonnes (simple calcul, D-008) ; le nombre
  de médias par page (GRID-05) s'adapte 250 ms après le dernier cran de molette, en gardant à
  l'écran la page qui contient le premier média affiché (la v8 revenait à la page 1).
- En-tête, menu et badges : fond opaque au lieu du flou d'arrière-plan (D-008).

## D-014 — Miniatures dans un seul fichier, servies par le protocole `thumb://` (11/10/2026)

**Mesures** (bibliothèque de test de 100 000 médias, écran 2560×1377, version compilée) :
- Sous Windows, la **première** ouverture d'un fichier par MyBoard (programme non signé)
  coûte ~7,7 ms : c'est l'analyse antivirus en temps réel. 475 miniatures rangées en fichiers
  séparés : **3,6 s** la première fois (75 ms ensuite). Rangées dans un seul gros fichier :
  **17 ms**, dès la première fois.
- Pour livrer les miniatures à la fenêtre, comparaison dans la même version :
  protocole Tauri `thumb://` ≈ **400 ms** pour une page de 500 vignettes (30 colonnes),
  ≈ 115 ms pour 223 vignettes (14 colonnes) ; petit serveur HTTP local ≈ **1 100 ms** et
  ≈ 140 ms (le moteur WebView2 le gère mal, alors que le serveur seul répond en ~60 ms).

**Décision.**
- Toutes les petites miniatures sont rangées dans **`thumbs.db`** (une base SQLite à part,
  à côté de `myboard.db`) : plus d'analyse antivirus fichier par fichier, sauvegarde et copie
  bien plus rapides (1 fichier au lieu de 100 000). ~1,75 Go pour 95 000 miniatures.
- Elles sont servies par le protocole `thumb://` (lecture hors du fil principal).
- Si `thumbs.db` est supprimé, toutes les miniatures sont recréées au lancement suivant.

**Piste proposée** : une troisième taille, plus petite (~128 px), pour les densités élevées :
décodage 2,3 fois plus rapide (145 ms → 62 ms pour 500 images). Acceptée → D-015.

## D-015 — Trois tailles de miniatures et grands aperçus, dès la phase 1 (12/10/2026)

Décidé avec l'utilisateur après son test de la phase 1 (LIB-09, LIB-10, LIB-12 avancés en
phase 1). Toutes rangées dans `thumbs.db` (D-014) :

| Taille | Quand | Création |
|---|---|---|
| 128 px | grilles de **16 colonnes et plus** | en même temps que la 320 px, après l'import |
| 320 px | de 7 à 15 colonnes | après l'import (D-011) |
| 640 px (grand aperçu) | de **4 à 6 colonnes** | à la demande |

- Les 128 et 320 px viennent d'un seul décodage de l'original. Pour une bibliothèque qui
  n'a que des 320 px, les 128 px sont fabriquées au lancement à partir des 320 px, sans
  relire les fichiers originaux.
- Grand aperçu : la miniature 320 px s'affiche tout de suite ; l'aperçu n'est demandé que si
  la vignette reste visible **150 ms**, la demande est annulée si elle sort de l'écran avant,
  et il apparaît en fondu par-dessus une fois prêt. Deux fils de travail en priorité basse.
- Cache des grands aperçus limité à **1 Go** ; au-delà, les moins récemment demandés sont
  supprimés jusqu'à 90 % de la limite. Réglages du cache : plus tard (LIB-11).
