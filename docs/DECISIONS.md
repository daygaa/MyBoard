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
