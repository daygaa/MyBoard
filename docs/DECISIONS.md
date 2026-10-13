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
