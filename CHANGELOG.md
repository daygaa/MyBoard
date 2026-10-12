# Historique des versions

Format : une entrée par tâche livrée, la plus récente en haut. Les IDs renvoient à `docs/SPEC.md`.
La colonne « Backup » renvoie au dossier `Backups/vX` correspondant.

## Phase 2 — Corrections après test, suite (13/10/2026) — Backup v8

SPEC : ZOOM-08, VIEW-21, SRCH-15 validés `[x]` ; GEN-09 `[~]`.

- VIEW-30 (nouveau) : le bouton 5 de la souris fait exactement l'inverse du bouton 4 — il refait
  le chemin dans l'autre sens (Bibliothèque → image → fermée → image → plus rien) et annule le
  dernier bouton 4.
- VIEW-18 : la barre du bas apparaît à 60 px de distance et disparaît au-delà (zone tampon) ;
  bouton plein écran déplacé — vidéos : tout à droite de la barre de lecture, autres médias : en
  bas à droite (dans la barre en plein écran) — avec une icône aux flèches inversées pour en
  sortir ; touche F ; en plein écran, la croix ferme le plein écran ET la visionneuse.
- VIEW-19 : bouton rond comme la croix, aligné avec elle (badge du zoom juste en dessous) ; clic
  en dehors = ferme la note sans autre effet ; Entrée = note « écrite », Maj + Entrée = retour à
  la ligne.
- VIEW-29 : curseur de volume continu (sans crans).
- VIEW-17 : le panneau d'impression de WebView2 passe sous la barre de titre (limite de
  WebView2, reproduite) ; gardé tel quel à la demande de l'utilisateur.

Vérifié dans la version compilée (écran 1080p) : séquences des boutons 4 et 5 avec de vrais
clics Windows ; plein écran (touche F, zone tampon à 40 / 80 px, bouton rangé dans la barre,
croix) ; notes (Maj + Entrée, Entrée, clic dehors sans zoom) ; volume 0,362 puis 0,588.

## Phase 2 — Corrections après test (T2) (13/10/2026) — Backup v7

Retours du fichier « Précisions - problèmes 2.txt » (`T2`) et réponses aux questions (D-017).
SPEC : 36 demandes validées `[x]` par l'utilisateur ; VIEW-16 abandonné (doublon de VIEW-24).

