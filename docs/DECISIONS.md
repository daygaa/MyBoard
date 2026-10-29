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

## D-016 — Cadrage de la phase 2 : visionneuse, tags, recherche (12/10/2026)

Réponses de l'utilisateur aux questions posées avant de coder.

**Catégories (TAGM-03, Q-05).** Ordre « personnelles en premier » : Personnes, Lieu, Date,
Copyright, Personnage, Artiste, Général, Méta. Couleurs « convention booru » (artiste rouge,
copyright violet, personnage vert, général bleu ciel, méta orange) : le jaune « méta » de la v8
se confondait avec le doré des boutons actifs. Plus tard : ordre au choix dans les paramètres
(SET-07).

**Vidéos.** La visionneuse lit le **fichier original**, servi par un protocole interne limité
aux médias de la bibliothèque, avec lecture partielle (« requêtes Range ») : avancer à la
40e minute d'une vidéo de 4 Go est immédiat. WebView2 lit H.264, VP8, VP9 et AV1 ; le HEVC
(65 % des vidéos de l'échantillon, format des iPhone) seulement si l'extension Microsoft
« Extensions vidéo HEVC » est installée — vérifié le 12/10 sur le PC de l'utilisateur après
installation : HEVC et HEVC 10 bits décodés par la carte graphique.
- Écarté : embarquer l'extension (produit Microsoft payant, redistribution interdite) ;
  embarquer un autre lecteur (mpv, VLC : image vidéo dans une fenêtre à part, boutons et zoom
  vidéo ZOOM-08 très difficiles, +30–60 Mo, contraintes de licence).
- Retenu : conversion à la volée en H.264 par ffmpeg pour ce que WebView2 ne lit pas
  (VIEW-25), en **phase 4** car elle partage ses briques avec les conversions d'import
  (encodeur de la carte graphique, réglages de qualité). Mesuré : 20 s de vidéo 4K 60 i/s HEVC
  10 bits converties en 1080p en 13 s avec NVENC (GTX 1060), 53 s sans la carte graphique.
- Lecture comme la v8 : automatique, en boucle, avec le son ; bouton pour couper la boucle
  (VIEW-26), réglage par défaut plus tard (SET-08).

**Choix par défaut validés.**
1. Noms de tags en minuscules (« Paris » → « paris ») : pas de doublons Paris / paris.
2. Tags affichés avec des espaces (« long hair »), tapés et enregistrés avec « _ » (SRCH-05).
3. Autocomplétion : tags qui commencent par le texte, puis ceux qui le contiennent ;
   10 suggestions au plus, les plus utilisés d'abord, avec couleur et nombre de médias.
4. Barre latérale : dans chaque catégorie, tags les plus utilisés en haut.
5. Recherche non mémorisée au redémarrage, conservée en revenant de la visionneuse.
6. Visionneuse : la miniature s'affiche tout de suite, l'original net la remplace ; médias
   précédent et suivant préchargés.
7. Vidéos : voir ci-dessus.
8. Images que WebView2 n'affiche pas (TIFF, HEIC) : converties par ffmpeg en pleine
   résolution à l'ouverture.
9. Audio : petit lecteur ; PDF : lecteur intégré de WebView2 ; Word / Excel / PowerPoint :
   grande icône et nom (+ « Ouvrir avec l'application par défaut », VIEW-24).
10. Boutons Favori, Dossier, Supprimer de la visionneuse : visibles mais grisés « bientôt »
    jusqu'à la phase 3.

**Tags par défaut à l'import (IMP-30, IMP-31) avancés en phase 2** : même champ avec
autocomplétion que la visionneuse et la barre latérale (un seul composant). Les tags vont à
tous les fichiers de l'import, y compris ceux déjà présents dans la bibliothèque.

**Données de test.**
- Banque « grandeur nature » (DEV-03) prise sur **Danbooru** plutôt que Safebooru : chaque
  média y arrive avec ses tags déjà rangés par catégorie (Safebooru demanderait une requête
  par tag, ~10 000 pour 3 000 images) et Danbooru propose 41 000 vidéos tout public, contre
  69 « vidéos » (surtout des GIF) sur Safebooru. Un JSON par média, à côté du fichier : champ
  `tags` au format Safebooru (lu par DEV-01) + tags rangés par catégorie.
- Générateur 100 000 médias (DEV-04) : tags tirés d'une banque de mots, répartition
  très inégale comme dans la réalité, pour mesurer la recherche et la barre latérale.
- Fenêtre des tests sur l'écran 1920×1080 à 60 Hz (DEV-05) : la fluidité y plafonne à
  60 images/s, on mesure donc les images ratées ; l'ancienne mesure reste disponible.

## D-017 — Corrections après le test de la phase 2 (T2) (13/10/2026)

Réponses de l'utilisateur au fichier « Précisions - problèmes 2.txt » et à mes questions.

- **Bouton 4 (VIEW-27)** : après la fermeture de la visionneuse, il la rouvre sur la dernière
  image vue, une seule fois et seulement si rien n'a changé depuis (page, filtres, tri, recherche,
  densité, page de l'application) ; refermée, le bouton 4 suivant fait le retour arrière normal.
- **Badge du zoom (ZOOM-09)** : pourcentage de la taille réelle (100 % = un pixel du média pour
  un pixel de l'écran). Plus tard : préférence « toujours afficher en taille réelle » (SET-09).
- **Lecteur vidéo personnalisé (VIEW-29) et zoom des vidéos (ZOOM-08)** avancés en phase 2 :
  commandes dessinées par MyBoard (celles de WebView2 sont masquées), même moteur de zoom que les
  images ; clic sur la vidéo = lecture / pause ; Échap dézoome d'abord. Image par image avec les
  touches `, ?` (reculer) et `; .` (avancer) du clavier AZERTY, au pas réel de la vidéo mesuré
  pendant la lecture (1/30 s par défaut).
- **Impression (VIEW-17)** : le média seul est imprimé, par une feuille de style d'impression
  qui cache toute la page ; marges de page à zéro pour que le navigateur n'ajoute ni date ni
  titre ; l'image reste en place tant que la visionneuse est ouverte (la fenêtre d'impression
  redessine la page quand on change l'orientation). Images seulement (les PDF ont leur propre
  bouton d'impression dans le lecteur intégré).
- **Plein écran total (VIEW-18)** : plein écran de la fenêtre (barre des tâches masquée) ; la
  barre du bas — et, pour une vidéo, ses commandes — n'apparaît qu'au survol ; croix, Échap et
  bouton 4 quittent d'abord le plein écran.
- **Notes (VIEW-19)** : colonne `notes` dans `media` (schéma v3) ; liens ouverts dans le
  navigateur uniquement s'ils commencent par http(s) — une note ne peut jamais lancer un programme.
- **Erreurs d'ouverture (VIEW-28)** : le cœur Rust renvoie le code d'erreur Windows et le message
  de Windows ; l'interface ajoute une explication en clair pour les codes courants.
- **VIEW-16** abandonné (doublon de VIEW-24). **Bibliothèques de test** déplacées dans un dossier
  visible par l'utilisateur (DEV-06) : `%LOCALAPPDATA%` est redirigé en secret pour les commandes
  lancées par l'application Claude (application du Microsoft Store).

## D-018 — Plein écran, copie, raccourcis, vignettes denses (13/10/2026)

Choix faits avec l'utilisateur pendant les derniers retours de la phase 2.

- **Plein écran à la même place sur l'écran (VIEW-32, VIEW-18)** : en plein écran, les commandes
  flottantes remontent de la hauteur de la barre des tâches, lue dans la zone de travail de
  l'écran (`currentMonitor().workArea` de Tauri). Fenêtre non agrandie : placement comme si elle
  l'était.
- **Saccade de la bascule (VIEW-34) → NAV-04** : mesurée en filmant l'écran (Desktop Duplication,
  60 i/s). Windows retire / remet sa barre de titre, le haut de la zone de dessin se déplace de 23
  à 31 px, et WebView2 met 3 à 5 images à redessiner : Windows montre l'ancienne image décalée.
  Sans barre de titre Windows, le haut ne bouge plus ; mais le plein écran de Tauri ne couvre alors
  plus la barre des tâches (fenêtre agrandie restée à 1040 px) : NAV-04 devra gérer son propre
  plein écran. Écarté : masquer les boutons pendant la bascule (choix de l'utilisateur).
- **Copier (VIEW-35)** : le fichier est mis dans le presse-papiers au format de l'Explorateur
  (liste de fichiers `CF_HDROP` + « Preferred DropEffect » = copie), après avoir vidé le
  presse-papiers ; petite bibliothèque Rust `clipboard-win`. Ctrl+C garde son rôle habituel
  pendant une saisie ou si du texte est sélectionné.
- **Raccourcis (VIEW-36)** : Copier Ctrl+C, Favoris L, Dossier D, Explorer E, Ouvrir avec O,
  Imprimer I, Supprimer Suppr. F reste le plein écran (convention des lecteurs vidéo), d'où L
  (comme l'app Photos de Windows). Réunis dans `src/lib/shortcuts.ts` pour SET-10.
- **Vignettes denses (GRID-10)** : badges et infos dessinés comme sur une vignette de 150 px (nom
  courant + badge durée = 147 px, mesuré) puis réduits **selon la largeur réelle de la vignette**
  (choix de l'utilisateur : la même règle convient au 1080p et au 1440p). Réduction par
  transformation : avec `zoom`, changer de densité de 20 à 30 colonnes passait de 1,05 s à 1,47 s.
  Les infos du survol ne sont plus dessinées hors survol (`visibility: hidden`) : 1,05 s au lieu
  de 1,20 s pour ce même changement. Reste, mesuré avec `bench-grid` : changer de densité ≈ +15 %
  aux fortes densités (≈ +12 ms par cran) ; pages et défilement inchangés. La réduction de 25 %
  prévue par SEL-05 est remplacée par cette règle.

## D-019 — Vignettes « nom seul » selon leur taille réelle à l'écran (13/10/2026)

**Constat.** L'utilisateur voulait l'étape GRID-11 à partir de 18 colonnes sur son écran 24"
1080p et de 22 colonnes sur son 27" 1440p. En pixels, ces seuils ne correspondent à rien de
commun (vignette de 80 px contre 93 px) ; en taille réelle, si : Windows donne une densité réelle
de 93 points par pouce pour le premier et 108 pour le second, soit **≈ 2,2 cm** de large dans les
deux cas (17 et 21 colonnes : 2,32 et 2,30 cm).

**Décision (choix de l'utilisateur).** Mode « nom seul » quand la vignette fait moins de
0,88 pouce (≈ 2,2 cm) à l'écran. Le cœur Rust lit la densité réelle de l'écran de la fenêtre
(`GetDpiForMonitor`, densité « brute » tirée de l'EDID de l'écran) ; l'interface la divise par la
mise à l'échelle de Windows, et la relit quand la fenêtre change d'écran. Écran qui ne donne pas
sa taille : 96 points par pouce. Un écran 4K s'adapte seul (27" ≈ 22 colonnes, 32" ≈ 26).

**Nom agrandi.** Une seule ligne, taille calculée au survol pour la seule vignette survolée
(mesure du texte) : aussi grand que possible dans toute la largeur, jusqu'à la hauteur libérée
par la ligne poids / dimensions ; jamais plus petit que la taille normale, sinon « … ».

## D-020 — Barre de titre MyBoard et plein écran sans saccade (NAV-04, VIEW-34) (13/10/2026)

**Choix de l'utilisateur.** Barre fine (32 px) au-dessus de l'en-tête, titre « MyBoard » seul,
flèches grisées quand elles ne feraient rien, Fermer rouge au survol (convention Windows).

**Fenêtre.** Barre de titre de Windows retirée (`decorations: false`). Déplacement, double-clic,
aimantation aux bords, redimensionnement, réduire / agrandir / fermer : fournis par Tauri
(`data-tauri-drag-region="deep"` sur toute la barre, boutons exclus). Le menu système de Windows
(clic droit sur la barre) n'existe plus : GEN-12.

**Défilement.** La fenêtre ne défile plus ; une zone sous la barre de titre (`#defilement`) porte
le défilement (grille virtualisée sur cette zone), sinon la barre de défilement de la page
montait jusqu'en haut, à côté du bouton Fermer. Elle a le focus au démarrage : le clavier
(Page suivante, Espace) la fait défiler.

**Flèches.** Mêmes fonctions que les boutons 4 / 5 de la souris (`goBack`, `goForward` dans
`lib/escape.ts`) ; grisées d'après la pile d'Échap, le chemin de la visionneuse et l'historique de
la fenêtre (API « Navigation » de WebView2).

**Plein écran.** Mesuré en filmant l'écran : retirer puis remettre l'état « agrandie » faisait
sauter l'image en sortant (3 images, ou 11 avec l'animation d'agrandissement de Windows). Retenu :
la fenêtre reste agrandie ; le calcul de sa zone de dessin (`WM_NCCALCSIZE`) est intercepté (sous-
classement de la fenêtre) : plein écran demandé et fenêtre couvrant l'écran = zone de dessin sur
tout l'écran. Seul le bas de la fenêtre bouge. Côté interface, la mise en page « plein écran »
(barre de titre cachée, barre du bas par-dessus) ne bascule qu'au changement de taille de la
fenêtre (`fullscreenShown`), jamais avant. Résultat filmé : 5 passages sur 6 sans aucun mouvement,
une image décalée de 8 px sur le 6e (avant NAV-04 : 5 images décalées de 23 à 31 px).

## D-021 — Barre du bas dépliable, flèches ancrées, pastilles (VIEW-38, VIEW-39, GEN-14, GEN-15) (13/10/2026)

**Flèches (VIEW-38).** Centrées sur la scène telle qu'elle serait avec une barre du bas d'une
seule ligne de tags (hauteur mesurée barre repliée), et non plus sur la scène réelle : elles ne
bougent plus d'un média à l'autre. En plein écran : centre de l'écran.

**Barre du bas (VIEW-39).** `BottomPanel` (mesures ; états replié / déplié / en repli) et
`TagsArea` (tags et bouton « Afficher plus »). La place réservée sous la scène reste celle de la
barre repliée (3 lignes au plus) ; dépliée, la barre passe par-dessus le média (moitié de la
visionneuse au plus, puis défilement). Les commandes flottantes reçoivent `lift` (contexte
`ViewerChrome`) et glissent par `transform` en 200 ms, au rythme de la hauteur de la barre
(`max-height`), pour bouger ensemble. Avec 2 ou 3 lignes, la barre pousse le média (choix de
l'utilisateur).

**Bouton plein écran rangé (VIEW-39, précision).** S'il monterait à moins de 8 px de la flèche
droite, il se range à 16 px à sa gauche, centré sur elle, et la suit si elle monte : le croquis de
l'utilisateur le place à gauche (son message disait « à droite », mais la flèche touche le bord
droit de la fenêtre). Rien à ranger s'il n'y a pas de flèche droite (dernier média).

**Pastilles (GEN-14, GEN-15).** Croix avant le texte dans le composant partagé `TagPill`
(visionneuse, barre latérale, page Importer). Texte remonté de 2 px : mesuré au pixel, les
lettres sans jambage sont à 1 px du haut et du bas de la croix.

## D-022 — Barre du bas stable, ouverture, recherches sur le plein écran (VIEW-39 à VIEW-41, VIEW-34) (14/10/2026)

**Pixels entiers (VIEW-39).** Les positions calculées des flèches et de la barre dépliée sont
arrondies : à un demi-pixel, Chrome calait la flèche sur un pixel entier mais pas le bouton rond
voisin (bord flou, 3 px d'écart en haut et 4 en bas, mesuré).

**Tags lus d'avance (VIEW-40).** Les infos des médias voisins (tags…) sont lues en même temps
que leurs images sont préchargées (`usePreload`, même cache que la visionneuse). Si les tags ne
sont pas encore là (navigation très rapide), la zone des tags garde la hauteur qu'elle avait,
barre repliée, au lieu de rétrécir à une ligne. Première ouverture laissée telle quelle (choix
de l'utilisateur).

**Ouverture (VIEW-41).** L'effet d'apparition (fondu + zoom de 98 à 100 %) ne porte plus que sur
un cadre autour du média, qui n'est pas recréé d'un média à l'autre ; le fond noir, la barre du
bas et les boutons sont affichés tout de suite.

**Plein écran (VIEW-34), constats mesurés.** Windows impose le débordement de 8 px aux fenêtres
agrandies qui ont le style « barre de titre » (`WS_CAPTION`, que Tauri garde sans barre
visible), même après une demande de position explicite ; sans ce style (ou sans l'une de ses
deux moitiés), le débordement disparaît mais Windows ne joue plus ses animations (réduire,
rétablir, agrandir). Tauri n'ajoute aucune ombre en plein écran : la ligne de 2 px est la
bordure de Windows sur la partie qui déborde. Tauri change le style ~70 ms avant la taille en
entrant en plein écran. 4 versions comparées dans `Backups/v16` ; choix de l'utilisateur en
attente.

## D-023 — Plein écran Mix_test, commandes ancrées, barre dépliée, bord haut (VIEW-34, VIEW-42, VIEW-43, NAV-05) (14/10/2026)

**Plein écran (VIEW-34).** Choix de l'utilisateur après comparaison des 4 versions de
`Backups/v16` : Mix_test. Les animations de Windows ne peuvent pas être recréées (Windows anime
la fenêtre entière, et seulement si elle a le style « barre de titre » ; Tauri ne peut animer que
le contenu). Ajout : en sortant, le style « barre de titre » est remis 400 ms après la bascule,
par un message posté à la fenêtre (`WM_CAPTION_BACK`) ; d'ici là, la fenêtre agrandie n'a pas de
débordement du côté d'un écran voisin. Remis tout de suite, Windows reposait ce débordement au
milieu de la bascule et le peignait en noir le temps d'une image. Essayé sans effet : couper les
transitions de Windows pendant la bascule (`DWMWA_TRANSITIONS_FORCEDISABLED`).

**Commandes ancrées (VIEW-42).** `BottomPanel` fournit `anchor`, hauteur de la barre repliée la
plus épaisse (une ligne de tags mesurée, + 2 lignes, + la ligne « Afficher plus » de 20 px) ; la
visionneuse pose la barre de lecture et le bouton rond comme si la barre du bas avait cette
hauteur (ou plus, si un message d'erreur l'épaissit), et calcule leur glissement au-delà.

**Barre dépliée en plein écran (VIEW-43).** La règle CSS `focus-within` gardait la barre affichée
tant qu'un bouton cliqué avait le focus ; remplacée par `useTypingIn` (seule une saisie compte).
Une seule variable (`barShown`) décide de l'affichage et du glissement des commandes. Masquage :
au-delà de 60 px au-dessus du bord haut réel de la barre (dépliée comprise) ; apparition : zone du
bas, inchangée.

**Bord haut (NAV-05).** Sur une fenêtre sans barre de titre, Tauri pose une petite fenêtre
invisible sur le bord haut (`TAURI_DRAG_RESIZE_BORDERS`) qui reçoit les clics du bord ; son
double-clic est intercepté (`window_border.rs`) et devient la commande « Agrandir » de Windows.

## D-024 — Menus du clic droit, curseurs, raccourcis du navigateur : base commune (GEN-12 lot 1, GEN-13, GEN-17, GEN-18) (15/10/2026)

**Menu maison (CTX-01).** Un seul menu ouvert à la fois (`lib/contextMenu.ts`), dessiné par
`ContextMenuHost` (`components/ui/context-menu.tsx`) ; un élément ouvre le sien par
`openContextMenu(e, () => entrées)`, entrées calculées au clic droit seulement (rien par vignette,
D-008). Écarté : les menus de Radix (bibliothèque du menu de tri) : ils prennent le focus, donc un
champ de saisie perdait sa sélection et la note sortait du mode écriture ; leurs fermetures ne
suivent pas la demande (un clic ailleurs atteignait l'élément cliqué). Le menu ne prend jamais le
focus : le clavier passe par un écouteur de la fenêtre tant qu'il est au premier plan. Apparence
partagée avec le menu de tri (`MENU_SURFACE`, `MENU_ITEM`, `MENU_ITEM_ACTIVE` de
`dropdown-menu.tsx`). Séparateurs mesurés sur les captures de Firefox de l'utilisateur : trait à
16 px du bord intérieur, 3 px vides de chaque côté.

**Menu et raccourcis du navigateur coupés dans WebView2 lui-même** (`webview_settings.rs`, réglages
que Tauri ne propose pas) : ils valent aussi dans le lecteur PDF de la visionneuse, un cadre que
le code de la page ne voit pas (F5 y rechargeait toute l'application). L'action du navigateur est
retirée touche par touche (Ctrl + R et Ctrl + Maj + R gardés) ; la touche arrive toujours à la
page, qui fait d'Alt + ← / → le précédent / suivant de MyBoard.

**Textes (CTX-03, CTX-18).** Menu d'édition et menu « Copier » ouverts sans rien à faire dans les
composants, pour tous les champs présents et futurs (`lib/textMenus.ts`). « Coller » lit le
presse-papiers par le cœur Rust (`clipboard_text.rs`) : WebView2 demanderait une autorisation à la
page. Une sélection sous le clic droit passe avant le menu de l'élément (choix de l'utilisateur :
petit menu « Copier »).

**Curseurs (GEN-13).** Règles globales (`index.css`) : flèche par défaut (textes compris), main
sur les boutons actifs, « interdit » sur les boutons grisés, barre « I » dans les champs ;
exceptions en flèche : flèches grisées de la barre de titre et de la pagination, boutons de
fenêtre, en-tête de catégorie sans dépliage. Les boutons shadcn grisés ne recevaient plus la
souris (`pointer-events: none`, donc pas de curseur « interdit ») : remplacé, et leur effet de
survol annulé quand ils sont grisés. Attente (`lib/busy.ts`) : ouvertures externes, et page de la
grille pas encore arrivée après 0,3 s (données provisoires seulement : les relectures de fond
pendant un import ne comptent pas).

## D-025 — Menus du clic droit des éléments existants (GEN-12 lot 2, CTX-04 à CTX-12, CTX-19) (15/10/2026)

**Choix de l'utilisateur (15/10).** « Copier le tag » copie la forme enregistrée (`long_hair`) : elle
se colle telle quelle dans une recherche, où « long hair » serait lu comme deux tags. Menu de la
visionneuse sur le média seulement (rien sur le fond autour, comme le fond de la grille). Échec
d'une action lancée hors de la visionneuse : pop-in d'erreur (CTX-19) avec « OK » et « Copier ».

**Une seule source pour les actions.** Copier le fichier, l'explorateur, « Ouvrir avec », copier le
chemin ou le nom : `viewer/mediaActions.ts`, utilisé par la barre du bas, le menu d'une vignette et
ceux de la visionneuse ; un échec passe par `runExternal` : message dans la barre du bas si la
visionneuse est ouverte, sinon pop-in (`ErrorDialog`, même erreur gardée dans `useViewer`). Les
menus eux-mêmes sont des listes d'entrées (`tileMenu.ts`, `tagMenu.ts`, `mediaMenus.ts`) calculées
au clic droit ; ceux de la vidéo reprennent l'état de la barre de lecture à ce moment-là (le son
coupé / rétabli et le libellé de vitesse sont désormais partagés par le store du lecteur).

**Détails.** Texte copié par le cœur Rust (`write_clipboard_text`), comme la lecture pour
« Coller ». Un bouton désactivé ne reçoit plus le clic droit : l'en-tête d'une catégorie sans
dépliage est marqué `aria-disabled` au lieu de `disabled`. Inclure ↔ exclure un terme le laisse à
sa place dans la recherche. Les fonctions du lot 3 (Copier l'image, Zoom, capture, fond d'écran,
Replier complètement) et celles des phases suivantes sont grisées en attendant.

## D-026 — Barre de titre, image, capture, zoom, repli complet (GEN-12 lot 3, CTX-06, CTX-07, CTX-11, CTX-13) (15/10/2026)

**Menu de la fenêtre (CTX-13, option 1).** Menu maison avec les commandes de Windows, envoyées à la
fenêtre telles quelles (`WM_SYSCOMMAND` : animations, Déplacer et Taille au clavier comme dans
Windows) ; entrées grisées selon l'état (agrandie ou non). Alt + Espace : Windows demande son menu
à la fenêtre (`SC_KEYMENU` avec la touche Espace) ; la demande est interceptée (`system_menu.rs`)
et l'interface ouvre le sien sous le coin haut gauche, première entrée choisie. En plein écran, la
barre de titre étant cachée, rien ne s'ouvre. Pas de menu sur les boutons de la barre (CTX-17).

**Copier l'image (CTX-06).** Image décodée comme pour les miniatures (orientation de l'appareil
photo appliquée ; HEIC… par ffmpeg), mise en bitmap (tous les programmes, Paint compris) et, si
elle a de la transparence, aussi en PNG (posée sur du blanc dans le bitmap).

**Fond d'écran (CTX-06).** Réglage de Windows (`SystemParametersInfo`), enregistré. L'original est
donné à Windows s'il est en JPEG, PNG ou BMP et n'est pas à tourner ; sinon une copie convertie
(`fond-ecran.png`, dossier de données de MyBoard) est donnée. Non essayé sur le PC de
l'utilisateur pendant le développement : cela aurait remplacé son fond d'écran.

**Capture d'une vidéo (CTX-07).** L'image au temps affiché au clic droit, extraite par ffmpeg en
pleine résolution (rotation appliquée, JPEG qualité 2) ; numéro de l'image = temps × images par
seconde (lues par ffprobe, 30 si inconnues) ; date du jour fournie par l'interface. Fenêtre
« Enregistrer sous » de Windows (plugin de dialogue, côté Rust, fenêtre MyBoard parente) : rien
n'est écrit si elle est fermée sans enregistrer. Windows l'ouvre dans le dernier dossier utilisé.

**Zoom par paliers (CTX-06, CTX-07).** `useZoom` reçoit `zoomTo` : le point au centre de la scène
y reste, animation du clic ; « Défaut » = ajusté. 100 % grisé quand le défaut est déjà 100 %
(image plus petite que la zone). Le clic sur une petite image reste sans effet (ZOOM-10, à venir).

**Replier complètement (CTX-11).** Trois états par catégorie (10 premiers, tous, aucun), gardés en
changeant de page ; repliée complètement, sa flèche est tournée vers la droite et l'en-tête se
clique même avec 10 tags ou moins.

## D-027 — Recherche par tags : index en mémoire (SRCH-17) (15/10/2026)

**Constat (mesuré).** Recherche en SQL (une sous-requête `IN` par terme, comptage puis page) :
6 à 14 ms à 3 300 médias, mais 0,25 à 1,1 s à 300 000 médias (base synthétique, tags présents
sur 50 à 99 % des médias), refaite à chaque changement de page ; la durée croît avec chaque tag
très utilisé (de façon linéaire). Réécrite « tag le plus rare d'abord » : encore 0,1 à 0,5 s.

**Décision (choix de l'utilisateur).** Index en mémoire (`search.rs`) : l'ensemble des médias de
chaque terme recherché est lu une fois (index `media_tags (tag_id, media_id)`) et gardé sous forme
d'ensemble de bits compressé (crate `roaring`) ; ET, exclusion, types cochés = opérations sur ces
ensembles ; nombre de résultats immédiat. Le dernier résultat est gardé : changer de page ne
recombine rien. Page triée par id (« Récents », « Anciens ») : lue directement dans l'ensemble ;
« Aléatoire » : même formule que la grille, calculée sur les résultats ; autres tris : jusqu'à
5 000 résultats, tri dans la base sur leur liste, au-delà, parcours de l'index du tri en ne
gardant que les résultats (arrêt dès la page remplie). Sans terme de recherche, la grille garde
sa requête SQL.

**Mise à jour automatique.** Compteur `search_generation` (schéma v4) incrémenté par des
déclencheurs à chaque ajout ou retrait d'un lien tag-média ou d'un média (et à un changement de
type), quel que soit le chemin (visionneuse, import, futur gestionnaire de tags) ; s'il a changé,
l'index oublie tout et relit. Écarté : mettre l'index à jour depuis le code à chaque écriture
(un chemin oublié = recherche fausse). L'index a sa propre connexion à la base : une recherche
n'attend plus une écriture faite par l'interface. Au plus 256 ensembles gardés : au-delà, tous sont
oubliés (quelques Mo ; au pire environ 38 Ko par ensemble à 300 000 médias). Mesuré le 15/10 :
5 000 recherches toutes différentes sur 300 000 médias, mémoire de MyBoard stable à 110 Mo dès la
1 000e (72 Mo au départ, cache de la base compris).

**Vérification.** Mêmes résultats que l'ancienne méthode (total, page, ordre des médias) sur des
centaines de recherches tirées au hasard (termes, exclusions, jokers, tags inexistants, types,
tous les tris, pages au-delà de la fin), sur les bibliothèques de test et la base de 300 000.

**Blocage de 3 à 5 s vu par l'utilisateur.** Ancienne méthode + filtre de type coché + 2 tags ou
plus : la base parcourait l'index du type et évaluait chaque sous-requête média par média (2,8 à
5 s à 3 300 médias, 40 s à 100 000). L'index n'utilise plus ces sous-requêtes.

**Tris « date ↑ » et « résolution ↑ ».** Ils mettent les valeurs inconnues en dernier (`IS NULL`
dans le tri) : la base retriait toute la bibliothèque à chaque page (≈ 150 ms à 300 000, avec ou
sans recherche). Deux index sur ces expressions (schéma v4) : moins de 10 ms. Création à la
migration : environ 1 s à 300 000 médias, une seule fois.

## D-028 — Fond de la visionneuse, note, historique des recherches, rayure, petites images (VIEW-44, VIEW-45, NAV-06, SRCH-16, ZOOM-10) (15/10/2026)

**Fond (VIEW-44).** Fond uni, une seule valeur (`--viewer-bg`, `index.css`) : deux versions
compilées comparées (`Backups/v24` : noir #000000, gris très sombre #0d0e12, la teinte la plus
foncée de l'ancien damier) ; choix de l'utilisateur : gris très sombre. Le damier (`.checker`) est gardé pour le choix du fond dans les
préférences (SET-11).

**Historique des recherches (NAV-06).** Chaque recherche ajoute une étape à l'historique de la
fenêtre (`history.pushState`, termes dans l'état de l'étape) ; précédent / suivant (flèches de la
barre de titre, boutons 4 / 5, Alt + ← / →) restaurent les termes de l'étape sans en créer une
nouvelle. L'étape de départ porte « aucune recherche » ; une étape créée par un changement de page
de l'application (Importer) reçoit les termes du moment. Une recherche identique à la précédente
n'ajoute rien.

**Rayure d'un tag exclu (SRCH-16).** La rayure du navigateur est placée par la police (1,5 px au-
dessus du centre de la croix, mesuré) et ne se déplace pas : remplacée par un trait de 1 px dessiné
au centre de la pastille, sur la ligne juste au-dessus du milieu exact (le centre tombe entre deux
lignes de pixels ; la ligne du dessous paraissait 1 px trop basse à l'utilisateur).

**Note (VIEW-45).** Poubelle grisée quand la note est vide ; confirmation partagée avec le menu de
la note (`ConfirmDialog`, aussi utilisée par les menus du clic droit). Un clic dans la pop-in ne
ferme plus la note.

**Petites images (ZOOM-10).** Clic : 200 %, centré sur le point cliqué (comme le passage à 100 %
d'une grande image) ; nouveau clic : retour à 100 %.

## D-029 — Barre de recherche : termes sur une ligne, suggestions par mot (SRCH-18 à SRCH-23) (15/10/2026)

**Place réservée (SRCH-18, SRCH-19).** Sous le champ : la ligne « Tout effacer » (centré, grisé sans
recherche) puis une ligne de pastilles de hauteur fixe, présentes même sans recherche : la liste des
tags ne bouge plus. Les pastilles s'écrivent à la suite comme du texte ; le « +N » flotte à droite de
la 1re ligne seulement, donc les lignes dépliées dessous ont toute la largeur. Le nombre caché est
mesuré avant chaque affichage (une pastille de moins quand le « +N » apparaît) ; une 1re pastille
trop longue est coupée à côté du « +N ». Repliées, les pastilles en trop restent en place mais
invisibles (ni clic ni Tab). Dépliage : même principe que la barre du bas en plein écran (VIEW-18),
mais autour du « +N » (16 px, choix de l'utilisateur) puis autour des pastilles dépliées ; rien ne se
déplie sous la liste des suggestions ou un menu. La marge ne bloque aucun clic : la 1re catégorie de
tags est à 48 px du « +N ».

**Suggestions par mot (SRCH-20, SRCH-21).** Recherche de la barre latérale seulement : le mot en cours
est celui où se trouve le curseur de saisie (il suit les flèches et les clics). Nom choisi : il
remplace ce mot, suivi d'un espace même au milieu du texte (ce qu'on tape ensuite forme un nouveau
mot). + / − : le tag part dans la recherche, le mot est effacé. Visionneuse et import : inchangés (le
texte entier forme un tag, espaces → « _ »).

**Noms longs, survol (SRCH-22, SRCH-23).** Liste à la largeur de son contenu, entre la largeur
d'origine (champ, 14rem au moins) et le double ; au-delà, 2 lignes puis « … ». Élargie, la liste
déborde de la barre latérale sur la grille : la barre latérale passe au-dessus de la grille (`z-20`,
toujours sous l'en-tête, le menu burger et la visionneuse). Survol et choix au clavier (c'est le même
état) : fond #2a2c33 sur la liste #1f2126 (avant : #1f2126, invisible).

## D-030 — Retouches de la recherche, bulles des noms coupés, pop-in de création (SRCH-18, SRCH-22, SRCH-24, VIEW-46) (16/10/2026)

**Dépliage des pastilles (SRCH-18).** La zone d'approche est toute la ligne de pastilles (16 px à gauche,
à droite et en dessous, rien au-dessus : « Tout effacer » ne déplie rien), puis les pastilles
dépliées avec la même marge. Sans recherche, texte gris « Aucun tag dans la recherche » dans la ligne.

**Bulles (SRCH-18, SRCH-22, VIEW-46).** `titleIfCut` (`lib/utils.ts`) : au survol, si le texte est coupé
par « … », sa bulle de Windows (`title`) montre le texte complet ; sinon l'attribut est retiré (un
`title` vide cacherait la bulle d'un parent, comme « Exclut … » d'une pastille). Utilisé par les
suggestions, les pastilles de la recherche (option `fullTitleIfCut` de `TagPill`) et la pop-in.

**Nouvelle recherche (SRCH-24).** Entrée et le bouton remplacent la recherche (`setTerms`) ; les
contraires tapés ensemble (« solo -solo ») suivent la règle de l'ajout : le dernier l'emporte.

**Pop-in de création (VIEW-46).** Nom dans une boîte de la ligne de texte, coupée à 2 lignes (propriétés
`-webkit-line-clamp`, alignée en haut : un nom court reste au pixel près à sa place d'avant). La pop-in
reste centrée puis remonte d'une demi-ligne par ligne de plus que les 2 de la phrase avec un nom
court (option `lift` de `Modal`) : son bas et ses boutons ne bougent pas.

## D-031 — Navigation et liste des suggestions, raccourcis du lecteur vidéo (NAV-07, VIEW-36, VIEW-47) (16/10/2026)

**Liste des suggestions (NAV-07).** Elle reste sur la pile des éléments ouverts (Échap la ferme d'abord,
sans fermer la visionneuse derrière), avec l'option « Échap seulement » : les boutons 4 / 5 de la
souris et les flèches de la barre de titre l'ignorent et agissent sur ce qui est dessous (choix de
l'utilisateur : flèches et boutons font toujours la même chose).

**Raccourcis (VIEW-36, VIEW-47).** Lettres des mots anglais, en vue de la traduction (FUT-08) :
`L` = Loop (boucle des vidéos), donc les favoris passent de `L` à `S` (« Star » : l'icône est une
étoile ; convention de Gmail). Vitesse : `<` et `>` d'un palier (convention de YouTube ; sur AZERTY
une seule touche, Maj pour `>` ; écartés : `[` `]` de VLC, qui demandent AltGr). Tous les raccourcis
sont réunis dans `lib/shortcuts.ts` (personnalisables plus tard, SET-10) et affichés dans les bulles
d'aide et le menu du clic droit. Badge bref (`PlayerBadge`, aspect du badge du zoom) : il ne se cache
pas avec les commandes (souris immobile en plein écran), c'est là qu'il sert.

**Retouches du 16/10 (VIEW-47, VIEW-48).** Badges de vitesse affichés 2 s (les autres 1,2 s). Libellé
de vitesse de la barre de lecture : l'étiquette la plus longue (« 0,75× ») est posée invisible sous
l'étiquette affichée, dans la même case : toutes les vitesses ont sa largeur, la barre ne bouge plus.
Commandes gardées (VIEW-48) : au moment de cacher les commandes (3 s sans mouvement), on regarde ce
qui est sous la souris (`elementFromPoint`, car un menu a pu se fermer sous elle) ; si c'est un des
éléments de `KEEP_SHOWN` (`viewerChrome.ts` : barre de lecture et menu des vitesses, notes, flèches,
croix, barre du bas), rien ne se cache ; le compte à rebours repart au mouvement suivant.

**Menu des vitesses et compte à rebours (VIEW-47, VIEW-49, 16/10).** Le « clic avalé » du menu du
clic droit (CTX-01 : l'appui et le clic qui suit n'atteignent pas l'élément visé) est sorti dans
`lib/swallowClick.ts` et sert aussi au menu des vitesses : un clic sur la vidéo ou le fond gris
(zone `visionneuse.video`) ferme seulement le menu ; ailleurs (boutons, barre du bas), le clic
ferme le menu et agit. Le menu se ferme aussi quand les commandes se cachent. `useIdle` renvoie
`restart` (passé aux éléments par `ViewerChrome.restartIdle`) : les touches de vitesse relancent le
compte à rebours de 3 s seulement si les commandes sont affichées.

## D-032 — Cadrage de la phase 3 : mesures, suppression, favoris, dossiers (17/10/2026)

Réponses de l'utilisateur aux questions posées avant de coder.

**Ordre.** Mesures des miniatures (LIB-15), lot 1 (suppression + favoris), lot 2 (dossiers + menu
burger), puis test par l'utilisateur ; ensuite lot 3 (sélection multiple) et lot 4 (gestionnaire de
tags), dont les questions seront posées à ce moment-là.

**Suppression (Q-04, DEL-04, DEL-05).** Par défaut, le média est retiré de la bibliothèque sans toucher
au fichier ; ses données restent en réserve 1 mois et sont proposées à la restauration si le fichier est
réimporté. Les fichiers ne sont supprimés du disque que si l'utilisateur coche la case de la pop-in puis
confirme une 2e fois ; ils sont alors effacés définitivement, sans la Corbeille de Windows : un fichier
trop gros pour elle déclencherait une confirmation de plus à la fin (choix de l'utilisateur : confirmer
deux fois avant, puis supprimer sans autre question). Principe retenu pour la réserve : les données sont
**rangées à part** (par empreinte du fichier) et les lignes du média réellement supprimées, plutôt que
gardées en place et cachées : les compteurs tenus par la base (D-005) et l'index de recherche (D-027)
restent exacts par construction, sans exception à prévoir dans chaque requête.

**Favoris et dossiers (FAV-04 à 06, FOLD-02, FOLD-07, FOLD-09).** Vue Favoris et page d'un dossier = la
page de la bibliothèque (un seul composant) avec une ligne de titre sous la barre des filtres, qui ne
bouge pas d'un pixel. Tri et filtres communs à toutes les pages, plus un tri par date d'ajout propre à
chaque vue ; recherche vide à l'entrée. Dossier masqué : retiré des listes seulement ; ligne
« Dossiers masqués » provisoire jusqu'au gestionnaire de dossiers (FOLD-05, FOLD-06, phase 5). Couleur
attribuée automatiquement, changeable parmi des couleurs prédéfinies. Liste à cocher (ajouter / retirer)
pour le bouton Dossier de la visionneuse et les menus.

## D-033 — Lot 1 de la phase 3 : suppression, réserve, favoris, vues (17/10/2026)

**Suppression en deux temps (DEL-01 à DEL-03).** La commande marque les médias (`pending_delete` : 1 =
bibliothèque seulement, 2 = fichier aussi) dans une transaction et rend la main (~5 ms pour 300) ; la
grille, la recherche et les statistiques les ignorent aussitôt. Un fil en priorité basse (`deletion.rs`)
efface d'abord les fichiers (sorte 2), puis retire les médias par lots de 500 en une transaction
(déclencheurs : compteurs des tags et des dossiers, génération de la recherche), puis leurs vignette,
miniature 128 px et grand aperçu. Marqués en base, ils sont repris au lancement suivant. Un fichier
impossible à effacer : son média est démarqué (il revient avec ses données) et l'interface reçoit la liste
(`deletion-failed`). Pour ne pas ralentir les pages lointaines (où chaque média sauté serait relu), le
filtre « non marqué » n'est ajouté aux requêtes que s'il existe des médias marqués (index partiel
`media_pending`, presque toujours vide) ; les comptes soustraient les marqués.

**Réserve (DEL-05).** Table `media_reserve` (schéma v5), une ligne par empreinte : tags (nom +
catégorie), date d'ajout aux favoris, dossiers (id + date de création, pour ne jamais confondre avec un
dossier créé plus tard au même numéro) et note, en JSON écrit par la base elle-même au moment de la
suppression. Vidée des lignes de plus de 30 jours au lancement puis toutes les heures. Un média nouveau
d'un import dont l'empreinte est en réserve est proposé à la restauration en fin d'import
(`ImportResult.restorable`) ; la pop-in ne se ferme que par ses boutons (un Échap ne doit pas faire
perdre les données).

**Vues (FAV-02, FOLD-04).** `ListQuery` porte `favorites` / `folder` (`scope.rs`) : jointure sur les
favoris ou les liens du dossier pour la grille sans recherche, ensemble gardé par l'index de recherche
(invalidé par de nouveaux déclencheurs sur `favorites` et `folder_media`), tris d'ajout dans leur vue
seulement (ailleurs : « Récents »). L'adresse (`#/favoris`, `#/dossier/<id>`) fixe la vue ; changer de vue
repart d'une recherche vide et de la page 1, le retour arrière retrouve la recherche d'avant.

**Étoile des vignettes (GRID-08, D-008), mesurée sur 100 000 médias (écran 1920×1080, fenêtre au rythme
de l'écran principal à 180 Hz).** Dessinée dans le calque réduit par transformation (GRID-10), elle
coûtait 15 à 20 % de fluidité au défilement à 20 et 30 colonnes (168 → 140 images/s) : son dessin
vectoriel était refait à une taille fractionnaire. Sortie du calque et réduite par sa propre taille
(`.tile-star`) : 153 à 160 images/s. Reste : changement de densité à 30 colonnes ≈ 900 ms contre ≈ 700 ms
sans étoile (création de 500 boutons de plus). Mesuré aussi : une étoile en caractère de police au lieu de
l'icône Lucide ferait 159 à 169 images/s et ≈ 840 ms ; non retenue sans l'accord de l'utilisateur (règle
« icônes Lucide »), proposée.

## D-034 — Lot 2 de la phase 3 : dossiers (17/10/2026)

**Données.** Tables `folders` et `folder_media` du schéma v1 (compteur tenu par des déclencheurs) ;
`folders.rs` : nom unique sans tenir compte des majuscules (colonne NOCASE), refusé s'il est pris avec un
nom libre proposé (`nom-2`, `nom-3`…) ; couleur suivante de la palette à la création (nombre de dossiers
modulo 8). Chaque média de la grille porte la liste de ses dossiers (`group_concat`, index
`folder_media_media`) : les menus du clic droit, calculés au clic, savent cocher sans demander au cœur Rust.

**Menus.** Le menu ⋮ d'un dossier, sa version du clic droit et la liste à cocher sont des menus maison
(CTX-01). Le menu peut s'ouvrir au-dessus d'un point (`above`) et garder qui l'a ouvert (`owner`) : la
visionneuse garde sa barre du bas affichée tant que la liste ouverte depuis le bouton Dossier est
ouverte, et la ferme quand les commandes se cachent (VIEW-49). Les menus ouverts sont ajoutés à
`KEEP_SHOWN` (VIEW-48). Libellés de menu de plus de 20rem coupés par « … » (noms de dossiers longs).

## D-035 — Taille des miniatures selon la taille réelle des vignettes (LIB-16) (19/10/2026)

Remplace les seuils en colonnes de D-015 (128 px dès 16 colonnes, 640 px de 4 à 6).

**Choix.** La grille calcule la largeur d'une vignette en pixels réels de l'écran (largeur dans la page ×
mise à l'échelle de Windows) et prend la plus petite des tailles 128, 320, 640 et 1 280 px au moins aussi
large, à 5 % près ; au-delà, 1 280 px. 128 et 320 px restent faites à l'import ; 640 et 1 280 px à la
demande, avec les mêmes règles (vignette visible 150 ms, demande annulée si elle sort de l'écran, 320 px
affichée en attendant). La mise à l'échelle est relue quand la fenêtre change d'écran (signal de Windows
`onScaleChanged`, et requête « resolution » de la page) : un écran 4K et un écran 1440p sur le même PC
fonctionnent sans réglage. Hook `useScreen` (densité de GRID-11 et mise à l'échelle, une seule écoute).

**Rangement.** Table `previews_large` dans `thumbs.db`, adresse `l/<hash>.webp` ; le cache des aperçus
(1 Go) compte les deux tailles ensemble et supprime d'abord les moins récemment demandés, quelle que soit
leur taille. Une image plus petite que 1 280 px garde sa taille (jamais agrandie).

**Pas de taille intermédiaire (mesures du 19/10, version compilée, 100 images de la banque Danbooru).**
Fabrication (2 fils) : 640 px 5,9 s, 1 280 px 10,5 s ; poids moyen 43 et 99 Ko ; décodage dans la page :
320 px 198 ms, 640 px 519 ms, 1 280 px 1 354 ms (une seule fois par page, ensuite gardé en mémoire). Le
pire cas, 5K à 200 % et 12 colonnes (vignette de 354 px servie en 640 px), coûte ≈ 0,3 s de décodage de
plus pour la page, en arrière-plan, la 320 px étant déjà affichée ; une taille de plus obligerait à
refaire des aperçus à chaque changement de densité dans cette plage. Page suivante sur l'écran 1080p :
inchangée (15 colonnes 150 ms, 16 colonnes 173 ms, comme en LIB-15).

## D-036 — Cadrage des lots 3 à 5 de la phase 3 : sélection, gestionnaire de tags (19/10/2026)

Réponses de l'utilisateur aux questions posées avant de coder (détail dans la SPEC).

**Sélection (lot 3).** Bouton dans la barre des filtres ; en mode sélection, un clic coche, Maj + clic
coche toute la rangée ; le rectangle ne marche qu'en mode sélection et ajoute à la sélection. **Une seule
sélection**, gardée en changeant de page, de recherche ou de vue, en ouvrant la visionneuse (« Ouvrir » du
clic droit) et après un retour arrière ou avant : elle est rangée dans l'état de l'application (la liste
que lisent les actions), pas dans l'affichage. Le menu du clic droit d'une vignette cochée agit sur toute
la sélection, avec les nombres dans les libellés et un badge après l'ajout à un dossier ; sur une vignette
non cochée, il reste celui de la vignette.

**Gestionnaire de tags (lot 4).** Même esprit que la v8, plus compact, redessiné par Claude ; tri par
colonne, filtres « Masqués » et « Rares », actions groupées, colonne « Créé le », renommage dans la ligne,
tags proches à fusionner, description d'un tag (bouton des notes de la visionneuse), export / import par
un code de partage copié dans le presse-papiers (avec annulation de l'import), suppression des tags non
utilisés avec sélection manuelle.

**Lot 5.** Synonymes et tags parents (inspirés de Hydrus Network) : après le gestionnaire de tags, avant
la phase 4 ; questions posées à ce moment-là.

## D-037 — Lot 3 de la phase 3 : sélection multiple (20/10/2026)

**Où est la sélection.** Dans un magasin de l'interface (`stores/selection.ts`) : un ensemble
d'identifiants modifié sur place et un numéro de version incrémenté à chaque changement. Chaque vignette
lit seulement « suis-je cochée ? » : cocher une vignette ne redessine qu'elle (D-008). La sélection ne
dépend ni de la page, ni de la vue, ni de l'affichage : elle survit à la visionneuse et à l'historique
(SEL-09). Les actions envoient cette liste au cœur Rust ; « Sélectionner tous les résultats » demande au
cœur Rust tous les résultats de la vue (index de recherche, D-027), avec ou sans termes.

**Grandes sélections.** Les identifiants passent à SQLite en un seul texte JSON (`json_each`) au lieu d'un
paramètre par média (limite de 32 766) : compter les favoris et les dossiers d'une sélection, lire ses
tags, ajouter ou retirer des tags en une transaction. Les commandes des favoris et des dossiers renvoient
le nombre de médias réellement ajoutés ou retirés (badges de SEL-08).

**Menus.** Le menu d'une vignette cochée demande d'abord au cœur Rust ce que contient la sélection
(elle peut compter des médias non affichés) puis s'ouvre au point du clic (`openContextMenuAsync`). Le
mode sélection n'est pas sur la pile d'Échap : les boutons 4 / 5 et les flèches de la barre de titre
naviguent normalement ; Échap ne le quitte que si rien d'autre n'est ouvert.

**Rectangle.** Dessiné directement dans la page (style de son élément), sans redessiner la grille ; les
vignettes touchées se calculent par la géométrie régulière de la grille, sans interroger la page.

**Mesuré (version compilée, 30 colonnes, écran 1080p).** Défilement : 173 images/s hors sélection,
164 en mode sélection, 168 avec la page entière cochée ; cocher une vignette : 12 à 47 ms jusqu'à
l'image affichée.

## D-038 — Lot 4 de la phase 3 : gestionnaire de tags (20/10/2026)

**Données (schéma v6).** `tags.description` (TAGM-14) ; table `tag_similar_ignored` (groupes de tags
proches ignorés, TAGM-13) ; déclencheur : renommer un tag change `search_generation` (les recherches
gardées en mémoire par nom ne valent plus, D-027). `tag_manager.rs` : liste, renommer (réponse
« existe déjà » sans rien changer : l'interface propose la fusion), fusionner, catégorie, masquer,
supprimer, description, import, ignorer un groupe ; chaque opération multiple en une transaction, les
compteurs suivent par les déclencheurs (D-005). Les tags masqués sont retirés de la barre latérale par
la requête (`tags_of_media(…, with_hidden)`), gardés dans la fiche de la visionneuse.

**Liste.** Tous les tags sont lus en une fois puis filtrés et triés dans l'interface : mesuré sur
13 098 tags (banque Danbooru), tri par nom en 118 ms, défilement à 144 images/s (liste virtualisée
comme la grille, D-008).

**Code de partage (TAGM-10).** « MYBOARD-TAGS-1: » suivi de la liste en JSON compact
`[nom, clé de catégorie, masqué]`, en base 64 : la catégorie voyage par sa clé (« general »…), les
identifiants changeant d'une bibliothèque à l'autre ; catégorie inconnue → Général. L'import renvoie
les identifiants créés, ce qui permet « Annuler ».

**Tags proches (TAGM-13).** Clé de rapprochement calculée dans l'interface : nom sans accents, sans
« _ », « - », espaces ni points, sans « s » final ; un groupe = au moins deux tags de même clé.

**Notes partagées.** La zone de note de la visionneuse (VIEW-19, VIEW-45, CTX-09, CTX-10) est devenue un
composant commun (`components/notes/NoteEditor.tsx`) : la description d'un tag a exactement les mêmes
fonctions, sans code recopié.

## D-039 — Recherche par nom de fichier (SRCH-26) (20/10/2026)

Le texte cherché fait partie de la recherche, à côté des termes de tags : `file` dans la demande de la
grille (`ListQuery`) et dans chaque étape de l'historique (NAV-06), donc gardé par la visionneuse, le
retour arrière et « Sélectionner tous les résultats ». Le cœur Rust le combine avec les tags dans
l'index de recherche (D-027) : l'ensemble des médias dont le nom contient le texte est calculé une fois
puis gardé, comme celui d'un tag. La comparaison sans majuscules se fait en Rust : `lower()` de SQLite
ignore les lettres accentuées. Mesuré sur 100 000 médias (version compilée) : 40 à 100 ms la première
fois, 3 ms ensuite.

## D-040 — Cadrage du lot 5 de la phase 3 : synonymes et tags parents (20/10/2026)

Réponses de l'utilisateur (détail dans TAGM-15, TAGM-16). **Synonymes = alias** : le tag secondaire est
fusionné dans le principal et ne survit que comme nom de redirection (saisie, import, recherche,
suggestions « A → B ») ; chaque alias peut être désactivé puis réactivé. **Parents rétroactifs** : la
règle s'applique aux médias déjà tagués puis à chaque ajout, en chaîne ; le parent reste retirable à la
main. Gestion dans le tableau du gestionnaire (colonnes « Synonymes » et « Parents ») et dans une page
« Synonymes et parents » qui liste toutes les règles. À coder après le feu vert de l'utilisateur.

## D-041 — Lot 5 de la phase 3, 2e série de réponses : défaire plutôt qu'effacer (20/10/2026)

Réponses de l'utilisateur (détail dans TAGM-15 à TAGM-19, GEN-21, SRCH-27, DEL-08, GRID-12, CTX-21).
**Principe (GEN-21)** : toute opération doit pouvoir être défaite ; la base garde ce qu'il faut pour
cela. D'où : un synonyme garde la liste des médias fusionnés (décocher défait la fusion, à l'identique) ;
une règle de parent garde la liste des médias qui ont reçu le parent par elle (décocher le retire,
recocher le remet, la corbeille le retire puis oublie). Une fusion peut garder les anciens noms comme
synonymes (TAGM-17), et donc être défaite. Le code de partage (TAGM-10) porte aussi descriptions,
synonymes et parents (TAGM-18), sous le même nom « MYBOARD-TAGS-1 ».

**À reproposer au test manuel** : l'interrupteur « Auto » des règles de parents, les parents en chaîne
(automatiques ou règle par règle), la corbeille des tags (TAGM-19). **À faire après le test manuel
complet** : les actions sans sécurité du gestionnaire de tags repérées par l'utilisateur (GEN-21).

## D-042 — Lot 5 de la phase 3 : synonymes et tags parents (20/10/2026)

**Données (schéma v7).** `tag_aliases` (synonyme → tag principal, case, réglages du tag fusionné pour le
recréer à l'identique) et `tag_alias_media` (médias qui portaient le synonyme, et s'ils avaient déjà le tag
principal) ; `tag_parents` (enfant → parent, case, « Auto ») et `tag_parent_media` (tags posés par chaque
règle, médias par médias, sous chaque règle du chemin) ; `tag_parent_skipped` (médias qui ont reçu l'enfant
pendant que la règle ne s'appliquait pas). Un déclencheur sort un média des listes des règles et synonymes
actifs quand on lui retire le tag (retrait à la main) ; d'autres invalident l'index de recherche quand un
synonyme change (D-027).

**Un seul chemin pour poser un tag** (`tagging.rs`) : résolution du nom (tag, sinon synonyme actif, sinon
création), puis pose avec les parents en chaîne, notés sous chaque règle du chemin. Visionneuse, barre de la
sélection, tags par défaut de l'import, import JSON (DEV-01), fusion et restauration (DEL-05) y passent.
Défaire (GEN-21) : décocher une règle retire ce qu'elle a posé et, en chaîne, ce que ces tags avaient apporté
(`remove_cascade`), puis remet ce qu'une autre règle cochée justifie encore (`restore_justified`) ; décocher un
synonyme recrée le tag fusionné sur ses médias et retire le tag principal de ceux qui ne l'avaient pas.
La logique a été vérifiée par 8 essais automatiques sur une base en mémoire (non gardés dans le dépôt), puis
dans l'interface.

**Recherche et suggestions.** Un terme exact cherche le tag, sinon le tag principal du synonyme (même index
en mémoire) ; un joker ne regarde que les vrais noms. Les suggestions ajoutent les synonymes « A → B » (un seul
par tag, et pas si le tag est déjà proposé par son nom).

**Mesures (version compilée, copie de la bibliothèque de 100 000 médias, écran 1080p à 60 Hz).**
- Règle « 1girl → zz_personne » sur 74 750 médias : vérification 118 ms, création (rétroactive) 2,0 s,
  décocher 3,2 s, recocher 2,1 s, corbeille 3,3 s. Chaîne de règles (34 760 médias) : 1,2 s par règle,
  décocher la première (chaîne retirée) 3,1 s, recocher 2,0 s.
- Synonyme « smile » (28 461 médias) → « zz_sourire » : vérification 4 ms, fusion 1,4 s, fusion défaite
  1,4 s, nouvelle fusion 1,4 s, corbeille 1,5 s.
- 50 000 médias sélectionnés : ajouter un tag sans règle 563 ms (837 ms avec la version d'avant), le
  retirer 643 ms (615 ms avant) ; ajouter un tag qui a un parent 1,9 s ; retirer ce tag et son parent 2,1 s.
- 1 000 synonymes : liste des règles 21 ms ; suggestions 3 à 5 ms ; recherche d'un synonyme 96 ms la
  première fois, 4 ms ensuite. Suppression de 300 médias : 255 ms (252 ms avant).
- Écritures en transaction « immédiate » (l'écriture est réservée dès le début) : plus d'erreur « base
  verrouillée » quand le service des miniatures ou un import écrit en même temps. Sans les conditions
  ajoutées au déclencheur, retirer un tag ordinaire de 50 000 médias prenait 1,8 s : corrigé (643 ms).

**Remplacée en partie par D-047 (27/10)** : synonymes en groupes avec fusion par nom, règles de parents à un seul interrupteur, règles qui suivent la fusion dans les deux sens.

## D-043 — Champ à pastilles : une zone éditable tenue par MyBoard (25/10/2026)

**Pourquoi.** Le retour du 25/10 (SEL-12) demande du texte tapé à plusieurs endroits du champ, une sélection à
la souris qui prend textes et pastilles, et un clic précis entre deux pastilles. Une case de saisie (`<input>`)
ne contient qu'un texte, sans pastilles : le champ devient une zone éditable (`contenteditable`), où les
pastilles sont des éléments non éditables posés dans le texte.

**Comment.** Le navigateur n'écrit jamais lui-même dans la zone : frappe, collage, effacement, défaire passent
par le contenu (`lib/pillText.ts` : textes et pastilles en alternance, toujours un texte, souvent vide, entre
deux pastilles) et son historique (`hooks/usePills.ts`), puis React redessine et le curseur est replacé
(`components/tags/pillDom.ts`). Flèches, Début / Fin, Ctrl + A et la souris (clic, glisser, double-clic) sont
gérés de même : le résultat ne dépend pas des habitudes du navigateur autour des éléments non éditables
(curseur introuvable entre deux pastilles, sauts imprévus). Seule exception : la composition d'un caractère
(touche morte), écrite par le navigateur puis relue. Le menu d'édition du clic droit (CTX-03) passe par les
commandes du champ (`registerEditable`, `lib/textMenus.ts`). Pas de bibliothèque d'éditeur ajoutée (Lexical,
Slate…) : WebView2 est le seul moteur, et le champ reste simple (une ligne de tags).

**Partagé.** `PillField` (barre de la sélection) reprendra la recherche de la barre latérale (SRCH-28) et les
champs des règles du gestionnaire (TAGM-15.5). La liste de suggestions est commune avec la case de saisie d'un
tag (`TagSuggestions.tsx`).

**Lot 7 (25/10).** Essayé aussi dans la recherche de la barre latérale (SRCH-28), puis abandonné le même jour
à la demande de l'utilisateur : le champ redevient une case de saisie. Copier-coller : le morceau copié (textes
et pastilles) va dans le presse-papiers sous le type réservé `application/x-myboard-pastilles`, avec son texte
brut (`components/tags/pillClipboard.ts`) ; le menu du clic droit, qui lit le presse-papiers par le cœur Rust
(texte seul), retrouve le dernier morceau copié par son texte. Suggestions (SRCH-29) : les tags déjà là restent
dans la liste, grisés avec une bulle (`taken`, `TagSuggestions.tsx`), plutôt qu'écartés.

## D-044 — La visionneuse est une étape de l'historique (25/10/2026)

**Pourquoi.** Les boutons 4 / 5 rouvraient la visionneuse par un mécanisme à part (VIEW-27, VIEW-30 : un
« chemin » de quatre étapes, valable seulement si rien n'avait changé depuis la fermeture). Il ne suivait pas
les recherches : après un clic sur un tag dans la visionneuse, le retour ramenait à la grille d'avant au lieu du
média (retour T3, point AUT.17), et le bouton 5 s'arrêtait après un double retour (point AUT.6).

**Comment.** Ouvrir un média ajoute une étape à l'historique de la fenêtre (`history.pushState`), qui garde le
média, sa position et sa requête (`viewer`, `lib/historySteps.ts`) ; passer à l'image suivante met cette étape à
jour (une seule étape par visionneuse). Revenir ou avancer sur une étape la rouvre ou la ferme (`popstate`,
`stores/viewer.ts`), après la recherche de l'étape (`stores/search.ts`). Dans la visionneuse, le bouton 4 fait un
vrai retour (`onBack` de la pile d'Échap, `lib/escape.ts`) ; la croix, Échap ou un clic sur le fond la ferment en
ajoutant une étape « grille » (choix de l'utilisateur). Une nouvelle étape ne reprend jamais la visionneuse de
l'étape d'avant. Au démarrage, une étape en cours qui gardait une visionneuse est remise à « fermée ».

## D-045 — La zone qui défile ne passe pas la main à la fenêtre (26/10/2026)

**Pourquoi.** Avec une molette en roue libre, un clic sur « Afficher 100 de plus » (gestionnaire de tags) ou sur
« Page suivante » (bibliothèque) arrêtait le défilement jusqu'à ce que la souris bouge de 10 px (GEN-24, retour
T3, point AUT.18). Mesuré avec de vraies entrées Windows : arrivé en bas de la zone qui défile (`#defilement`,
NAV-04), le moteur de WebView2 « passe la main » à la fenêtre, qui ne défile pas (NAV-04 : `html` et `body` en
`overflow: hidden`), et reste accroché à elle pour toute la séquence de molette (elle ne finit qu'après 500 ms
sans cran ou 10 px de déplacement, ce qu'une roue libre ne fait jamais).

**Comment.** `.app-scroll` (`index.css`) a `overscroll-behavior: contain` : la zone garde la main même en bas,
et la molette continue dès qu'il y a de nouveau de quoi défiler. Sans autre effet : la fenêtre ne défile de
toute façon pas, et les listes des pop-ins et des menus sont hors de cette zone. La pop-in « Tags proches »
quittée par une loupe est notée dans l'étape du gestionnaire (`tagsProches`, `lib/historySteps.ts`), sur le
modèle de la visionneuse (D-044).

## D-046 — Haut de page fixe et onglet des règles à la hauteur de la fenêtre (26/10/2026)

**Pourquoi.** Retour T3, points TAGM-15.3 et AUT.5 : le haut du gestionnaire de tags (jusqu'aux titres des
colonnes) et celui de la bibliothèque (filtres, ligne du titre et de la pagination) restent en place pendant le
défilement ; point TAGM-15.14 : l'onglet « Synonymes et parents » ne fait plus défiler la page, chaque tableau
défile seul.

**Comment.** Les hauts sont en `position: sticky`, collés à 57 px (hauteur de l'en-tête de MyBoard, bordure
comprise : à 56 px, comme la barre latérale, ils sautaient d'1 px au premier défilement), avec un fond opaque.
Dans le gestionnaire, le haut (onglets, en-tête de la page, filtres) est un bloc à part de `main` ; sa hauteur,
suivie par `useElementHeight`, passe dans `--haut-fixe`, et la ligne des titres du tableau se colle à
`57px + --haut-fixe`. Rien ne change pour la grille virtualisée (D-008) : un élément collant garde sa place dans
la page. Onglet « Synonymes et parents » : la colonne de `App.tsx` prend la hauteur exacte de la zone qui défile
(`h-full` au lieu de `min-h-full`) ; les deux tableaux, en grille, se partagent la place restante et leurs
listes défilent (`overflow-y-auto`, `overscroll-behavior: contain`, GEN-24).

**Complément du 26/10 (retouches).** La ligne des titres du tableau est enveloppée dans un bloc collant posé à
-1 px sur la bordure du cadre (fond de la page autour des coins) et porte sa propre bordure complète. Le haut fixe
de la bibliothèque est en `flow-root`, pour que la marge de son dernier élément reste dedans. La barre latérale est
collée à 57 px elle aussi. Retour en haut : `glideToTop` (`lib/scroller.ts`), animation à chaque image
(`requestAnimationFrame`), courbe « ease-out » sur 250 ms, horloge propre qui part de la 1re image et n'avance pas
de plus de 34 ms par image (une image lente ne fait pas sauter la glissade) ; la molette ne l'interrompt pas
(GEN-24). `scrollToTop` (changement de page de l'application) reste immédiat.

## D-047 — Refonte des synonymes et des parents : le modèle (27/10/2026)

**Pourquoi.** Au test de la phase 3, l'utilisateur a trouvé le système confus (retour T3, points TAGM-15.12,
TAGM-15.13, TAGM-16.1, TAGM-16.4, TAGM-11.2) : un « synonyme » était en fait une fusion (il retaggait des
milliers de médias), décocher et supprimer faisaient presque la même chose, un synonyme décoché ne servait à rien,
les règles de parents avaient deux réglages et des médias « sautés ». Toutes les décisions ont été prises AVANT de
coder (document `txt post-test\Refonte synonymes et parents - décisions.md`, décisions D1 à D15 ; SPEC TAGM-20).

**Le modèle.**
- **Groupe de synonymes** : un ensemble de noms reliés avec un tag principal ; un nom appartient à un seul groupe
  (en ajouter un d'un autre groupe réunit les deux). Le lien ne change aucun média : une recherche d'un nom vaut
  pour tout le groupe, en inclusion comme en exclusion, joker compris (D1, D2, D5, D5.1).
- **Fusion par nom** : chaque nom non principal est soit relié (un vrai tag, à part), soit fusionné dans le
  principal (ses médias portent le principal). La fusion garde, par nom, ce qu'il faut pour être défaite à
  l'identique : ses médias, ceux qui avaient déjà le principal, sa catégorie, sa description, son état masqué (le
  principe de `tag_alias_media`, D-042, étendu). Toujours réversible : plus de fusion définitive (D7). Changer de
  principal = tout défaire puis refaire vers le nouveau, en une transaction (D3.1). Un nom tapé qui n'est pas un
  tag devient un nom fusionné sans média (D4.1).
- **Un seul endroit pour résoudre un nom** (déjà le cas : `tagging::resolve`, `search::term_set`, `tags::find`) :
  nom fusionné → le principal ; nom relié → son propre tag ; la recherche ajoute ensuite tout le groupe.
- **Règles de parents** : un seul interrupteur (`enabled`), plus d'« Auto » ni de médias « sautés ». Éteinte, une
  règle ne retire rien et ne pose plus rien ; rallumée, rien de rétroactif. Le parent n'est posé qu'à l'ajout de
  l'enfant (une chaîne s'arrête sur un tag déjà là, D10.5). Retirer un parent n'arrive qu'à la suppression de la
  règle, par une case, et seulement là où la règle l'a posé (`tag_parent_media`, `remove_cascade`,
  `restore_justified` gardés) (D10 à D10.4).
- **Fusion et règles** : à la fusion, une règle d'un nom passe au principal ; à la défusion, elle revient. Une
  règle qui deviendrait un doublon, interne au groupe ou une boucle est mise de côté le temps de la fusion. Une
  règle dont l'enfant est dans le groupe peut s'étendre à tout le groupe, au choix ; défusionner retire ce que
  l'extension a posé (D11 à D11.3).
- **Conversion** à la première ouverture par la nouvelle version : synonyme coché → nom fusionné ; décoché → nom
  relié (D12.1) ; règle cochée avec « Auto » → allumée, tous les autres états → éteinte, médias inchangés, liste des
  « sautés » oubliée. Limite connue : une règle déplacée par une ANCIENNE fusion ne sait pas d'où elle vient.
- **Réserve des médias retirés** (DEL-05) : elle garde aussi les noms d'origine dans les groupes.
- **Code de partage** : nouveau format seul, sans compatibilité (aucun autre utilisateur) (D13).
- **Essais** : bases `refonte` et `refonte-ancien` réinitialisables (DEV-07) ; chaque lot y ajoute ses cas ; test
  complet de tous les cas limites après le lot R8.

Le détail des tables (schéma v8 et suivants) sera ajouté ici avec les lots R2 (parents) et R3 (groupes).

**Complément du 28/10 (lot R2, schéma 8).** `tag_parents.auto` et la table `tag_parent_skipped` sont supprimées ;
conversion : `enabled = 0` là où `auto = 0` ; les listes `tag_parent_media` ne gardent que les tags encore présents
(une règle décochée avant la version 8 avait retiré ses tags en gardant sa liste) ; le déclencheur
`parent_lists_tag_removed` vaut maintenant pour toutes les règles, allumées ou non. Commandes : `create_parent`
(`apply` : la case de la création), `set_parent_enabled`, `parent_delete_check` (médias où le parent a été posé, tags
venus en chaîne, chaînes : au plus 3, chemins lus en remontant les parents et en descendant les enfants),
`delete_parent` (`remove` : liste lue, règle supprimée, `remove_cascade` puis `restore_justified`). Interface :
`ui/switch.tsx` (repris pour les synonymes au lot R3) ; `ParentDeleteDialog` ; la pop-in de confirmation des règles
rend la réponse de l'utilisateur (promesse), pour qu'un formulaire ne se vide qu'à la confirmation ; un tag cité
dans ces pop-ins a des espaces et des traits d'union insécables (`q`), rendus ordinaires à la copie (`copyPlain`).

**Complément du 28/10 (retouches du lot R2).** `parent_delete_check` renvoie les chaînes avec la place de la règle
(`at` : son enfant ; jusqu'à 20 chaînes). `ChainStrip` les dessine en colonnes : bande à défilement horizontal
(`scroll-snap`, la molette verticale y est traduite en défilement horizontal, sauf au-dessus d'une colonne qui peut
encore défiler dans ce sens) ; plus de deux chaînes : largeur `(100 % - 2 écarts) / 2,12` (environ 12 % de la 3e
dépasse) ; les colonnes s'étirent à la hauteur de la plus haute, limitée à 240 px (`max-h-60`), pour que la pop-in
garde sa taille quand on fait défiler ; une longue colonne s'ouvre centrée sur la règle.

**Complément du 28/10 (lot R3, schéma 9).** Tables `tag_groups` (un principal par groupe), `tag_group_names` (un nom :
relié = `tag_id`, ou fusionné = `name` et les réglages du tag pour le recréer ; contrainte « l'un ou l'autre ») et
`tag_group_media` (médias d'un nom fusionné, `had_principal`). `tag_aliases` et `tag_alias_media` sont converties puis
supprimées (coché → fusionné avec sa liste ; décoché → relié au tag du même nom ; nom seul décoché → tag sans média
relié). Déclencheurs : un groupe sans nom disparaît ; le principal retiré d'un média le fait sortir des listes des noms
fusionnés ; les groupes changent ce que trouve une recherche (SRCH-17). « Avait déjà le principal » se compte par le
média lui-même, pas par un autre nom fusionné du groupe ; défusionner ne retire le principal que des médias qui ne
l'avaient pas et qu'aucun autre nom fusionné du groupe ne note. Changer de principal : les fusions (avec médias) sont
défaites, le principal change, l'ancien prend l'état qu'avait le nouveau, puis les fusions sont refaites, en une
transaction. Réunir deux groupes : les fusions de l'autre sont défaites (les noms sans média suivent tels quels), ses
noms et son principal rejoignent le groupe et prennent l'état de l'interrupteur. Modules : `groups.rs` (fusion,
défusion, principal, retrait, suppression), `group_create.rs` (formulaire, réunion, fusions du gestionnaire jusqu'au lot
R6), `group_list.rs` (liste, aperçu sans écriture, médias concernés). Recherche : un terme (ou un joker) donne les tags
trouvés, puis les principaux et noms reliés de leurs groupes (`GROUP_TAGS`, une requête). Interface : `GroupForm`,
`GroupLine`, `lib/groupRules.ts`, interrupteur « à moitié » (`aria-checked="mixed"`).

**Complément du 29/10 (retouches de R3).** Onglet « Synonymes et parents » : sur grand écran, les deux tableaux
sont deux sous-grilles (`grid-rows-subgrid`) d'une même grille à cinq rangées (titre, texte, formulaire, filtre,
liste) : chaque rangée prend la hauteur de la plus haute des deux, d'où des formulaires et des barres « Filtrer par
nom » toujours alignés, quel que soit le nombre de lignes des textes ; colonne interne limitée à la largeur du tableau
(`minmax(0, 1fr)`), sinon le contenu débordait sur le tableau voisin. L'aperçu du formulaire des synonymes tient sur
une ligne de hauteur fixe ; un champ dont les pastilles passent à la ligne fait descendre les deux filtres ensemble.

**Complément du 29/10 (retouches de R3, 3e tour).** Un tag tapé en « Tag principal » qui est un nom relié d'un
groupe le reste : les noms rejoignent ce groupe, son principal ne change pas (l'aperçu le dit : champ `member`) ; changer
de principal se fait seulement avec l'étoile (D3). Les deux tableaux ne partagent plus que les rangées du titre et du texte
d'explication (le champ « Synonymes » qui grandit ne fait plus descendre les parents) ; le formulaire des parents garde
sous ses champs une ligne de la hauteur de l'aperçu (son refus y apparaît), pour que les filtres restent alignés tant que
le champ tient sur une ligne. Composants : `FitLine` (une ligne de noms jamais coupés, puis « … + N » : ligne d'un groupe,
aperçu), `pillOverflow.tsx` (champ à pastilles limité à N lignes : pastilles en trop cachées une à une, « +N », ligne
d'écriture dessous ; mesure avant chaque affichage), `hooks/useUnfolded.ts` (dépliage à l'approche de la souris, sorti de
la recherche SRCH-18 et partagé). `Modal` (GEN-25) : titre, sous-titre (`subtitle`) et boutons fixes, contenu qui défile,
80 % de la hauteur de la fenêtre au plus.