- VIEW-27 : le bouton 4 rouvre la dernière image vue juste après la fermeture de la visionneuse
  (une seule fois, si rien n'a changé), puis fait le retour arrière normal.
- VIEW-28 : si « Explorer » ou « Ouvrir avec » échoue, message avec le code d'erreur Windows,
  le message de Windows et une explication (ex. 2 = fichier déplacé, 3 = dossier ou disque absent).
- VIEW-29 + ZOOM-08 : lecteur vidéo aux couleurs de MyBoard (lecture / pause au clic et à
  l'Espace, temps, progression cliquable avec le temps au survol, volume + muet retenus,
  vitesse 0,5× à 2×, boucle, image par image avec `, ?` et `; .`) et même zoom que les images
  (Échap dézoome d'abord).
- ZOOM-09 : badge du zoom en pourcentage de la taille réelle.
- VIEW-17 : bouton « Imprimer » (images) qui imprime l'image seule, sans en-tête ni pied de page.
- VIEW-18 : plein écran total ; barre du bas (et commandes vidéo) au survol ; la croix, Échap et
  le bouton 4 quittent d'abord le plein écran.
- VIEW-19 : note par média (bouton en haut à gauche, liens cliquables, enregistrement automatique,
  Échap ferme la note) ; base en version 3.
- VIEW-21 : dans la visionneuse, suggestions dans l'ordre inverse (la plus utilisée en bas).
- SRCH-15 : barre latérale limitée à 10 tags par catégorie, nom de catégorie = déplier / replier.
- GEN-09 : texte des pastilles de tags remonté de 1 px (mesuré au pixel près).
- DEV-06 : bibliothèques de test déplacées dans `new V2\échantillon test SFW\MyBoard-test`.
- Nouvelles demandes notées pour plus tard : TAGM-08 (supprimer les tags non utilisés),
  SET-09 (préférence « toujours afficher en taille réelle »).

Vérifié dans la version compilée (fenêtre 1920×1080) : séquence du bouton 4 avec de vrais clics
Windows ; messages d'erreur 2 et 3 (fichier puis dossier de test renommés puis remis) ; vraie
fenêtre d'impression en portrait et en paysage ; plein écran 1920×1080 avec barre au survol ;
lecteur (clic, Espace, image par image à 1/30 s, zoom vidéo 167 %, Échap) ; note enregistrée en base.

## Phase 2 — Visionneuse, tags, recherche, barre latérale (12/10/2026) — Backup v6

Cadrage avec l'utilisateur avant de coder : D-016 (Q-05 tranchée, vidéos, choix par défaut).

- Visionneuse plein écran (VIEW-01 à VIEW-07) : clic sur une vignette ; fermeture par Échap,
  croix, clic sur le fond, **bouton 4 de la souris** (vérifié avec un vrai clic Windows : ferme
  la pop-in, puis la visionneuse, puis seulement fait « retour ») ; flèches écran et clavier
  **sans couture entre les pages** ; à la fermeture, la grille montre la page du média regardé ;
  page derrière bloquée ; pop-ins maison sans calque invisible (GEN-10).
- Zoom façon wikifeet repris de la v8 (ZOOM-01 à ZOOM-07) : « ajusté » plafonné à 1, ×4 maximum,
  molette continue ancrée sous le curseur, centrage par axe, clic ajusté ↔ taille réelle sur le
  point cliqué, clic sur le fond (dézoom ou fermeture), glisser si zoomé, animation au clic seul,
  badge « 1.50× ». La miniature s'affiche tout de suite, l'original net la remplace.
- Barre du bas (VIEW-10, VIEW-12, VIEW-13, VIEW-20 à VIEW-24) : nom, dimensions, poids, durée,
  date de création ; champ d'ajout de tag juste après les infos, suggestions au-dessus, pop-in de
  création avec choix de catégorie ; pastilles colorées retirables, clic = recherche ; « Explorer »
  (fichier sélectionné) ; **« Ouvrir avec l'application par défaut »** (VIEW-24, nouveau) ;
  Favori, Dossier, Supprimer grisés « bientôt » (phase 3).
- Lecture des originaux par un protocole interne avec lecture partielle : images, vidéos (H.264,
  VP9, AV1, HEVC avec l'extension Microsoft), son, PDF (lecteur intégré), TIFF / HEIC convertis par
  ffmpeg ; vidéo illisible → message + VIEW-24 (conversion à la volée : VIEW-25, phase 4) ;
  boucle désactivable (VIEW-26).
- Recherche (SRCH-01 à SRCH-07) : champ de la barre latérale avec autocomplétion, ET, `-tag`,
  `tag*`, `_` pour les espaces, pastilles des termes + « Tout effacer », message « aucun résultat »
  de la v8 ; changer de filtre garde les tags (FILT-03).
- Barre latérale (SRCH-10 à SRCH-14) : tags de la page affichée avec leur nombre total de médias,
  groupés par catégorie dans l'ordre et les couleurs choisis (TAGM-03), clic / « + » / « − »,
  compteurs relus dès qu'un tag change ; liste virtualisée.
- Tags : noms en minuscules, affichés avec des espaces ; un tag créé est proposé partout (TAGM-07) ;
  liés à l'identifiant du média (LIB-04) ; migration de la base en version 2 (catégories).
- Tags par défaut à l'import (IMP-30, IMP-31), avancés en phase 2 : ajoutés à tous les fichiers
  de l'import, y compris ceux déjà dans la bibliothèque.
- Outils : import de tags depuis des JSON en PowerShell, idempotent (DEV-01) ; banque de test
  Danbooru de 3 000 images, 200 vidéos, 100 GIF avec tags et catégories (DEV-03) ; tags réalistes
  dans le générateur 100 000 médias (DEV-04) ; fenêtre de test sur l'écran choisi et mesure
  `--ecran` (DEV-05) ; `scripts/cdp.mjs` réparé (ne faisait rien quand le chemin contient un espace).

**Vérifications** (version compilée, fenêtre 1920×1017 sur l'écran 1080p) :
- DEV-01 sur la banque Danbooru : 3 300 JSON, 13 093 tags, 133 823 liens en 3,2 s ; relancé :
  0 tag, 0 lien ; compteurs vérifiés exacts en base (aucun écart).
- Toutes les vidéos de l'échantillon se lisent (22 combinaisons conteneur / codec / son testées,
  dont HEVC 10 bits en .MOV et son PCM) ; saut aux 3/4 : 2 à 133 ms (1,1 s en 4K HEVC de 382 Mo).
- Visionneuse sur images Danbooru pleine résolution : ouverture 52 ms, image suivante 23–97 ms,
  zoom molette 5,6 ms par image affichée (aucune saccade).

**Mesures recherche** (100 000 médias, 586 tags, 1,39 million de liens) : page de résultats
2–91 ms (`1girl` sur 75 % des médias : 48 ms ; `1girl -solo` : 91 ms) ; tags de la page de 500
médias : 5 ms ; autocomplétion : 2 ms.

**Mesures grille** (100 000 médias, écran 1920×1080, `--ecran 1920x1080`). Windows 10 cadence la
fenêtre au rythme de l'écran principal (180 Hz) même sur l'écran à 60 Hz : les images/s restent
comparables à la phase 1 ; sur l'écran 60 Hz, aucune image ne dépasse 17 ms (une image à 60 Hz).

| Colonnes | Médias/page | Page suivante (médiane) | Page lointaine | Défilement | p95 / pire image | Saccades > 50 ms | Images ratées (à 180 Hz) |
|---|---|---|---|---|---|---|---|
| 4 | 50 | 46 ms | 118 ms | 180 images/s | 6 / 6 ms | 0 | 0 / 467 |
| 7 | 102 | 64 ms | 115 ms | 178 images/s | 6 / 11 ms | 0 | 3 / 309 |
| 14 | 223 | 143 ms | 193 ms | 159 images/s | 11 / 17 ms | 0 | 17 / 156 |
| 20 | 327 | 225 ms | 261 ms | 161 images/s | 11 / 17 ms | 0 | 10 / 116 |
| 30 | 500 | 379 ms | 440 ms | 173 images/s | 6 / 11 ms | 0 | 3 / 74 |

## Phase 1 — Pagination centrée, icône (12/10/2026) — Backup v5

- PAGE-04 : la page active reste au centre exact de la fenêtre (alignée avec le logo), en
  haut comme en bas, quelle que soit la page. Mesuré : 1280 px sur 2560 et 960 px sur 1920,
  pages 1 à 981. Fenêtre trop étroite : centrage sur la grille, sans passer sous la barre latérale.
- GEN-11 : l'icône dorée est enfin intégrée au programme (barre des tâches, coin de la fenêtre) ;
  `build.rs` régénère désormais l'icône à chaque changement du dossier `icons/`.
- NAV-01 : logo bien centré aussi quand la page ne défile pas (mesure de la réserve corrigée).

## Phase 1 — Corrections après test + aperçus (12/10/2026) — Backup v4

Retours du fichier « Précisions - problèmes 1.txt » (`T1`) et réponses aux questions de livraison.

- GRID-09 : au survol, le badge durée / GIF remonte sur la ligne du nom (ne cache plus les dimensions).
- IMP-01, IMP-03 : bouton « Importer un fichier » (plusieurs à la fois) et glisser-déposer de
  fichiers et de dossiers, mélangés ou non, sur la page d'import.
- IMP-50 : après un import, l'encadré de dépôt revient à son état de départ.
- FILT-08 : ouvrir le menu de tri ne décale plus l'interface (menus déroulants non bloquants).
- NAV-01 : logo centré sur la fenêtre (il était centré sur l'en-tête, 5 px trop à gauche).
- GEN-11 : icône de l'application = logo doré.
- LIB-09, LIB-10, LIB-12 (D-015) : miniatures 128 px dès 16 colonnes, grands aperçus 640 px à la
  demande de 4 à 6 colonnes, cache des aperçus limité à 1 Go.
- Outil `scripts/cdp.mjs` (pilotage de la fenêtre pendant les vérifications).

**Mesures** (version compilée, 2560×1377) : page suivante à 20 colonnes 207 ms (226 avant),
à 30 colonnes 386 ms (442 avant) ; défilement 148–177 images/s sans saccade ; grands aperçus à
4 colonnes : premier affiché ~0,3 s après le changement de page, les 12 visibles en 0,6–0,8 s
(échantillon réel) ; miniatures 128 px rattrapées au lancement pour 3 359 médias en ~19 s.

## Phase 1 — Socle : import d'un dossier, miniatures, grille (11/10/2026) — Backup v3

Application Tauri 2 (Rust) + React, apparence de la v8. À tester par l'utilisateur.

- Interface v8 : en-tête avec logo au centre exact (NAV-01), statistiques (NAV-03), menu burger
  dans l'ordre demandé (NAV-02, fonctions futures grisées « bientôt »), barre latérale (structure,
  recherche en phase 2), pied de page collé en bas (GEN-05), zones nommées `data-zone` (GEN-08).
- Base SQLite complète (médias, tags, catégories, favoris, dossiers) ; compteurs tenus par des
  déclencheurs SQL (D-005) ; 8 catégories de tags initiales (TAGM-01, TAGM-02).
- Import d'un dossier sur place (LIB-01) : fenêtre Windows (IMP-02), sous-dossiers (IMP-04),
  formats IMP-05 + Word (IMP-07) avec fichiers ignorés comptés, doublons par empreinte (LIB-03),
  progression dans la barre d'actions (IMP-40, IMP-41 partiel), bouton Arrêter (IMP-42 partiel),
  bouton Importer bloqué après l'import (IMP-44), reprise rapide d'un dossier déjà importé.
- Miniatures 320 px en arrière-plan, images et vidéos (LIB-06, IMP-46), rotation EXIF, ffmpeg
  détecté sous Windows avec message clair s'il manque (IMP-48), rangées dans `thumbs.db` (D-014).
- Grille virtualisée 4–30 colonnes (GRID-02), Disposition (GRID-03), Ctrl + molette (GRID-04),
  médias par page selon la densité (GRID-05), filtres par type à choix multiple (FILT-01), tris
  dont date de création et résolution (FILT-04, FILT-05), réglages mémorisés (FILT-06),
  pagination en haut et en bas avec « aller à » (PAGE-01), Ctrl + ← / → (PAGE-02).
- Outils : générateur de bibliothèque de test (DEV-02), mesure de fluidité `scripts/bench-grid.mjs`.

**Mesures (D-008)** — 100 000 médias, écran 2560×1377, version compilée :

| Colonnes | Médias/page | Page suivante (miniatures affichées) | Défilement | Saccades > 50 ms |
|---|---|---|---|---|
| 4 | 50 | 37 ms | 179 images/s | 0 |
| 7 | 102 | 62 ms | 177 images/s | 0 |
| 14 | 223 | 133 ms | 158 images/s | 0 |
| 20 | 327 | 226 ms | 155 images/s | 0 |
| 30 | 500 | 442 ms | 175 images/s | 0 |

Import réel (échantillon de 3 394 fichiers, 18,4 Go, lecture seule) : analyse 0,15 s, import
19 s (3 359 importés, 35 doublons, 0 erreur), toutes les miniatures prêtes en 172 s (0 erreur),
interface fluide pendant la création des miniatures (179 images/s).

Bogues trouvés et corrigés pendant les mesures : `.gitignore` qui excluait du dépôt le code des
dossiers `library/` et `thumbs/` ; grille qui se recalculait sans fin quand la barre de
défilement apparaissait/disparaissait (page blanche).

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
