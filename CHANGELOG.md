# Historique des versions

Format : une entrée par tâche livrée, la plus récente en haut. Les IDs renvoient à `docs/SPEC.md`.
La colonne « Backup » renvoie au dossier `Backups/vX` correspondant.

## Phase 4, lot 4 : retouches (2) (10/11/2026) — Backup v120

SPEC : IMP-28, IMP-64 `[~]` ; IMP-66 validé.

- « Supprimer les originaux » grisée : son nom l'est aussi.
- Pop-in des paires : « Supprimer les doublons » doré comme « Supprimer les originaux » (même taille dans les deux
  états) ; question « …importer les originaux ET/OU leurs versions compressées… ».

Vérifié dans la version compilée : opacité du nom, taille des deux boutons avant et après la case, texte ; zéro erreur
`tsc`.

## Phase 4, lot 4 : retouches (10/11/2026) — Backup v119

SPEC : IMP-28, IMP-64, IMP-66 (nouveau) `[~]` ; IMP-67 et IMP-68 décidés (lot 4 bis) ; marques posées.

- « Supprimer les originaux » grisée tant que ni la compression ni la conversion ne sont cochées.
- Pop-in des paires : plus de raccourci Entrée ; avec « Supprimer du stockage », bordure et boutons de suppression rouges.
- Menu des formats d'image : un « ⓘ » à droite de chaque format (qualité, vitesse, compatibilité).

Vérifié dans la version compilée, sur une copie neuve de la base d'essai : état de la case selon les options, les 5
bulles, Entrée sans effet, couleurs de la bordure et des boutons ; zéro erreur `tsc`.

## Phase 4, lot 4 : conversion des images, PNG, suppression des originaux, paires (10/11/2026) — Backup v118

SPEC : IMP-21, IMP-28, IMP-47, IMP-62, IMP-64, IMP-65 `[~]` ; IMP-30 complété. Décision D-063.

- Carte « Options d'import » : « Convertir les images en » (JPG, JFIF, PNG, WebP, AVIF) et « Supprimer les originaux »,
  chacune avec son « ⓘ ».
- Conversion à côté de l'original, gardée si au moins 5 % plus légère ; EXIF et profil de couleurs gardés (sauf AVIF) ;
  transparence sur fond blanc en JPG ; le média prend sa vraie extension.
- PNG compressés : sans perte, 16 → 8 bits à 75 ou moins, 256 couleurs à 50 ou moins.
- Noms « photo_c.jpg », « photo_c (1).jpg »…
- « Supprimer les originaux » : deux confirmations ; effacement définitif après l'enregistrement de la nouvelle version.
- Originaux ET versions compressées réimportés ensemble : pop-in « Importer les deux » · « Supprimer les doublons » ·
  « Supprimer les originaux », case « Supprimer du stockage » et 2e confirmation rouge.
- « Compresser aussi » devient « Convertir aussi » quand la conversion est cochée.

Vérifié dans la version compilée, sur des copies neuves de la base d'essai et des copies de fichiers : conversion WebP
(5 converties, 1 compressée, WebP animé laissé, EXIF et profil relus), règles PNG (85, 70, 40), JPG sur fond blanc
(3 149 pixels transparents devenus blancs), AVIF, nom déjà pris, suppression des originaux (3 copies), paires (11,
« Supprimer les originaux », « Supprimer les doublons » + stockage, doubles confirmations), « Convertir aussi »
(mêmes fiches, extension webp), marges des pop-ins ; zéro erreur `tsc` et `clippy`.

## Phase 4, lot 3 : corrections du 10/11 (10/11/2026) — Backup v117

SPEC : IMP-63, SRCH-30, VIEW-57, LIB-18 (nouveaux, défauts), IMP-60 `[~]` ; IMP-62 décidé (lot 4) ; marques posées.
Décision D-062. Schéma de la base : 19.

- Import avec compression : plus d'arrêts de 5 s (l'import attendait le service des miniatures, qui attendait
  l'import) ; « Arrêter » agit en moins d'une seconde ; 21 fichiers d'essai en 2,8 s au lieu de 17,5 s.
- Recherche par nom : un fichier renommé par la compression (« … (compressé) ») est trouvé aussitôt.
- Visionneuse : plus jamais l'image d'un autre média à l'ouverture (images gardées rangées par contenu).
- WebP avec rotation EXIF : miniature et dimensions comme la visionneuse (rotation ignorée, comme WebView2).
- Pop-in « Compresser aussi » : une ligne vide avant « Les originaux seront toujours disponibles… ».

Vérifié dans la version compilée, sur des copies neuves de la base d'essai : « Arrêter » (clic et commande) pendant
une compression ; recherche « compressé » avant et après « Compresser aussi » ; dimensions du WebP ; numéro d'un média
supprimé repris par un autre fichier, visionneuse ouverte à 80, 400 et 1 500 ms ; écart de 20 px dans la pop-in ; zéro
erreur `tsc` et `clippy`.

## Phase 4, lot 3 : retouches (10/11/2026) — Backup v116

SPEC : IMP-61 (nouveau, défaut), IMP-30, IMP-59, IMP-60 `[~]` ; IMP-62 (nouveau) `[?]` ; marques du lot 3 posées.

- Miniatures des images compressées : plus vertes, rayées ni étirées. Les JPEG compressés sont maintenant écrits
  au format standard (couleurs entrelacées), que le décodeur des miniatures lit correctement.
- Carte « Options d'import » : les textes explicatifs de « Compresser les images » sont dans un « ⓘ » à côté de son
  nom (règle pour les prochaines options).
- Aperçu agrandi de la liste : après 0,5 s de survol.
- Pop-in « Compresser aussi » : nouveau texte, ligne sur les originaux gardés, accords selon les types de médias,
  pop-in plus large (le bouton « Annuler » reste dans la marge).

Vérifié dans la version compilée, sur une copie neuve de la base d'essai, après avoir effacé les fichiers compressés
de l'essai de l'utilisateur : 11 images compressées, miniatures relues dans la base des miniatures (couleurs et
orientation justes) ; bulle « ⓘ » ; pop-in à 3 images et à 1 image (textes, largeur, position du bouton) ; aperçu
absent à 0,35 s, présent à 0,8 s ; accords vérifiés pour image, vidéo, document, fichier audio et médias mélangés.

## Phase 4, lot 3 : compression des images, carte d'options, retouches de la page Importer (09/11/2026) — Backup v115

SPEC : IMP-20, IMP-27, IMP-29, IMP-56, IMP-57, IMP-58, IMP-59, IMP-60 (nouveau) `[~]` ; IMP-25 (partie images) et
IMP-30 complétés. Décision D-061. Schéma de la base : 18 (`media.original_hash`).

- Page Importer : carte « Options d'import » à droite de la carte Fichiers (disposition v8), tags par défaut dessous ;
  « Compresser les images » et sa qualité (20 à 95, 85 par défaut), retenues avec la case des sous-dossiers, même
  après la fermeture de MyBoard.
- Compression des JPEG et des WebP fixes : version « photo (compressé).jpg » écrite à côté de l'original, gardée si
  elle est au moins 5 % plus légère ; résolution, EXIF, XMP, IPTC, profil de couleurs et dates du fichier gardés ;
  le média pointe vers elle et garde l'empreinte de l'original (un réimport de l'original compte comme doublon).
  Jamais : GIF, PNG, WebP animé, BMP, TIFF, AVIF, HEIC, fichier déjà compressé par MyBoard. Résultat sous la
  progression.
- Images déjà dans la bibliothèque au même endroit : pop-in « Compresser aussi » au clic sur « Importer » ; même
  fiche (tags, dossiers, favoris, note), seul le fichier change.
- Barre d'actions collée sous l'en-tête pendant le défilement ; toute la page passe sous l'en-tête (suggestions des
  tags par défaut comprises) ; « Voir la bibliothèque » fait comme le logo ; aperçu agrandi de 256 px au survol d'une
  miniature de la liste, après 1 s.

Vérifié dans la version compilée, sur des copies neuves de la base d'essai et des copies de photos : 22 fichiers
(11 compressés, gains de 37 à 91 %, 2 gardés, GIF, PNG, BMP, WebP animé et fichier « (compressé) » laissés,
5 doublons), EXIF et profil de couleurs relus, dates identiques, WebP transparent et sans perte ; second import sans
nouvelle écriture ; pop-in IMP-60 (3 photos taguées, mêmes fiches, miniatures refaites ; Échap = Annuler ; WebP animé
non compté) ; barre collée, en-tête au premier plan (suggestions, menu burger, menu des catégories, clic droit,
pop-in), aperçu agrandi (1 s, centré, décalé sous l'en-tête), « Voir la bibliothèque », options après rechargement ;
zéro erreur `tsc` et `clippy`.

## Phase 4, lot 2 : liste des fichiers avant l'import (09/11/2026) — Backup v114

SPEC : IMP-10, IMP-11, IMP-12, IMP-13, IMP-51, CTX-14, DEL-09 (nouveau) `[~]` ; IMP-52 retouché. Décision D-060.

- Page Importer : sous la barre d'actions, la liste des fichiers choisis (aperçu, nom, poids · format, croix pour
  retirer un fichier), 100 lignes puis « Voir plus » ; « Tout vider » ; menu du clic droit d'une ligne (Retirer de
  la liste, Afficher dans l'explorateur) et d'un fichier en erreur (Copier le message, Afficher dans l'explorateur).
- Aperçus de la liste : la miniature de Windows (celle de l'Explorateur), sinon faite par MyBoard pour une image ou
  un PDF (mesures dans D-060).
- Suggestions des tags par défaut : toujours au-dessus du champ.
- Pop-in de restauration : tags dans l'ordre de la visionneuse (catégorie, puis nom).

Vérifié dans la version compilée, sur des copies neuves de la base d'essai : liste de 50 fichiers d'essai et de
13 388 fichiers (C: et D:), croix, menu, « Voir plus », « Tout vider », liste pendant l'import, suggestions, ordre
des tags de 2 médias restaurés ; zéro erreur `tsc` et `clippy`.

## Phase 4, lot 1 : aperçu des PDF, restauration, formats (09/11/2026) — Backup v113

SPEC : LIB-17 (nouveau), DEL-05, IMP-52 `[~]` ; IMP-05, IMP-07 vérifiés. Décision D-059.

- Grille : la vignette d'un PDF montre le haut de sa 1re page (moteur PDF de Windows) ; les PDF déjà importés
  reçoivent la leur au lancement suivant.
- Pop-in de restauration (fin d'un import) : les miniatures apparaissent toutes. Les dernières miniatures d'une
  série n'étaient jamais envoyées à l'interface quand elles finissaient juste après un envoi.
- Page Importer : la liste des suggestions des tags par défaut s'ouvre au-dessus du champ quand la place manque
  en dessous.
- Formats : les raccourcis .gslides / .gsheet de Google Drive sont ignorés ; un son illisible (.wma) affiche la
  carte « Ouvrir avec l'application par défaut », comme une vidéo illisible, au lieu d'un lecteur vide.

Vérifié dans la version compilée, sur des copies neuves de la base d'essai : un fichier par format accepté
(50 fichiers d'essai : import, miniatures, visionneuse), restauration de 3 images, suggestions en haut et en bas,
capture des vignettes PDF ; zéro erreur `tsc`.

## Dossiers : flèches du menu « tri » à droite (07/11/2026) — Backup v112

SPEC : FOLD-10 (retour T3, point AUT.13) `[~]`.

- Menu « tri » des dossiers : les flèches ↓ / ↑ sont à droite de la ligne, plus collées au libellé.
- Noté sur FOLD-08 (sélecteur de couleur libre, plus tard) : le tri « Couleur » devra alors changer.

Vérifié dans la version compilée, sur une copie neuve de la base d'essai : place des flèches (mesurée et en capture),
tous les ordres, sens retenus, ouverture notée, liste « Ajouter à un dossier » (19 contrôles) ; zéro erreur `tsc`.

## Dossiers : ordre de la liste au choix (07/11/2026) — Backup v111

SPEC : FOLD-10 (retour T3, point AUT.13) `[~]`.

- Menu burger : petit bouton « tri » à droite du titre « Dossiers ». Une entrée par ordre, qui montre son sens :
  « A → Z ↓ », « Médias + ↓ », « Créés : récents ↓ », « Couleur ↓ », « Ouverts : récents ↓ ». Un clic sur une autre
  entrée l'applique telle qu'affichée ; un clic sur l'entrée en cours inverse son sens (« A ← Z ↑ », « Médias - ↑ »…) ;
  chaque entrée garde son dernier sens.
- Même ordre dans les listes « Ajouter à un dossier » ; ordre gardé d'un lancement à l'autre.
- MyBoard note la dernière ouverture de chaque dossier (page affichée, média ajouté ou retiré) : la base passe au
  schéma 17 à la première ouverture.

Vérifié dans la version compilée, sur une copie neuve de la base d'essai (9 dossiers ajoutés au modèle) : chaque ordre
et son inverse, sens retenu par entrée, dossier ouvert ou modifié qui passe en tête, liste « Ajouter à un dossier »
dans le même ordre, ordre gardé après rechargement et redémarrage ; zéro erreur `tsc` et `cargo clippy`.

## Visionneuse : défilement rapide allégé (07/11/2026) — Backup v110

SPEC : VIEW-53 (retour T3, point AUT.7.5) `[~]`.

- Flèche maintenue (ou appuis très rapides) : chaque média traversé garde un aperçu, mais allégé. Vidéos et GIF
  montrent leur miniature, sans lecture ni son ni conversion ; seules les images légères (au plus 4K et 4 Mo) ont leur
  copie nette, les autres leur miniature ; les miniatures des 10 médias suivants sont chargées d'avance (plus d'écran
  vide) ; la barre du bas et la note restent sur le média d'avant.
- À l'arrêt (touche relâchée, ou 200 ms sans appui), tout se charge normalement : la vidéo se lit, le GIF s'anime,
  l'image devient nette, la barre passe au média affiché.

Vérifié dans la version compilée, sur une copie neuve de la base d'essai, avec de vraies touches répétées 30 fois par
seconde : mélange de médias 19-21 % → 5-8 % du PC pendant l'appui, médias restés vides 53 → 0, service audio presque
plus sollicité ; images lourdes 24 → 5,5 % du PC, lectures du disque 721 → 6 Mo/s ; arrêt sur une vidéo, un GIF, une
image lourde ou légère (bien chargés, barre à jour) ; non-régression : vrai clavier à 4 images/s (30 sur 30), 1re
ouverture, vidéos, GIF et sous-titres ; zéro erreur `tsc`.

## Visionneuse : cache des copies à 150 Mo (07/11/2026) — Backup v109

SPEC : VIEW-53 (retour T3, point AUT.7.4) `[~]`.

- Les images gardées par la visionneuse occupent au plus 150 Mo (au lieu de 300).

Vérifié dans la version compilée, sur une copie neuve de la base d'essai : mémoire après 150 images lourdes (copies
182 Mo au lieu de 331 ; mémoire privée 1 089 Mo au lieu de 1 217 ; visionneuse fermée 718 Mo au lieu de 829) ;
non-régression : 1re ouverture (0,45 s), vrai clavier (30 images sur 30) ; zéro erreur `tsc`.

## Visionneuse : un seul canevas pour les copies, moins de mémoire (07/11/2026) — Backup v108

SPEC : VIEW-53 (retour T3, point AUT.7.4) `[~]`.

- Les copies nettes des images sont affichées dans un seul canevas, réutilisé d'une image à l'autre : le moteur ne
  garde plus chacune d'elles en double dans son cache d'images.

Vérifié dans la version compilée, sur une copie neuve de la base d'essai : relevé détaillé de la mémoire du moteur
après 100 images lourdes (images gardées : 661 → 342 Mo) ; mémoire privée après 150 images (1 330 → 1 217 Mo ;
visionneuse fermée : 899 → 829 Mo) ; captures : copie paysage et portrait à la place exacte de l'image, identique à
l'original ; non-régression : 1re ouverture (0,46 s), vrai clavier (30 images sur 30), zoom pendant la navigation
(original sans trou) ; zéro erreur `tsc`.

## Aucune connexion vers l'extérieur ; glissement sans retour en arrière ; mémoire graphique (06/11/2026) — Backup v107

SPEC : GEN-01 (retour T3, point AUT.29), VIEW-55 (VIS.5.1), VIEW-53 (AUT.7.4) `[~]`.

- MyBoard ne se connecte plus à rien : le moteur WebView2 ne cherche plus les mises à jour de ses composants
  (edge.microsoft.com), ne contacte plus le compte Microsoft de Windows (substrate.office.com) et ne cherche plus de
  proxy sur le réseau local.
- Barre de progression des vidéos : en glissant le curseur, plus de retour à l'image clé une image sur deux.
- Mémoire de la carte graphique réduite (copies des images dessinées par le processeur, limite du moteur).

Vérifié dans la version compilée, sur une copie neuve de la base d'essai : connexions de MyBoard et de tous ses
processus WebView2 (aucune en 70 s avec les seuls réglages de MyBoard, aucune en 90 s d'utilisation) ; glissements
rapide et lent sur IMG_0834.MOV (0 retour en arrière, position finale exacte) ; fluidité de la grille sur 100 000
médias avec et sans la limite de mémoire graphique (identique) ; mémoire après 150 images lourdes (899 Mo
visionneuse fermée) ; non-régression : 1re ouverture (0,47 s), vrai clavier (30 images sur 30), sous-titres, .mp4,
.mkv, .MOV lus directement ; zéro erreur `tsc` et `clippy`.

## Visionneuse : moins de mémoire, vidéos lues directement, sauts fluides (06/11/2026) — Backup v106

SPEC : VIEW-53 (retour T3, point AUT.7.4), VIEW-55 (nouveau, point VIS.5) `[~]`.

- Mémoire vive : images gardées par la visionneuse limitées à 300 Mo (au lieu de 1 Go) ; fichiers lus par le fil des
  copies libérés aussitôt (jusqu'à 600 Mo gardés auparavant).
- Vidéos lues directement sur le disque par la fenêtre (.mp4, .mov, .webm, .mkv…) : plus aucune attente de MyBoard
  pendant la lecture.
- Barre de progression : un clic montre l'image en 0,1 s sur une vidéo 4K très lourde (au lieu de 0,7 à 0,8 s) ;
  glisser le curseur, vite ou lentement, met l'image à jour en continu (avant : vidéo figée jusqu'au relâchement).

Vérifié dans la version compilée, sur une copie neuve de la base d'essai à chaque mesure : mémoire de MyBoard et de
ses processus WebView2 pendant 150 images lourdes (1 316 Mo au lieu de 2 174) ; vidéo de 684 Mo en 4K HEVC (.MOV) :
clics, glissements rapide et lent (v105 / v106) ; .mp4, .mkv, .MOV lus directement dans la visionneuse, sous-titres
affichés ; appels au cœur pendant la lecture et les sauts ; non-régression : 1re ouverture d'une image (0,46 s),
navigation au vrai clavier (30 images vues sur 30), sous-titres au passage en plein écran ; zéro erreur `tsc` et
`clippy`. Base d'essai : la vidéo IMG_0834.MOV (tag essai_video_lourde).

## Visionneuse : ouverture et navigation rapide, sous-titres (06/11/2026) — Backup v105

SPEC : VIEW-53, VIEW-52 `[~]` (retour T3, points AUT.7.2, AUT.7.3, VIS.1.5).

- Visionneuse : images lues directement sur le disque par la fenêtre (10 fois plus vite, sans bloquer le reste de
  MyBoard) ; 1re ouverture d'une image de 28 Mo nette en 0,45 s (avant : 1,5 s pour la copie, 2 s pour l'original),
  sans clignotement ; navigation rapide au clavier ou aux flèches : chaque image s'affiche, touches sans retard.
- Sous-titres : directement à leur place en sortant du plein écran (comme en y entrant).

Vérifié dans la version compilée, sur une copie neuve de la base d'essai à chaque mesure, v104 puis v105 : 1re
ouverture de l'image de 28 Mo (4093 × 5787) ; navigation au vrai clavier (touches envoyées par Windows) à 4 et 6 images
par seconde, 30 appuis (images vues : 30 sur 30 au lieu de 22 et 19 ; retard des touches : 2 ms en médiane au lieu de
0,12 à 0,19 s) ; 45 appuis injectés (aucun écran vide, au lieu de 10) ; zoom pendant la navigation (original sans
trou) ; images géantes quittées après 2,5 s (aucune tâche longue) ; sous-titres à l'entrée et à la sortie du plein
écran (une seule place) ; zéro erreur `tsc` et `clippy`.

## Retouches des lots 3.5 et 4 (06/11/2026) — Backup v104

SPEC : VIEW-53, VIEW-52, DEL-08, VIEW-29 `[~]` (retour T3, points AUT.7.1, VIS.1.1, VIS.1.3 à VIS.1.5, DEL-08.5, VIS.4) ;
VIEW-54 validé. Base de données : schéma 16.

- Visionneuse, navigation rapide sur des images lourdes : copies préparées 3 à la fois, l'image affichée d'abord ;
  l'original chargé seulement après 1 s sur l'image ou au zoom ; copies d'images dépassées abandonnées.
- Sous-titres : plus hauts quand la barre de lecture est cachée ; boutons « Vitesse » et « Sous-titres » échangés ;
  « Importer un fichier… » (retenu pour la vidéo), « Retirer le fichier importé » ; plus de saut au passage en plein
  écran.
- Barre de progression des vidéos : repère fluide pendant la lecture.

Vérifié dans la version compilée, sur une copie de la base d'essai : 16 images de 23 à 27 Mo à 2, 3 et 4 images par
seconde (nettes en 9 à 27 ms à 2 par seconde, au lieu de 0,6 à 0,9 s ; aucune page figée) ; ordre des boutons, menus
d'une vidéo sans sous-titres ; fichier importé (inscrit dans la base comme le fait la commande : la fenêtre « Ouvrir »
de Windows ne se pilote pas) listé, affiché, retiré ; place des sous-titres en plein écran (76 px, barre cachée) et au
passage en plein écran ; repère de progression (85 positions en 0,5 s) ; pop-in d'erreur avec 40 fichiers en lecture
seule ; GIF et images gardées : inchangés ; zéro erreur `tsc` et `clippy`.

## Lot 4 : sous-titres des vidéos, barre de lecture des GIF (06/11/2026) — Backup v103

SPEC : VIEW-52, VIEW-54 `[~]` (retour T3, points VIS.1 et VIS.3).

- Sous-titres : fichiers à côté de la vidéo (.srt, .vtt, .ass, .ssa) et pistes intégrées (MKV, MP4), trouvés tout
  seuls ; bouton de la barre de lecture, sous-menu du clic droit, touche C ; désactivés à l'ouverture ; texte blanc à
  contour noir, au-dessus de la barre de lecture quand elle est affichée.
- GIF animés : barre de lecture des vidéos (lecture, pause, progression, image par image, vitesse, boucle, zoom,
  plein écran) ; le GIF s'affiche tout de suite, sa vidéo prend le relais au même instant ; son grisé ; boucle propre
  au GIF ; « Copier l'image » ; vidéos dans un cache vidé au lancement et à la fermeture ; GIF voisins préparés.

Vérifié dans la version compilée, sur une copie de la base d'essai (vidéos d'essai créées par Claude) : liste des
pistes (fichiers .srt, .vtt, .ass ; MKV avec une piste SRT française et une ASS anglaise titrée ; MP4 mov_text),
texte affiché aux bons moments, accents d'un .srt en encodage Windows, italique, réplique sur 2 lignes, texte seul pour
l'ASS ; touche C, bouton, menus ; vidéo sans sous-titres ; place des sous-titres en plein écran (barre affichée : au-
dessus ; cachée : en bas de la vidéo) ; 5 GIF : affichage immédiat, barre grisée puis relais (écart de 3 à 21 ms),
voisins préparés, son grisé, touches M et L, menu, image copiée (240 × 240) ; barre cachée en plein écran ; cache
vidé à la fermeture normale et au lancement après une fermeture forcée ; tests Rust des sous-titres ; zéro erreur
`tsc` et `clippy`.

## Lot 3.5 : images de la visionneuse gardées en mémoire (06/11/2026) — Backup v102

SPEC : VIEW-53 `[~]` (retour T3, point AUT.7).

- Chaque image vue, et les voisines préparées d'avance (2 après, 1 avant), est gardée décodée à la taille de l'écran,
  dans la limite de 1 Go, tant que MyBoard est ouvert (même visionneuse fermée) : elle s'affiche aussitôt, sans
  fondu, puis l'original la recouvre une fois décodé.
- Copies faites dans un fil à part (la page n'est jamais figée par elles) ; protocole `media://` lisible par la page
  (en-tête CORS, `connect-src`).
- Vidéos : inchangées (1re image en moins de 0,2 s, mesuré).

Vérifié dans la version compilée, sur une copie de la base d'essai : 12 images de 32 à 61 Mpx en avant puis en
arrière (6 à 16 ms au lieu de 155 à 414 ms plus le fondu avec la v101, même série ; une fois 0,22 s, voir la limite connue) ; visionneuse fermée puis rouverte
sur une image déjà vue (24 ms) ; images ordinaires (4 à 5 ms) ; 330 grandes images : image vue il y a 20 images
gardée, celle vue il y a plus de 320 images oubliée ; mémoire du moteur (1,7 Go juste après, 1,2 Go une minute plus
tard ; v101 : 0,5 Go) ; 36 flèches tracées, toujours l'image nette ; tâches longues de la page : les mêmes qu'avec la v101 (images géantes quittées) ; zéro
erreur `tsc` et `clippy`.

## Retouches du lot 3 (06/11/2026) — Backup v101

SPEC : DEL-08, ZOOM-11, ZOOM-12, SRCH-18 `[~]` (retour T3, points DEL-08.3, DEL-08.4, VIS.2.1 à VIS.2.3, AUT.9.1).

- Fichiers non supprimés : « Supprimer quand même » sous la liste des fichiers en lecture seule, aligné sur « OK » ;
  raisons écrites « Erreur Windows N : » + le message de Windows, et « + Fichier en lecture seule » en gris dessous
  pour un fichier aussi en lecture seule ; « Copier » suit.
- Zoom : au niveau « Adapter » de la zone, par n'importe quel chemin, le média est adapté (le plein écran l'adapte de
  nouveau) ; un cran qui tomberait à 4 points ou moins de ce niveau y va directement ; la transition fluide n'est plus
  que pour le clic, le menu et la touche A.
- Recherche : la zone « +N » dépliée reste dépliée tant que le menu du clic droit d'une pastille est ouvert.

Vérifié dans la version compilée, sur une copie de la base d'essai : pop-in avec 2 fichiers tenus ouverts par
PowerShell (place et alignement du bouton, textes, texte copié, « Supprimer quand même ») ; 600 × 400 : adaptée au cran,
un cran de moins, plein écran, un cran de plus, sortie et retour (227,8 % puis 270 %) ; Abricot.jpg en plein écran
(100 → 116,7 → 133,3 → 152,5 → 169,2 %, plus de 150 %), petits pas depuis 152,5 % ; transition présente pour la touche
A, absente 0,5 s après et pour le plein écran ; zone « +N » dépliée avec la souris sur la dernière entrée du menu, repliée
à sa fermeture ; zéro erreur `tsc` et `clippy`.

## Lot 3 de la fin du retour de la phase 3 (06/11/2026) — Backup v100

SPEC : DEL-08, ZOOM-11, ZOOM-12, VIEW-51, GRID-13, NAV-08, GEN-15, CTX-12, FILT-09, SEL-11 `[~]` ; VIEW-54 ajouté
(barre de lecture des GIF, lot 4). Base de données : schéma 15.

- Fichiers en lecture seule (DEL-08) : un fichier en lecture seule ET ouvert dans un autre programme est signalé d'emblée
  avec les deux raisons, sans « Supprimer quand même » (qui échouerait) ; une ligne vide entre le chemin et l'erreur.
- Zoom de la visionneuse : la molette s'arrête quand le média touche les bords de la zone (ZOOM-11) ; « Adapter à
  l'écran » dans le menu du clic droit des images et des vidéos, touche A (ZOOM-12) ; un média adapté le reste en
  passant en plein écran ou en changeant la taille de la fenêtre.
- Tags de la visionneuse : par catégorie, puis par ordre alphabétique (VIEW-51).
- Bibliothèque : touche Suppr (GRID-13) ; Ctrl + clic sur une vignette (SEL-11) ; tri « Nom A → Z » et « Nom Z → A »,
  dans l'ordre de l'Explorateur de Windows (FILT-09).
- Logo « MyBoard » et « Bibliothèque » du menu burger : retour complet à l'accueil (NAV-08).
- Pastilles : chiffres descendus de 1 px (GEN-15) ; « Retirer de la recherche » dans le menu des termes (CTX-12).

Vérifié dans la version compilée, sur une copie de la base d'essai : passage au schéma 15 (3 293 médias, tous avec leur
clé ; 1,8 s une seule fois pour 100 000 médias, sur une copie) ; ordre A → Z et Z → A de 10 noms d'essai (chiffres,
majuscules, accents) ; menus de tri de la bibliothèque et des favoris ; ordre des 44 tags d'un média ; centre des
chiffres à 0,5 px de celui de la croix (avant : 1,5 px) ; menu et effet de « Retirer de la recherche » ; Ctrl + clic
(1, 2, puis 1 coché) ; touche Suppr dans 6 situations (rien supprimé) ; retour à l'accueil depuis la bibliothèque
(recherche, type, sélection ; retour arrière) et depuis le gestionnaire de tags ; molette en avant et en arrière
(arrêt à 227,8 %, 400 % au plus) ; « Adapter à l'écran » grisé dans les 3 cas, touche A, plein écran (270 %) et
retour ; suppression de 4 fichiers créés pour l'essai, dont 2 tenus ouverts par PowerShell (pop-in, « Supprimer quand
même », lecture seule gardée) ; zéro erreur `tsc` et `clippy`.

## Retouches de la corbeille, badges au premier plan (05/11/2026) — Backup v99

SPEC : TAGM-19 `[~]` (retouches), SEL-08 (badges, reste `[x]`), VIEW-25 (réponses notées, phase 4).

- Boutons « Corbeille » et « Supprimer les tags non utilisés » : contour rouge (textes et survol inchangés).
- Pop-in « Corbeille » : texte des pastilles centré (1 px de plus en haut : la police plus grande le laissait 0,5 px
  trop haut) ; « Médias » au-dessus des nombres (colonne des boutons de largeur fixe).
- Pop-in « Supprimer les tags non utilisés » : « Ils seront placés dans la corbeille pendant 30 jours. » sous le titre ;
  case « Supprimer définitivement » sous « Sélection manuelle » (et sous la liste ouverte), retenue d'une fois sur
  l'autre, même après la fermeture de MyBoard.
- Badges toujours au premier plan, visionneuse comprise ; badge « Tag … restauré » après « Créer un tag » + « Oui ».

Vérifié dans la version compilée, sur une copie de la base d'essai : contours, textes et survol des deux boutons ;
écart du texte de la pastille au centre : 0 px (comme dans la recherche) ; « Médias » aligné sur les nombres ; texte,
place et mémoire de la case (pop-in rouverte, puis MyBoard fermé et relancé) ; badge d'un synonyme créé depuis une
pastille de la visionneuse (« Renommer… » vers un tag existant) visible par-dessus elle ; badge « restauré » ; zéro
erreur `tsc` et `clippy`. Le contour rouge a d'abord été masqué par le style « contour » des boutons en thème sombre :
corrigé avant la livraison.

## Corbeille des tags, lot 2, TAGM-19 (05/11/2026) — Backup v98

SPEC : livré `[~]` : TAGM-19 ; DEV-07 (base d'essai au schéma 14). Schéma de la base : version 14 (table `tag_trash`).

- **Corbeille des tags** : un tag supprimé (menu du tag, poubelle du tableau, suppression groupée, « Supprimer les tags
  non utilisés ») est gardé 30 jours avec le journal de sa suppression (D-049), puis effacé au lancement de MyBoard.
- **Bouton « Corbeille (N) »** entre « Importer » et « Supprimer les tags non utilisés » ; pop-in : tableau (pastille
  un peu plus grande, sans croix ; nombre de médias ; « Restaurer » ; « Supprimer » bordé de rouge, fond rouge au
  survol), « Tout restaurer » et « Tout supprimer » avec confirmation.
- **Restaurer** remet tout comme avant : le tag, ses médias, sa place dans son groupe et ses fusions, ses règles, les
  parents retirés en chaîne. Chaque tag est indépendant : ce qui attend un autre tag de la corbeille (son groupe, une
  règle vers lui) revient avec ce tag. Nom repris entre-temps : les deux sont réunis. Ce qui n'a plus de sens (média
  disparu, règle qui ferait une boucle…) est sauté.
- **Recréer un nom de la corbeille** : « Voulez-vous restaurer « chat » ? » (« … il était lié à N médias, M règles de
  parents et avait L synonymes, voulez-vous le restaurer ? ») ; « Oui » le restaure, « Non » crée un nouveau tag.
- **Pop-in de suppression** : « … puis sera placé dans la corbeille avant d'être supprimé définitivement dans 30 jours »
  ; case « Supprimer définitivement », décochée, et ses textes.

Vérifié dans la version compilée, sur des copies de la base d'essai : 10 cas du cœur (tag avec règle ; maillon de
chaîne avec la case de retrait ; principal d'un groupe fusionné, avec et sans « Supprimer aussi » ; restauration dans
le désordre ; nom fusionné ; deux tags liés par une règle restaurés séparément ; nom repris ; suppression définitive ;
« Supprimer » d'une ligne) : base identique à avant, table par table ; interface (textes et case de la pop-in de
suppression, bouton et pop-in « Corbeille », « Restaurer » sans confirmation, « Tout restaurer » et « Tout supprimer »
avec, question « Voulez-vous restaurer » depuis la visionneuse avec « Oui » et depuis « Créer un tag » avec « Non ») ;
comptes d'un principal supprimé avec ses noms ; 300 tags à la corbeille en 1 s, restaurés en 0,03 s ; effacement après
30 jours au lancement ; fond rouge au survol de « Supprimer » ; presse-papiers remis ; zéro erreur `tsc` et `clippy`.
Défauts trouvés pendant les essais et corrigés avant la livraison : un nom restauré avant son principal perdait son
groupe (vidé par le départ d'un autre nom : il est maintenant recréé) ; les comptes d'un principal supprimé avec ses
noms (relevés avant toute suppression).

## Icône du son de MyBoard dans le mélangeur, AUD-02 (05/11/2026) — Backup v97

SPEC : AUD-02 `[~]` (retour de l'utilisateur sur la v96 : nom « MyBoard » affiché, icône de WebView2).

- L'icône du flux est donnée sous la forme « chemin de myboard.exe,0 » : le mélangeur de volume de Windows affiche
  maintenant l'icône de MyBoard (avec le chemin seul, il gardait celle de WebView2).

Vérifié avec l'utilisateur, dans le mélangeur de volume, sur MyBoard de test (vidéo à volume inaudible) : forme
« ,0 » → icône de MyBoard ; chemin seul → icône de WebView2 (contrôle avec un nouveau processus, car une icône déjà
affichée ne change plus) ; version corrigée → icône de MyBoard. Zéro erreur `clippy`.

## Le son de MyBoard : lot 1, AUD-01 et AUD-02 (05/11/2026) — Backup v96

SPEC : livrés `[~]` : AUD-01 (ex-GEN-26), AUD-02 (ex-GEN-16) ; nouvelle catégorie « AUD — Audio ». Validés : TAGM-22.

- **AUD-01** : WebView2 est lancé avec l'option de Chromium `AudioRendererMixerImmediatePause` (coupe le flux aussitôt
  la pause au lieu de 10 s plus tard). Elle existe à partir de Chromium 157 : sans effet avec WebView2 156, elle
  agira dès que WebView2 157 sera installé (mise à jour automatique). Les 3 réglages que Tauri met d'office sont gardés.
- **AUD-02** : MyBoard renomme son flux « MyBoard », avec son icône, dans le mélangeur de volume de Windows
  (`audio_session.rs`) ; il ne touche qu'aux flux des processus qu'il a lancés. SteelSeries GG affiche le nom du
  programme : il garde « MSEDGEWEBVIEW2 ».

Vérifié dans la version compilée (vidéo lue à un volume inaudible) : l'option arrive au navigateur de WebView2 ; le
flux est renommé « MyBoard » avec l'icône de MyBoard environ 1 s après le début de la lecture, sans aide ; les flux
des autres applications gardent leur nom ; avec WebView2 156, le flux passe encore inactif ~10 s après la pause
(attendu) ; MyBoard au repos : 0 ms de processeur sur 20 s, avant et après une lecture (une 1re version qui
vérifiait chaque seconde coûtait 156 ms toutes les 20 s : remplacée par les notifications de Windows avant la
livraison) ; zéro erreur `tsc` et `clippy`. Pas essayé : changer de sortie son pendant la lecture (réglage du
système) ; reste à vérifier : l'effet de l'option avec WebView2 157.

## Aperçu de l'import, texte de TAGM-22 pour une sélection, contour des vignettes (05/11/2026) — Backup v95

SPEC : validés `[x]` par l'utilisateur : TAGM-18 (retour T3, point TAGM-18.11), TAGM-20 (la refonte est terminée).
Livrés : TAGM-22 `[~]` (texte d'une sélection), GRID-14 (reste `[x]`, contour doré). TAGM-21 `[>]` précisé (phase 4).

- **Aperçu de l'import** : une règle dont un tag est fusionné porte « (désactivée) » (et non plus « (mise de côté) »).
- **TAGM-22, sélection** : « Dans la sélection, la chaîne de parents de « essai chaton » a ajouté « essai chat » à
  4 médias, « essai animal » et « essai etre vivant » à 2 médias. Voulez-vous aussi les retirer ? » : chaque parent
  avec le nombre de médias d'où il partira vraiment (tags au même nombre regroupés).
- **Grille** : le haut fixe s'arrête 2 px plus haut ; le contour doré des vignettes cochées de la 1re ligne n'est plus
  caché ; la grille ne bouge pas.
- **TAGM-21** : tout ce qui concerne les tags masqués ira en phase 4, après les options d'import ; la ligne liste les
  IDs liés et leur fonctionnement (le filtre « Masqués » du gestionnaire existe déjà, TAGM-04).

Vérifié dans la version compilée, sur une copie de la base d'essai : haut fixe à 203 px, 1re ligne toujours à 205 px,
contour doré entier (capture) ; C-09 refait (« (désactivée) » dans les deux aperçus, réimport de tous ses tags : rien à
créer) ; sélection des 4 médias « essai chaton » de la base d'essai : texte avec 4 et 2 médias, « Oui » laisse
« essai animal » et « essai etre vivant » là où ils sont justifiés ; essais de TAGM-22 refaits (visionneuse, vidéo,
sélection) ; presse-papiers remis ; zéro erreur `tsc` et `clippy`.

## Retirer un enfant : proposer de retirer ses parents, TAGM-22 (05/11/2026) — Backup v94

SPEC : livré `[~]` : TAGM-22 (nouvelle demande du 04/11, cas P-08 du test complet de la refonte). Notés : P-09 gardé
tel quel (D10.5) ; base à l'ancien format retirée (DEV-07).

- **Pop-in « Retirer aussi ces parents ? »** après le retrait d'un tag dont la chaîne de règles avait posé des parents
  sur le média : « « essai chat » et « essai animal » ont été ajoutés à cette image via la chaîne de parents de
  « essai chaton ». Voulez-vous aussi les retirer ? » ; « Oui » (doré, Entrée) les retire, « Non » (Échap) les garde ;
  le tag retiré reste retiré.
- Visionneuse (croix de la pastille, menu du clic droit) : « cette image / cette vidéo / ce document / ce fichier
  audio ». Barre de sélection (« Retirer des tags… », « Appliquer ») : une seule pop-in, « … à N médias de la
  sélection … ».
- Un parent qu'une autre règle justifie encore, ou qui était là avant la règle, n'est pas proposé ; rien à proposer :
  pas de pop-in. Retirer un parent posé (« essai chat ») propose la suite (« essai animal »), avec l'origine de la
  chaîne (« essai chaton »).
- Pop-in de confirmation partagée : libellé du bouton d'annulation au choix (« Annuler » par défaut).
- **Base d'essai** : « essai chaton » sur la 1re vidéo ; base à l'ancien format (« refonte-ancien », son modèle et son
  lanceur) retirée, mise à la corbeille.

Vérifié dans la version compilée, sur des copies de la base d'essai (chaîne t22 chaton → t22 chat → t22 animal et
t22 chien → t22 animal) : pop-in au-dessus de la visionneuse, Échap la ferme sans fermer la visionneuse ; parent
justifié par une autre règle non proposé ; parent posé avant la règle non proposé ; « Non » garde tout ; « Oui » par
Entrée et par clic ; retrait d'un parent posé sur une vidéo (« cette vidéo », origine « t22 chaton ») ; tag sans règle :
pas de pop-in ; sélection de 3 médias : une seule pop-in, les 3 nettoyés ; une autre pop-in garde « Annuler » ; zéro
erreur `tsc` et `clippy`. Deux défauts trouvés pendant ces essais et corrigés avant la livraison : noms dans le
désordre (« animal » avant « chat ») ; origine fausse au retrait d'un parent (la note « posé par » est effacée avec le
tag : ce qui partirait est maintenant calculé juste avant le retrait).

## Import : règles sur un nom fusionné, cas C-09 (04/11/2026) — Backup v93

SPEC : livré `[~]` : TAGM-18 (retour T3, point TAGM-18.11 ; TAGM-18 reste `[x]`). Nouvelle demande `[>]` : TAGM-21
(gestion des tags masqués). TAGM-20 : test complet des cas limites fait (121 cas bons sur 122).

- **Import des règles de parents** : le tag du code est repris tel quel, même s'il est fusionné dans la base (avant, il
  était remplacé par son tag principal, comme à la saisie). Une telle règle arrive mise de côté (elle ne pose rien tant
  que le nom est fusionné), comme chez celui qui a exporté. Réimporter son propre code ne crée plus rien (cas C-09).
- **Aperçu de l'import** : « (mise de côté) » après une telle règle.
- Une règle entre deux noms d'un même groupe du code (kitty → cat) n'est plus refusée comme « un tag vers lui-même ».
- **Base d'essai** : groupe ★c09 chat = c09 kitty (fusionné) avec la règle mise de côté « c09 kitty → c09 mignon ».
  Descriptions d'essai_animal et essai_demeure retirées (étapes données dans la session).

Vérifié dans la version compilée, sur des copies de la base d'essai : export de tous les tags puis réimport (0 tag,
0 groupe, 0 règle à créer, 0 ignorée, pas de cadre des règles) ; code « c09 kitty → c09 jouet » (c09 kitty fusionné) :
ligne « c09 kitty → c09 jouet (mise de côté) », règle créée sur c09 kitty, rien posé ; code d'un groupe avec la règle
« c09b kitty → c09b chat » : 1 règle à créer, mise de côté, 0 ignorée ; série C du test complet refaite (C-02, C-07,
C-08, C-11 à C-14 bons) ; aperçu du code d'essai du lot R8-2 inchangé ; presse-papiers remis ; zéro erreur `tsc` et
`clippy`. Vu pendant l'essai : après défusion de c09 kitty, la règle importée agit de nouveau mais ne rattrape pas
l'image qui retrouve c09 kitty (comme une règle rallumée, D10).

## Import : cases, réunion de groupes, aperçu des règles, lot R8-2 (04/11/2026) — Backup v92

SPEC : livrés `[~]` : TAGM-18 (retour T3, points TAGM-18.4, TAGM-18.9), TAGM-10 (point TAGM-18.10), TAGM-20 (lot R8-2 :
toute la refonte est livrée) ; DEV-07. Validés : TAGM-11.2, TAGM-18.1 à 18.3, 18.5 à 18.8.

- **Cases de l'import** : « Recréer les synonymes (N groupes) », dessous « Fusionner les tags pré-existants s'ils le
  sont dans l'import » (décochée, avec sa bulle), « Recréer les règles de parents (N) ». L'aperçu suit les cases.
- **Réunion de groupes** : un groupe du code qui rencontre un groupe de la base le complète (celui-ci garde son tag
  principal et ses fusions) ; s'il en rencontre deux, ils sont réunis comme dans le formulaire « Créer » (le plus grand
  garde son principal, les fusions de l'autre sont défaites).
- **Aperçu des règles** : « Groupes de synonymes » (Nouveau, Complété, Réunis, Modifié) et « Règles de parents »
  (Nouvelle), une ligne par règle ; « (F) » après un nom fusionné ; « (éteinte) ».
- **Noms longs** de l'aperçu coupés par « … » (nom entier dans la bulle).
- **« Annuler » après l'import** : tout redevient exactement comme avant, réunion comprise (les tags des images du
  groupe réuni et les notes des règles sont remis).
- **Base d'essai** : description de « essai demeure » avec les étapes et un code prêt à coller.

Vérifié dans la version compilée, sur des copies de la base d'essai : aperçu (lignes, « (F) », cases qui retirent les
groupes ou les règles), nom long coupé à 224 px avec sa bulle, import puis « Annuler », avec et sans la case de fusion :
groupes, tags des images, règles, notes des règles et notes des fusions identiques à avant ; import confirmé ; tests du
lot R8-1 refaits (import du code d'essai, annulation, aller-retour) ; presse-papiers remis ; zéro erreur `tsc` et
`clippy`. Défaut trouvé pendant les essais et corrigé avant la livraison : après une réunion, « Annuler » oubliait un
parent posé en chaîne (image 30 sans « essai transport »).

## Code de partage : nouveau format et pop-in d'export, lot R8-1 (04/11/2026) — Backup v91

SPEC : livrés `[~]` : TAGM-18 (retour T3, points TAGM-18.1, 18.2, 18.6, 18.8), TAGM-10 (points TAGM-18.3, 18.5, 18.7),
TAGM-20 (lot R8-1 ; point TAGM-11.2, compteurs) ; DEV-07 (base d'essai). TAGM-15 validé.

- **Code plus petit** : tags rangés par catégorie et code compressé ; tous les tags de la base d'essai (13 144) font
  115 Ko au lieu de 636 Ko. Nouveau format seul (« MYBOARD-TAGS-2 ») : groupes de synonymes (tag principal, état de
  chaque nom) et règles de parents.
- **Pop-in d'export** à la place du menu : « Tags du filtre », « Tous les tags », « Tags sélectionnés » (grisés sans
  filtre ou sans sélection) ; « Recréer les synonymes » (un groupe part si au moins 2 de ses tags sont exportés ; option
  « Exporter les groupes complets ») ; « Recréer les règles de parents » (une règle part si ses deux tags sont exportés ;
  option « Exporter toute la chaîne d'un tag ») ; bulles des options ; « Le code contiendra N tags » ; « Copier le
  code ». Groupe exporté sans son tag principal : le plus utilisé le devient, sans fusion.
- **Import** : lit le nouveau format, recrée les groupes avec leurs fusions (pour les tags qu'il crée) et les règles ;
  texte sans « (dans ce MyBoard ou un autre) » ; « Annuler » bordé de rouge après l'import ; une règle déjà présente
  n'est plus comptée comme « ignorée ».
- **Compteurs** : « … (avec 3 groupes de synonymes et 2 règles de parents) ».
- **Base d'essai** : description de « essai animal » avec les étapes et un code prêt à importer.

Vérifié dans la version compilée, sur des copies de la base d'essai : export de tous les tags (115 Ko, 9 groupes, 28
règles, états de fusion), « essai voiture » seul puis avec « groupes complets » (4 tags), « essai auto » + « essai
bagnole » (★essai auto = essai bagnole, sans fusion), « essai animal » avec « toute la chaîne » (5 tags, 4 règles),
bulles, choix grisés, import du code d'essai (groupe, fusion et règle recréés), « Annuler » qui retire tout, ancien code
refusé, aller-retour de tous les tags (rien à créer, rien de signalé), captures des trois pop-ins ; presse-papiers
remis ; zéro erreur `tsc` et `clippy`.

## Finitions de l'onglet « Synonymes et parents », lot R7 (03/11/2026) — Backup v90

SPEC : livrés `[~]` : TAGM-15 (retour T3, points TAGM-15.9, TAGM-15.10, TAGM-15.11), GEN-22, TAGM-20 (lot R7, textes
de D9 ; retour T3, point TAGM-11.2) ; DEV-07 (base d'essai). TAGM-11.4 validé.

- **Titres des colonnes** : chaque liste de l'onglet a une ligne de titres, fixe pendant le défilement : « Tag principal
  et synonymes » (« Tag principal » en doré léger), « Médias », « Fusion » ; « On/Off », « Enfant → parent », « Médias ».
- **Tris** : clic sur un titre (2e clic : l'inverse), titre du tri en cours doré avec sa flèche : ordre alphabétique
  (par défaut), médias, fusion (fusionnés, puis à moitié, puis non fusionnés), On/Off ; à égalité, de A à Z. Une ligne
  dont l'interrupteur change reste à sa place jusqu'au prochain clic sur un titre ; un nouveau tri repart du haut.
- **Filtre** : « Chercher un tag… » à la place de « Filtrer par nom… », dans les deux onglets du gestionnaire.
- **Aucun mot coupé** (GEN-22) : la pop-in et le bandeau d'erreur ne coupent plus les mots n'importe où ; dans toutes
  les pop-ins, un nom cité entre « » reste d'un bloc avec ses guillemets, et « ? », « : »… ne partent plus seuls à la
  ligne ; un nom dans un cadre (suppression d'un média, création d'un tag) a ses guillemets dans le cadre.
- **Renommer un tag en son propre synonyme fusionné** : nouveau texte du refus (« … pour en faire le tag principal,
  utilisez l'étoile de son groupe dans Gestionnaire de tags › Synonymes et parents. »).
- **Base d'essai** : descriptions de test ajoutées au modèle de `refonte` (« essai soleil », « essai bateau »).

Vérifié dans la version compilée, sur des copies de la base d'essai : titres alignés au pixel sur les colonnes, tous
les tris des deux listes (ordre lu ligne par ligne), « Tag principal » doré léger / doré, retour en haut de la liste
après un tri, lignes qui restent en place après un interrupteur (groupe et règle), suggestions du formulaire, menu du
clic droit, groupe déplié et menu burger au-dessus ou en dessous des titres comme il faut, « Chercher un tag… » dans les
deux onglets, tris du tableau des tags inchangés, refus du renommage (texte, insécables), pop-ins de suppression d'un
média (ouverte puis annulée) et de création d'un tag au nom très long ; zéro erreur `tsc`.

## Tags cochés : un synonyme choisi devient le tag principal (03/11/2026) — Backup v89

SPEC : livré `[~]` : TAGM-11 (2e retouche du point TAGM-11.4) ; refonte TAGM-20 ; DEV-07 (base d'essai).

- **Tags cochés** : dans « Créer un synonyme », choisir comme principal un tag qui est déjà un synonyme d'un groupe
  (ex. « essai navire », fusionné dans « essai bateau ») en fait le tag principal de ce groupe, comme l'étoile : les
  fusions sont refaites vers lui et l'ancien principal prend sa place. L'aperçu l'affiche (« ★ essai navire = essai
  bateau = … »).
- **Pop-in qui suit « Créer »** : elle s'ouvre toujours dans ce cas et commence par « « essai navire » deviendra le tag
  principal à la place de « essai bateau » : 2 médias passeront de « essai bateau » à « essai navire ». » ; les règles
  de l'ancien principal sont listées réécrites, avec leur case « Étendre » quand d'autres tags sont fusionnés.
- Inchangé : tags cochés déjà tous du même groupe (« déjà des synonymes de … », « Créer » grisé) ; formulaire de
  l'onglet « Synonymes et parents ».
- **Base d'essai** : règle « essai bateau » → « essai transport » et descriptions ajoutées au modèle de `refonte`.

Vérifié dans la version compilée, sur des copies de la base d'essai : aperçu et pop-in (« essai navire » + « essai
voiture », interrupteur allumé puis éteint), « Annuler » sans effet, « Réunir » avec la case « Étendre » cochée
(★essai navire, 7 images avec « essai navire » et « essai transport »), « Tout défusionner » ensuite (images rendues à
leurs tags ; une image garde « essai transport », comme avec l'étoile seule, vérifié), « essai navire » + « essai
vaisseau » (« déjà des synonymes de « essai bateau » », « Créer » grisé), formulaire et aperçu de l'étoile inchangés ;
zéro erreur `tsc` et `clippy`.

## Tags proches refaits, lot R6-2 (03/11/2026) — Backup v88

SPEC : livrés `[~]` : TAGM-13 (retour T3, points TAGM-13.3, TAGM-13.7, TAGM-13.8), TAGM-11 (retouches du point
TAGM-11.4), TAGM-11.2 en partie ; refonte TAGM-20, lot R6-2 (fin du lot R6) ; DEV-07. Schéma 13.

- **Tags proches** : des blocs qui tiennent compte des groupes de synonymes. Sans groupe : une case et un bouton radio
  par tag (« Créer un synonyme » / « Créer des synonymes ») ; près d'un groupe : « Groupe existant : ★ … » en gris, les
  nouveaux tags à cocher, « Ajouter au groupe » ; près de deux groupes : « Les groupes seront réunis ; tag principal :
  … », « Réunir les groupes ». Deux tags du même groupe ne sont plus proposés ensemble.
- **Écarter** : un tag décoché, ou un bloc « Ignorer », n'est plus proposé avec ces tags (paires « pas synonymes »),
  même si le groupe détecté change ; « Ignorés (N) » liste ces choix, avec « Ne plus ignorer ». Les anciens groupes
  ignorés sont repris.
- **Fusion** : un interrupteur « Fusionner » par bloc (allumé d'office si le groupe rejoint est entièrement fusionné)
  et « Fusionner tous » en haut ; « Créer des synonymes pour tous » remplace « Tout fusionner » (confirmation avec les
  médias et les règles, cases « Étendre »).
- **Tags cochés** (retouches du point TAGM-11.4) : plus de saut de la pop-in au choix du principal ; le tag principal du
  groupe d'un tag coché est proposé aussi ; étoile sur les tags déjà principaux.
- **Base d'essai** : cas des tags proches ajoutés au modèle de `refonte`, avec leurs descriptions.

Vérifié dans la version compilée, sur des copies de la base d'essai : blocs sans groupe, « Ajouter au groupe »
(« sidebraid »), « Réunir les groupes » (« hand up » / « hands up »), décochage et étape 3 de l'exemple (« knees
apart feet together » écarté, puis « knee apart feet together » : bloc à part, le groupe n'est pas reproposé), deux
groupes écartés l'un de l'autre non reproposés, « Ignorer » / « Ignorés (N) » / « Ne plus ignorer », conversion d'un
ancien groupe ignoré, « Fusionner tous » (« à moitié »), « Créer des synonymes pour tous » (19 blocs en Strict, 28 en
Large : groupes créés, une fusion, un tag écarté enregistré), retour arrière après une loupe (réglages retrouvés), tags
cochés (« essai bateau » proposé, étoiles, hauteur de la pop-in stable image par image, fusion allumée) ; zéro erreur
`tsc` et `clippy`. Deux cas limites de la détection trouvés pendant les essais ont été corrigés avant la livraison.

## Tags cochés et renommage : « Créer un synonyme », lot R6-1 (03/11/2026) — Backup v87

SPEC : livrés : TAGM-11 (retour T3, point TAGM-11.4), TAGM-17 (point TAGM-15.8), TAGM-11.2 en partie ; refonte
TAGM-20, lot R6-1 ; DEV-07 (base d'essai).

- **Tags cochés** : « Fusionner… » devient « Créer un synonyme… » (2 tags) ou « Créer des synonymes… » (3 et plus).
  Pop-in : « Choisis le tag principal ; les autres deviennent ses synonymes. », le tag principal au choix (le plus
  utilisé d'office), « Résultat : ★ … », l'interrupteur « Fusionner » (éteint ; allumé si le groupe obtenu est
  entièrement fusionné). « Créer » ; s'il le faut, la pop-in de fusion (médias, règles, « Étendre ») ou « Réunir les
  groupes ? » suit.
- **Renommer vers un tag existant** (ou vers un tag fusionné : son principal) : rien n'est renommé ; pop-in « Créer un
  synonyme ? » : « « chat » existe déjà (12 médias). « chaton » et « chat » seront reliés : chercher l'un trouvera aussi
  l'autre. Rien n'est renommé. », avec l'interrupteur « Fusionner ». Aussi depuis un menu du clic droit hors du
  gestionnaire (visionneuse, barre latérale).
- **La case « Garder les anciens noms » disparaît** partout (tags cochés, renommage, tags proches) : une fusion se
  défait toujours.
- **Base d'essai** : le modèle de `refonte` est au format actuel avec les cas `r5_…` (leur description dit quoi
  tester). « Remettre les bases refonte à zéro » les met dans la base `refonte`.

Vérifié dans la version compilée, sur une copie de la base d'essai : M-01 (2 puis 3 tags cochés, libellés, pop-in,
choix du principal et aperçu, groupe créé sans fusion, badge), M-02 (tags de deux groupes : « Réunir les groupes ? »,
annulée sans rien changer), interrupteur allumé d'office pour un groupe entièrement fusionné, M-03 (renommer « r5
lion » en « r5 fauve » : rien n'est renommé, groupes réunis), M-04 / réponse 2 B (renommer vers « essai bagnole »,
fusionné : relié à « essai voiture »), renommage depuis la visionneuse avec la fusion allumée (pop-in de fusion de R5
par-dessus la visionneuse), tags proches sans la case (« Fusionner » d'un groupe), modèle de la base (intégrité,
version 12, cas présents) ; zéro erreur `tsc` et `clippy`.

## Bulles des cases « Étendre », pop-in de fusion complète (02/11/2026) — Backup v86

SPEC : livré `[~]` : TAGM-16 (retour T3, point TAGM-16.4, retouche de R5-2) ; nouvel ID SET-16 (réglage futur).

- **Bulles Windows** au survol des cases « Étendre » (case et texte) : « « kitty » sera fusionné dans « chat », donc
  vous pouvez décider que la règle parent « chat » → « animal » s'y applique rétroactivement, cela sera annulé si vous
  désactivez la fusion » ; pour « Étendre à tout le groupe » : « … que la règle parent « kitty » → « mignon » s'applique
  à tout le groupe : elle deviendra « chat » → « mignon » et « mignon » sera ajouté aux médias de « chat », cela sera
  annulé si vous désactivez la fusion ».
- **Pop-in de fusion** : toujours complète. Sans case, elle ne se rouvre pas pendant la visite de l'onglet pour un même
  tag ; avec une case, elle s'ouvre toujours (annuler puis rouvrir permet de changer d'avis). Les cases sont toujours
  décochées à l'ouverture. « Changer de tag principal ? » ne change pas.

Vérifié dans la version compilée, sur une copie de la base d'essai `refonte` : textes des deux bulles (attribut de la
case) ; « kitty » (avec cases) : pop-in rouverte après Annuler, cases décochées, rouverte aussi après une défusion dans
la même visite ; « essai auto » (médias, sans case) : 1re fusion avec pop-in, 2e fusion de la visite sans pop-in,
pop-in revenue après un passage par l'onglet « Tags » ; zéro erreur `tsc`. **Non vérifié** : l'affichage de la bulle
Windows elle-même (dessinée par Windows, les clics simulés ne la font pas apparaître) : à voir à la souris.

## Case « Étendre » et pop-in une fois par visite, lot R5-2 (02/11/2026) — Backup v85

SPEC : livrés `[~]` : TAGM-16 (retour T3, points TAGM-16.4 et TAGM-16.12, nouveau ; refonte TAGM-20, lot R5-2). Schéma 12.

- **Case « Étendre »** dans la pop-in de fusion, décochée, sous chaque règle qui peut s'étendre (exemple : ★« chat » =
  « kitty ») : sous « « kitty » → « mignon » sera mise de côté pendant la fusion. », « Étendre à tout le groupe
  (+N médias) » : cochée, la ligne devient « … deviendra « chat » → « mignon ». », « mignon » est posé aux médias de
  « chat » qui ne l'ont pas, puis à chaque nouvel ajout de « chat » ; sous « « chat » → « animal » », « Étendre aux
  médias de « kitty » (+N médias) » : les médias de « kitty » reçoivent aussi « animal ». À la défusion, tout ce que
  l'extension a posé est retiré.
- **Une fois par visite** : une règle déjà montrée dans une pop-in de fusion pendant la visite de l'onglet n'y revient
  pas ; son dernier choix « Étendre » s'applique ; un tag sans média dont toutes les règles ont été montrées se
  fusionne sans pop-in. Passer sur l'autre onglet du gestionnaire ou le quitter commence une nouvelle visite.
- **Liste des règles** : l'icône de suppression d'une règle mise de côté n'est plus grisée.

Vérifié dans la version compilée, sur une copie de la base d'essai `refonte` (cas `r5_…`) : FP-02 et FP-03 cases
cochées (règle étendue, « mignon » posé sur les 2 médias annoncés, puis sur un média qui reçoit « chat » pendant la
fusion ; « animal » posé sur le média annoncé), défusion (tout ce que l'extension a posé est retiré, les médias
retrouvent leurs tags d'origine), refusion dans la même visite (pas de lignes de règles, choix retenu, coché ou non),
nouvelle visite après un passage par l'onglet « Tags » (les lignes reviennent), tag sans média (2e fusion sans pop-in),
deux changements de principal avec une règle étendue puis défusion (médias identiques au départ) ; icône de suppression
mesurée (règle mise de côté : nette ; règle éteinte : grisée comme avant) ; zéro erreur `tsc` et `clippy`. Un point de
logique corrigé avant la livraison : la défusion gardait les tags de l'extension sur les médias qui retrouvent
« kitty ». **Non vérifié par l'interface** : les cases dans la pop-in de création avec « Fusionner » et dans la colonne
« Synonymes » du tableau des tags (même pop-in, même code).

## Règles de parents et fusion des synonymes, lot R5-1 (02/11/2026) — Backup v84

SPEC : livré `[~]` : TAGM-16 (retour T3, point TAGM-16.4 ; refonte TAGM-20, lot R5-1). Schéma 11.

- **Fusion d'un synonyme** (exemple : ★« chat » = « kitty ») : une règle dont « kitty » est le parent (« chaton » →
  « kitty ») devient « chaton » → « chat » le temps de la fusion, et revient à la défusion. Les autres règles qui citent
  « kitty » sont **mises de côté** : elles restent telles quelles et ne posent rien pendant la fusion (« kitty » →
  « mignon », « kitty » → « chat », un doublon, une boucle), puis remarchent à la défusion.
- **Pop-in de fusion** : sous le texte des médias, « Règles de parents : » et une ligne par règle touchée
  (« … deviendra … », « … sera mise de côté pendant la fusion », avec « (… existe déjà) » ou « (elle ferait une
  boucle) »), puis « Désactiver la fusion ramènera ces règles. » ; elle s'ouvre aussi pour un tag sans média s'il a des
  règles. Mêmes lignes pour l'interrupteur du groupe et la création avec « Fusionner ».
- **Médias** : à la fusion, les médias de « kitty » reçoivent « chat » sans les parents de « chat » (case « Étendre »
  décochée ; la case viendra au lot R5-2). Un média où une règle déplacée a posé « chat » pendant la fusion retrouve
  « kitty » à la défusion (et perd « chat » s'il ne l'avait pas par ailleurs).
- **Liste des règles** : une règle déplacée a un « = » gris après elle ; au survol de l'icône ou du tag déplacé, « Règle
  d'origine : … ». Une règle mise de côté est grise, son interrupteur grisé (aussi dans le menu du clic droit), avec la
  bulle « Mise de côté : « kitty » est fusionné dans « chat ». Elle reviendra à la défusion. ».
- **Changer de principal** : la pop-in liste les règles réécrites ; les règles de l'ancien principal passent au nouveau.
- **Supprimer un tag fusionné** : les règles déplacées restent sur le principal, ordinaires ; les règles mises de côté
  partent avec lui. **Défusion impossible pour une règle** (elle ferait une boucle avec une règle créée pendant la
  fusion) : elle reste sur le principal, un badge le dit.

Vérifié dans la version compilée, sur des copies de la base d'essai `refonte` (cas d'essai `r5_…`) : pop-ins de fusion
(nom, groupe entier, tag sans média) et de changement de principal, textes et résultat en base ; FP-01 (règle déplacée
puis revenue), FP-03 (médias du tag sans les parents du principal), FP-04 (doublon mis de côté), FP-05 (boucle mise de
côté), FP-06 (règle éteinte : déplacée et revenue éteinte), FP-08 (fusion puis défusion : base identique à avant) ;
pendant la fusion, une règle déplacée pose « chat » et le média retrouve « kitty » à la défusion, une règle mise de côté
ne pose rien ; réponses 5a, 5b, 5c, 5d ; lignes, bulles et menu du clic droit ; aperçus sans effet sur la base ;
ancienne fusion de l'onglet « Tags » sans « Garder les anciens noms » (règle passée au principal comme avant) ; zéro
erreur `tsc` et `clippy`. Un défaut trouvé pendant la vérification (défusion refusée : comparaison SQL avec une valeur
vide) a été corrigé avant la livraison. **Non vérifié par l'interface** : la création d'un groupe avec « Fusionner »
(aperçu vérifié par appel direct) et la colonne « Synonymes » du tableau des tags (même code que l'onglet).

## Échap dans les champs, double clic sur le texte des cases, « des chaînes » (02/11/2026) — Backup v83

SPEC : livrés `[~]` : GEN-27 (nouveau ; retour T3, point AUT.27), GEN-17 (point AUT.28), TAGM-16 (point TAGM-16.11).

- **Échap dans un champ de saisie** (tous les champs) : le champ perd le focus. En dernier recours : une liste de
  suggestions ouverte se ferme d'abord, une pop-in se ferme comme avant, le renommage dans la ligne s'annule comme avant.
- **Texte d'une case à cocher** : un double ou triple clic coche la case sans surligner le texte ; le clic glissé le
  surligne toujours.
- **Pop-ins de suppression d'une règle et d'un tag** : « ainsi que les tags ultérieurs des chaînes » quand plusieurs
  chaînes sont montrées.

Vérifié dans la version compilée, sur une copie de la base d'essai `refonte` : Échap dans la recherche (sans liste :
focus retiré ; avec la liste : 1er Échap la ferme, 2e retire le focus), dans le filtre du gestionnaire avec un tag coché
(1er Échap : focus retiré, le tag reste coché ; 2e : décoché), dans la pop-in « Créer un tag » (fermée) et le renommage
dans la ligne (annulé) ; textes « des chaînes » (règle « essai x → essai y », tag « essai x ») et « de la chaîne » (tag « essai chien ») ;
zéro erreur `tsc` et `clippy`. **Non vérifié** : le double clic sur le texte d'une case (les clics simulés ne surlignent
pas ce texte, ni dans la version d'avant ni dans celle-ci ; ils surlignent un texte ordinaire) : à tester à la souris.

## Règles de parents dans la pop-in de suppression d'un tag (02/11/2026) — Backup v82

SPEC : livré `[~]` : TAGM-16 (retour T3, point TAGM-16.8). Refonte des règles annulée le 01/11 (TAGM-16.9, TAGM-16.10).

- **Supprimer un tag qui a des règles de parents** : sous le trait, une ligne par règle qui part (« La règle « chaton
  → chat » sera supprimée. ») ; pour un seul tag, ses chaînes en colonnes comme dans la pop-in de suppression d'une
  règle, le tag rayé ; une case, décochée, « Retirer « animal » ainsi que les tags ultérieurs de la chaîne aux médias
  les ayant obtenus par ces règles (N médias) » (la suite de la chaîne devient rouge pâle quand elle est cochée).

Vérifié dans la version compilée, sur une copie de la base d'essai `refonte` : pop-ins de « essai être vivant » (pas de
case : rien d'autre à retirer), « essai x » (plusieurs chaînes), « essai chien », de deux tags cochés ; « essai chat »
supprimé avec la case : le média où ses règles avaient posé « animal » et « être vivant » les perd, celui où « chien »
justifie « animal » le garde, celui qui avait « animal » avant le garde ; « essai chien » supprimé sans la case : rien
n'est retiré ; zéro erreur `tsc` et `clippy`.

## Refonte des synonymes et des parents, lot R4-3 : colonne « Synonymes » modifiable, menu burger, séparateur (01/11/2026) — Backup v81

SPEC : livrés `[~]` : TAGM-15 (retour T3, point TAGM-15.30), NAV-02 (point AUT.3, retouche), TAGM-16 (point TAGM-16.8, en
partie : le séparateur).

- **Colonne « Synonymes » du tableau des tags** : la petite liste reprend le panneau déplié de l'onglet (étoile,
  interrupteur de fusion, croix, mêmes confirmations) et a un champ « Ajouter un synonyme… » : un tag sans groupe
  devient principal ; le nom ajouté est relié, ou fusionné d'office si tout le groupe l'est ; un tag d'un autre groupe
  réunit les deux (« Réunir les groupes ? », avec le groupe obtenu) ; un nom nouveau passe par « Créer un nouveau
  tag » et n'est créé qu'avec le groupe.
- **Menu burger ouvert** : la page dessous ne réagit plus à la souris (ni main, ni effet de survol).
- **Pop-in de suppression d'un tag** : un trait sépare le texte sur les règles de parents du reste.

Vérifié dans la version compilée, sur des copies de la base d'essai `refonte` : « essai chat » sans groupe + « essai
chien » : groupe créé, chat principal ; + « essai r4c nouveau » : pop-in de création, tag créé avec le groupe ; refus
(principal, déjà synonyme) sous le champ ; groupe d'essai bateau entièrement fusionné + « essai ciel » : pop-in de
fusion, ciel fusionné ; « essai voiture » + « essai maison » : « Réunir les groupes ? », groupes réunis ; étoile, croix
et interrupteur de la petite liste ; champ vidé après un ajout direct et après une pop-in confirmée, gardé après une
pop-in annulée ; panneau déplié de l'onglet inchangé ; menu ouvert : sur « Importer » et le filtre « Images », ni
survol ni main, dans le menu oui, un clic ferme sans rien activer, le survol revient ensuite ; trait de 1 px au-dessus
de « Partiront avec lui… » (capture) ; zéro erreur `tsc` et `clippy`.

## Refonte des synonymes et des parents, lot R4-2 : suppression d'un tag d'un groupe, réserve, menu burger, « Tag principal » (31/10/2026) — Backup v80

SPEC : livrés `[~]` : TAGM-15 (retour T3, points TAGM-15.28 et TAGM-15.29), TAGM-16 (point TAGM-16.7, nouveau), DEL-05
(point AUT.22), NAV-02 (point AUT.3).

- **Supprimer un tag d'un groupe** : une seule pop-in (menu du clic droit, corbeille, tags cochés), qui dit ce que
  devient chaque groupe. Principal : case « Supprimer aussi … (fusionnés dans …) », décochée : ils sont d'abord
  défusionnés (leurs médias les retrouvent), les noms restants gardent le plus utilisé comme principal. Tag fusionné :
  ses médias gardent le principal ; case « Supprimer « … » de ces médias » (seulement là où il n'est venu que par lui).
  Tag relié : il quitte le groupe.
- **Réserve des médias retirés** : un tag fusionné est gardé sous son nom d'origine ; à la restauration, fusion active
  → le principal (la défusion lui rendra son tag), défusionné → son tag, supprimé entre-temps → le principal ; la
  pop-in montre « kitty → cat ».
- **Menu burger** : un clic gauche ou droit en dehors (en-tête, filtres, pagination, « Importer »…) le ferme seulement.
- **« Tag principal »** : une seule pastille, comme « Enfant » (plus de frappe, plus de 2e ligne).
- **Règles de parents** : plus de « ? » quand le parent vient d'être créé.

Vérifié dans la version compilée, sur des copies de la base d'essai `refonte` : menu burger (clics sur « Importer », le
filtre « Images », une vignette, clic droit : menu fermé, rien d'activé ; clic dans le menu, barre de titre : menu
ouvert ; Échap, bouton du menu) ; « Tag principal » et « Enfant » avec un tag de 52 caractères : 36 px (une ligne),
texte d'aide caché, frappe bloquée ; nouvelle règle de parents image par image : aucun « ? » (4 avant) ; réserve :
3 médias retirés (contenu gardé vérifié), navire défusionné et bagnole supprimé pendant ce temps, pop-in « essai
voiture » / « essai bateau, essai navire » / « essai navire, essai vaisseau → essai bateau », tags restaurés justes ;
média aux deux tags fusionnés restaurés : notes justes, défusion exacte ; suppressions : principal case décochée
(défusion, nouveau principal) et cochée, tag fusionné avec la case (média sans le principal avant : retiré ; avec :
gardé), tag relié (groupe dissous), pop-in de plusieurs tags, ouverture par le clic droit puis « Annuler » ; zéro
erreur `tsc` et `clippy`.

## Correction : menu burger caché par la barre latérale (31/10/2026) — Backup v79

SPEC : GRID-14 (retour T3, point AUT.26), régression de la version v78.

- **Menu burger** : la correction des suggestions (v78) faisait passer la barre latérale de la bibliothèque devant le
  menu : il paraissait à moitié transparent et ses boutons ne répondaient plus. La barre latérale ne passe plus
  au-dessus de la zone fixe de la grille que pendant la frappe dans sa recherche (le seul moment où ses suggestions
  peuvent la recouvrir) ; le reste du temps, elle reste sous le menu, comme avant.

Vérifié dans la version compilée, sur une copie de la base d'essai `refonte` : menu ouvert, les 9 entrées sont bien
l'élément sous la souris, un vrai clic sur « Gestionnaire de Tags » ouvre le gestionnaire, capture : menu opaque ;
pendant la frappe, la liste des suggestions reste au-dessus de la zone fixe ; menu ouvert juste après la frappe : devant
la barre latérale ; zéro erreur `tsc`.

## Refonte des synonymes et des parents, lot R4-1 : suggestions « = », bulle des pastilles, onglet « Tags » au retour arrière, deux défauts (31/10/2026) — Backup v78

SPEC : livrés `[~]` : TAGM-15 (retour T3, points TAGM-15.25, TAGM-15.26, TAGM-15.27), TAGM-04 (point TAGM-04.14),
NAV-06 (point AUT.25), GRID-14 (point AUT.26).

- **Création d'un groupe** : les champs se vident dès que le groupe est créé ; plus de « Ces tags sont déjà des
  synonymes de… » ni de « ? » dans la nouvelle ligne pendant une fraction de seconde.
- **Suggestions** : un tag d'un groupe a l'icône « = » à gauche de son nombre de médias ; au survol, une zone à droite
  de la liste montre ses autres synonymes reliés et leur nombre (le principal d'abord, avec son étoile). Tag fusionné :
  inchangé (« X → Y »).
- **Pastilles de la recherche** : au survol, une bulle « = chaton = … » (« = −chaton… » pour un terme exclu), 6 lignes
  au plus puis « … + N », la description du tag dessous.
- **Onglet « Tags »** : le retour arrière / avant retrouve ses filtres, son tri, le nombre de tags affichés, les tags
  cochés et sa position ; une ouverture par un clic part de zéro.
- **Retour arrière depuis la recherche d'un tag** : l'onglet « Tags » revient directement, sans bibliothèque vide.
- **Suggestions de la barre latérale** : au-dessus de la zone fixe de la grille.

Vérifié dans la version compilée, sur une copie de la base d'essai `refonte` : création d'un groupe image par image
(240 images) : aucune avec « déjà » ni « ? », champs vides à la 4e image (la v77 : 5 images avec « déjà », 5 avec « ? ») ;
suggestions « essai bicyclette », « essai voiture », « essai caisse » : « = » et zone justes, « essai bagnole » et
« essai navire » (fusionnés) sans « = » ; bulles de « essai voiture », « −essai voiture », « essai maison » et d'un
groupe de 15 synonymes longs (6 lignes puis « … + 9 ») ; retour arrière depuis la recherche d'un tag, image par image :
aucune bibliothèque sans recherche (la v77 : une) ; page de l'onglet « Tags » (filtre « a », « Rares », tri par nom, 200
tags, 3 cochés, position 2 600 px) retrouvée à l'identique après la bibliothèque, l'avance et deux retours ; nouvelle
ouverture : neuve ; filtre de l'onglet des règles toujours retrouvé ; point commun liste des suggestions / zone fixe :
la liste est dessus ; zéro erreur `tsc` et `clippy`.

## Refonte des synonymes et des parents : tags existants, tags créés à la confirmation (30/10/2026) — Backup v77

SPEC : livrés `[~]` : TAGM-15, TAGM-16 (retour T3, points TAGM-15.23 et TAGM-15.24, nouveaux).

- **« Tag principal » et « Enfant »** : seulement un tag existant ; un nom qui n'est pas un tag est refusé, avec la
  raison ; « Tag principal » sans « … ».
- **« Synonymes » et « Parent »** : un nom nouveau passe par la pop-in « Créer un nouveau tag » (choix de la
  catégorie), mais le tag n'est créé en base qu'avec le groupe ou la règle ; pastille retirée ou règle annulée : rien
  n'est créé.

Vérifié dans la version compilée, sur une copie de la base d'essai `refonte` : textes « Tag principal », « Enfant »,
« Parent » ; « essai inconnu » en tag principal et « essai inconnu deux » en enfant : refusés, pas de pop-in, raison
affichée ; « essai nouveau un » en synonyme : pop-in, pastille, aucun tag en base, toujours rien après avoir retiré la
pastille ; « essai nouveau deux » : tag en base seulement après « Créer », dans le groupe d'essai maison ; « essai
nouveau trois » en parent : rien en base, ni après la pop-in de la règle annulée ; règle créée : tag en base, règle
présente, posé sur les 2 médias ; zéro erreur `tsc` et `clippy`.

## Refonte des synonymes et des parents : champs des règles de parents en pastilles (30/10/2026) — Backup v76

SPEC : livré `[~]` : TAGM-16 (retour T3, point TAGM-16.6).

- **Formulaire des règles** : « Enfant » et « Parent » deviennent des champs à pastilles, comme ceux des synonymes ;
  une seule pastille par champ : une fois le tag choisi, on ne peut plus qu'effacer sa pastille ; le texte d'aide
  disparaît quand une pastille est là ; « Enfant » et « Parent » sans « … ». Un tag fusionné tapé reste affiché en
  gris (la règle va sur son principal, la pop-in le dit).

Vérifié dans la version compilée, sur une copie de la base d'essai `refonte` : champs vides « Enfant » / « Parent »
(36 px) ; « essai demeure » + Entrée : pastille centrée (3 px au-dessus et en dessous), texte d'aide masqué ; « abc »
tapé ensuite : rien ne s'écrit ; dans « Parent », « essai demeure » grisé dans les suggestions ; « essai navire »
(fusionné) : pastille grise ; Retour arrière : pastille effacée, « Parent » revient ; « essai auto » puis Entrée :
pop-in « Créer la règle ? », règle créée, champs vidés ; zéro erreur `tsc` (pas de changement Rust).

## Refonte des synonymes et des parents : nettoyage des tags non utilisés (30/10/2026) — Backup v75

SPEC : livré `[~]` : TAGM-08 (retour T3, point TAGM-08.2).

- **« Supprimer les tags non utilisés »** : un tag sans média qui est dans un groupe de synonymes (fusionné ou non) ou
  dans une règle de parents (enfant ou parent) n'est plus proposé ; le message « N tags gardés » est retiré.

Vérifié dans la version compilée, sur une copie de la base d'essai `refonte` : « essai test x » sur 3 images,
« essai test y » sans média, règle « essai test x → essai test y » : « essai test y » n'est pas proposé, ni aucun tag
sans média des groupes (essai navire, essai vaisseau, essai bagnole, essai bicyclette, essai velo) ; « essai test
seul » (sans média, sans groupe ni règle) l'est ; plus de message « gardés » ; zéro erreur `tsc` (pas de changement
Rust).

## Refonte des synonymes et des parents, lot R3 bis : un tag fusionné reste un tag (30/10/2026) — Backup v74

SPEC : livrés `[~]` : TAGM-15 (retour T3, point TAGM-15.22), TAGM-08 (point TAGM-08.2, partie D15.1) ; TAGM-20
complété. Complément de D-047 (schéma 10).

- **Tag fusionné** : il reste un tag à part entière, sans média (ses médias reçoivent le principal) ; il apparaît dans
  le gestionnaire des tags, en gris, avec la bulle « Fusionné dans « Y » » ; la défusion lui rend ses médias.
- **Comme avant** : taper un tag fusionné donne le principal, les suggestions le proposent « X → Y », la recherche
  d'un nom trouve tout le groupe, la défusion est exacte.
- **Plus aucun synonyme sans tag** : un import de liste de tags crée le tag ; les noms fusionnés des bases existantes
  deviennent des tags (schéma 10).
- **Nettoyage des tags non utilisés** : les tags des groupes de synonymes sont gardés, avec le message.

Vérifié dans la version compilée, sur des copies des bases d'essai : `refonte` (schéma 9 → 10) : essai navire, essai
vaisseau et essai bagnole devenus des tags sans média, listes de médias gardées ; gestionnaire : « essai navire », 0
média, gris, « Fusionné dans « essai bateau » » ; « essai navire » tapé sur une image : essai bateau posé ; suggestions
« essai_navire → essai_bateau » ; recherche navire = bateau = vaisseau = 3 images ; défusion d'essai navire : le tag
revient sur ses 3 images (dont celle où il avait été tapé), refusion : 0 média, le tag existe toujours ; changement de
principal vers essai bagnole (fusionné) puis tout défusionner : chaque image retrouve exactement ses tags ; nettoyage :
« 4 tags gardés : ils sont dans un groupe de synonymes » ; `refonte-ancien` (schéma 7 → 10) : 49 groupes, 51 tags
fusionnés (aucun avec des médias), 2 reliés, aucun nom sans tag ; recherche « essai minou » 5, « essai toutou » 3,
« essai tou* » 3, « essai chat -essai matou » 0 (comme au lot R3) ; zéro erreur `tsc` et `clippy`.

## Refonte des synonymes et des parents, retouches du lot R3, 6e tour (30/10/2026) — Backup v73

SPEC : livrés `[~]` : TAGM-15 (retour T3, points TAGM-15.5 et TAGM-15.21 nouveau).

- **Champ « Synonymes »** : il se déplie au survol de ses 3 lignes de pastilles (plus seulement de la 3e).
- **Pop-ins de fusion** : « « X » est un tag posé sur N médias, ces médias : » ; avec 1 média : « sur 1 média, ce
  média : - obtiendra… - perdra… ».

Vérifié dans la version compilée, sur une copie de la base d'essai `refonte` : 20 pastilles : souris sur la ligne
d'écriture : rien ne se déplie ; sur la 1re, la 2e ou la 3e ligne : les 20 pastilles ; pop-in de fusion du groupe
d'essai voiture : « essai auto » (2 médias, pluriel) et « essai caisse » (1 média, singulier) ; zéro erreur `tsc` (pas
de changement Rust).

## Refonte des synonymes et des parents, retouches du lot R3, 5e tour (30/10/2026) — Backup v72

SPEC : livrés `[~]` : TAGM-15 (retour T3, points TAGM-15.5, TAGM-15.19) ; GEN-26 noté (flux audio, plus tard).
Complément de D-047.

- **Historique** : chaque ouverture de l'onglet par un clic est une nouvelle page, neuve ; le bouton 4 retrouve l'état de
  la page où l'on revient (champs, groupes dépliés, filtres, ordre, défilement), même après être allé ailleurs par un
  clic, avec les données à jour.
- **Changement de principal** : plus de saut de la ligne ni de « ? ».
- **Champ « Synonymes »** : un clic ailleurs le replie ; toutes les lignes de pastilles commencent au bord ; un nom qui
  n'est pas un tag ouvre « Créer un nouveau tag ».

Vérifié dans la version compilée, sur une copie de la base d'essai `refonte` : 22 pastilles : 1re pastille de chaque
ligne à 0 px du bord, replié et déplié (11 lignes) ; on écrit dans le champ déplié, souris partie : déplié ; clic sur le
titre du tableau : replié ; « essai cabane neuve » tapé en synonyme : pop-in « Créer un nouveau tag », tag créé,
pastille à la couleur de sa catégorie ; changement de principal relevé image par image pendant 2,5 s : la ligne reste
à sa place, jamais de « ? » ; page A (champ rempli, groupe déplié, filtre des parents) → clic « Tags » → clic
« Synonymes et parents » : page C neuve, ordre alphabétique ; fusion d'« essai maison » dans la page C ; bouton 4 deux
fois : page A retrouvée, avec « essai maison » fusionné ; avance deux fois : page C retrouvée ; lien « Gérer dans
« Synonymes et parents » » : nouvelle page filtrée sur « essai maison » ; zéro erreur `tsc` et `clippy`.

## Refonte des synonymes et des parents, retouches du lot R3, 4e tour (30/10/2026) — Backup v71

SPEC : livrés `[~]` : TAGM-15 (retour T3, points TAGM-15.5, TAGM-15.17, TAGM-15.19 et TAGM-15.20 nouveaux). Complément de
D-047.

- **Champ « Synonymes »** : il se déplie quand la souris arrive sur sa 3e ligne (sans marge), reste déplié pendant la
  frappe jusqu'au texte vide ; suggestions ouvertes : il ne se déplie pas ; 1re pastille alignée sur les autres lignes.
- **Groupe déplié** : étoiles sous la flèche ; noms par ordre alphabétique, le principal rangé avec les autres.
- **Ordre des groupes** figé jusqu'au rechargement de l'onglet : changer de principal ne déplace plus la ligne.
- **Retour arrière / avant** : l'onglet retrouve ses champs, ses groupes dépliés, son filtre, son ordre et son
  défilement ; un clic sur un onglet ou une autre page le remet à neuf.

Vérifié dans la version compilée, sur une copie de la base d'essai `refonte` : 20 pastilles : 1re pastille de chaque
ligne à 0 px du bord ; souris sous le champ, sur la ligne d'écriture ou sur la 1re ligne : rien ne se déplie ; sur la
3e ligne : les 20 pastilles ; on écrit « essai ma » dans le champ déplié et la souris s'en va : il reste déplié, la
liste s'ouvre sous la ligne d'écriture ; texte effacé : replié ; suggestions ouvertes, souris sur la 3e ligne : rien ne
se déplie ; flèche et étoiles du panneau au même x ; panneau « auto · bagnole · caisse · voiture★ », puis « auto★ ·
bagnole · caisse · voiture » après le changement de principal, la ligne du groupe à la même place ; bouton 4 puis
avance : 20 pastilles, groupe déplié, filtre et défilement des parents, ordre retrouvés ; clics sur « Tags » puis
« Synonymes et parents » : tout à neuf, ordre alphabétique ; zéro erreur `tsc` (pas de changement Rust).

## Refonte des synonymes et des parents, retouches du lot R3, 3e tour (29/10/2026) — Backup v70

SPEC : livrés `[~]` : TAGM-15 (retour T3, points TAGM-15.5, TAGM-15.16, TAGM-15.17, TAGM-15.18 nouveau), GEN-25 nouveau
(point AUT.23). Complément de D-047.

- **Pop-ins** (toutes) : 80 % de la hauteur de la fenêtre au plus ; titre, sous-titre et boutons fixes, le contenu défile.
- **Ligne d'un groupe** : principal en doré, long tiret, noms entiers puis « … + N » ; dépliée : trait fin, colonnes de
  droite alignées, dépliage animé.
- **Formulaire des synonymes** : « Fusionner » au-dessus de son interrupteur ; « Synonymes » limité à 3 lignes de
  pastilles puis « +N » (dépliage à l'approche de la souris) et ligne d'écriture dessous ; pastille trop longue coupée ;
  noms du groupe grisés dans les suggestions ; un nom relié tapé en principal le reste.
- **Aperçu** : nouveaux noms d'abord, soulignés en doré, puis ceux du groupe, puis « … » ; couleurs en direct.
- **Bulles** : interrupteurs (groupe, nom fusionné, « Fusionner ») et icône « i » avec les textes demandés.
- **Tableaux** : seuls le titre et le texte d'explication restent alignés ; le tableau des parents ne bouge plus quand
  le champ « Synonymes » grandit.

Vérifié dans la version compilée, sur une copie de la base d'essai `refonte` (groupe d'essai de 26 noms ajouté) : ligne
du groupe « essai lettres » : 2 noms entiers puis « … + 24 », aucun nom coupé, principal doré ; bulles des cinq
interrupteurs de groupe et d'un nom fusionné ; dépliage mesuré image par image (0 → 169 px en 190 ms environ, repli de
même) ; nombres, interrupteurs, croix et corbeille à la même position horizontale ; trait visible ; pop-in de fusion des
26 noms : 832 px = 80 % de la fenêtre, le texte défile, titre et boutons visibles ; « Fusionner » et son interrupteur
centrés l'un sous l'autre, 36 px ; aperçu vide avec le seul principal ; ordre et soulignement des noms ; « essai demeure »
fusionné dans la liste : gris aussitôt dans l'aperçu ; bulles de l'icône « i » ; « essai auto » tapé en principal : le
groupe d'« essai voiture » garde son principal ; suggestions « essai cagette » et « essai caisse » grisées ; pastille de
plus de 170 caractères : une ligne, dans le champ ; 27 pastilles : 3 lignes, « +22 », ligne d'écriture dessous, tag principal
centré, filtre des parents immobile ; souris sur le champ : les 27 pastilles par-dessus la liste, repli en s'éloignant ;
zéro erreur `tsc` et `clippy`.

## Refonte des synonymes et des parents, retouches du lot R3, 2e tour (29/10/2026) — Backup v69

SPEC : livrés `[~]` : TAGM-15 (retour T3, points TAGM-15.5, TAGM-15.16, TAGM-15.17, Q.4). Complément de D-047.

- **Formulaires alignés** : synonymes sur une ligne ([Tag principal] [Synonymes] [Fusionner] [Créer]) ; dessous, une
  ligne d'aperçu de hauteur fixe (« Résultat : ★ … », explications dans la bulle de l'icône « i », ou refus en
  rouge), visible quand chaque champ a une pastille ; les deux tableaux partagent leurs rangées : champs, boutons
  et barres « Filtrer par nom » alignés ; champs des parents à la même hauteur que ceux des synonymes.
- **Textes** : « Activer / Désactiver » partout à la place de « Allumer / Éteindre » ; bulle d'un nom relié
  « Activer la fusion » ; refus « Ces tags sont déjà des synonymes de « X » ».
- **Groupe déplié** : la ligne et son panneau forment un seul bloc.
- **Règle tapée avec un nom fusionné** : la pop-in dit que la règle est créée pour le tag principal.

Vérifié dans la version compilée, sur une copie de la base d'essai `refonte` : champs, boutons « Créer » et barres
« Filtrer par nom » des deux tableaux à la même hauteur (mesurés), aucun élément ne dépasse de son tableau ; aperçu
vide avec le seul principal, affiché avec un synonyme, filtres immobiles ; bulle de l'icône « i » ; refus au
singulier et au pluriel ; bulles des interrupteurs (« Activer la fusion », « … Désactiver la fusion la défait. ») ;
groupe déplié encadré avec sa ligne ; règle : bulle « Activée : … », menu « Désactiver la règle », badges
« désactivée » puis « activée » ; « essai navire » → « essai velo » : la pop-in dit « « essai navire » est fusionné
dans « essai bateau » : la règle est créée pour « essai bateau ». » ; zéro erreur `tsc` (pas de changement Rust).

## Refonte des synonymes et des parents, retouches du lot R3 (29/10/2026) — Backup v68

SPEC : livrés `[~]` : TAGM-15 (retour T3, points TAGM-15.5, TAGM-15.7, TAGM-15.15, TAGM-15.16), TAGM-16 (point
TAGM-16.5) ; réponse au point Q.4.

- **Textes** : explications des deux tableaux (synonymes sur deux lignes, parents) ; « Désactiver la fusion
  l'annulera. » ; bulle « Activer la fusion » ; suppression d'un groupe ; case de la création d'une règle « … ayant
  déjà … ».
- **Pop-in de fusion** : un nom sans média est cité (« n'est lié à aucun média pour le moment mais sera tout de même
  fusionné avec … »).
- **Formulaire des synonymes** : pastilles centrées ; « X = X » et noms déjà dans le groupe refusés (« Créer » grisé,
  la raison sous les champs) ; le badge compte les noms vraiment ajoutés.

Vérifié dans la version compilée, sur une copie de la base d'essai `refonte` : textes des deux tableaux, bulle,
pop-in de suppression du groupe et case de la création d'une règle (« Ajouter « essai auto » aux 2 médias ayant déjà
« essai demeure » ») lus dans la fenêtre ; pastilles à 3 px du haut et du bas de leur ligne dans les deux champs
(avant : 4,5 et 1,5) ; « essai maison » en synonyme puis en tag principal : « Créer » grisé et raison affichée ; nom
déjà dans le groupe : grisé aussi ; fusion du groupe d'essai maison (essai demeure, 2 médias ; essai cabane, sans
média) : la pop-in cite les deux ; création « essai velo » + « essai hutte » (1 média) + « essai cahute » (pas un
tag), fusion allumée : les deux cités, badge « 2 synonymes » ; règle tapée « essai navire » (fusionné dans essai
bateau) → « essai 123 » : la règle créée est « essai bateau → essai 123 », et taper « essai navire » sur une image
lui pose essai bateau et essai 123 (point Q.4) ; zéro erreur `tsc` (pas de changement Rust).

## Refonte des synonymes et des parents, lot R3 : groupes de synonymes (28/10/2026) — Backup v67

SPEC : livrés `[~]` : TAGM-15 (retour T3, points TAGM-15.4, TAGM-15.5, TAGM-15.6, TAGM-15.7, TAGM-15.13 ; refonte,
décisions D1, D2, D2.1, D2.2, D3, D3.1, D4, D4.1, D5, D5.1, D7, D12.1, D14), TAGM-16 (point TAGM-16.5) ; TAGM-20 et
DEV-07 complétés. Complément de D-047 (schéma 9).

- **Groupes de synonymes** : des noms reliés autour d'un tag principal ; chercher l'un trouve les médias de tous,
  l'exclure les exclut tous, joker compris. Rien ne change sur les médias tant qu'on ne fusionne pas.
- **Fusion par nom** : un interrupteur par nom et un pour le groupe (« à moitié » s'il est en partie fusionné) ; la
  défusion rend à chaque média exactement ses tags.
- **Ligne dépliable** : étoile pour changer de tag principal, croix pour retirer un nom, corbeille pour supprimer le
  groupe ; menus du clic droit.
- **Formulaire** : « Tag principal » et « Synonymes » en pastilles, interrupteur « Fusionner », aperçu du groupe obtenu ;
  pop-in de fusion avec ton texte (point TAGM-15.7).
- **Colonne « Synonymes »** du tableau : le groupe du tag, en lecture seule, avec un lien vers l'onglet.
- **Anciennes bases** : les anciens synonymes deviennent des groupes à la première ouverture.
- **Parents** (point TAGM-16.5) : bouton « Créer », case de la création sans « aussi ».

Vérifié dans la version compilée, sur des copies des bases d'essai : conversion de `refonte-ancien` (53 anciens
synonymes → 49 groupes, 51 noms fusionnés et 2 reliés, « essai clebs » devenu un tag sans média ; recherche
« essai toutou » 3 images, nom fusionné « essai minou » 5, joker « essai tou* » 3, « essai chat -essai matou » 0 ;
suggestion « essai minou → essai chat » ; défusion puis refusion de « essai minou » : chaque image retrouve exactement
ses tags) ; formulaire : aperçu (nom qui n'est pas un tag annoncé fusionné sans média), interrupteur éteint, groupe
créé, champs vidés ; recherche du groupe 4 images, exclusion 4, joker 4 ; ligne « à moitié », panneau ; fusion d'un
nom (pop-in au texte du point TAGM-15.7) puis défusion exacte ; « tout fusionner » depuis « à moitié » ; changement
de principal (4 images passent au nouveau), puis tout défaire : chaque image retrouve ses tags d'origine ; retrait
d'un nom (texte demandé) ; réunion de deux groupes (aperçu, puis groupe réuni) ; nom fusionné tapé sur une image :
principal posé et noté, rendu à la défusion ; colonne et son lien (onglet filtré sur le tag) ; suppression du groupe
(les tags restent) ; zéro erreur `tsc` et `clippy`.

## Refonte des synonymes et des parents, retouches du lot R2 : pop-ins des règles (28/10/2026) — Backup v66

SPEC : `[x]` (validés par toi) : points TAGM-16.2, TAGM-16.3 ; GEN-22 passe en `[~]`. Livré `[~]` : retouches de
TAGM-16.1. Complément de D-047.

- **Création** : « Créer la règle ? », bouton « Créer » ; « « E » → « P » » sur sa ligne, plus grand et plus clair,
  puis « À chaque ajout de « E » à un média, « P » lui sera aussi ajouté automatiquement. ».
- **Suppression** : les chaînes en colonnes, d'après ton croquis : la règle sur un gris plus clair, la suite de la
  chaîne sur un rouge pâle quand la case est cochée ; deux chaînes à la fois, les autres en faisant défiler vers la
  droite ; une longue chaîne défile dans sa colonne sans agrandir la pop-in ; nouveaux textes de la case et de sa
  précision.

Vérifié dans la version compilée, sur une copie de la base d'essai (règle « x → y » avec trois chaînes, dont une de
12 tags) : textes et bouton de la création (1re ligne 15 px et plus claire) ; texte de la suppression, 3 colonnes,
2 entières et environ 12 % de la 3e ; colonnes à 240 px, la longue défile et montre la règle ; fond rouge pâle de la
suite seulement case cochée ; la molette fait défiler vers la droite et la pop-in garde sa hauteur (554 px avant et
après) ; zéro erreur `tsc` et `clippy`.

## Refonte des synonymes et des parents, lot R2 : parents simplifiés (28/10/2026) — Backup v65

SPEC : livrés `[~]` : TAGM-16 (retour T3, points TAGM-16.1, TAGM-16.2, TAGM-16.3 ; refonte, décisions D10 à
D10.5) ; TAGM-20 et DEV-07 complétés. Complément de D-047 (schéma 8).

- **Un seul interrupteur par règle** : allumée, chaque nouvel ajout de l'enfant pose le parent ; éteinte, elle ne
  pose plus rien et ne retire rien ; rallumée, rien n'est rattrapé. « Auto » et les médias « sautés » disparaissent.
- **Création** : si des médias ont déjà l'enfant, la pop-in propose (case cochée) d'y poser aussi le parent.
- **Suppression** : la pop-in montre la chaîne et propose (case décochée) de retirer le parent des médias où la
  règle l'a posé, avec ce qui est venu avec lui en chaîne ; aussi depuis le menu du clic droit.
- **Champs** : ils ne se vident qu'à la confirmation. **Pop-ins** : un tag n'y est jamais coupé en fin de ligne.
- **Anciennes bases** : à la première ouverture, une règle cochée avec « Auto » devient allumée, toutes les autres
  éteintes ; aucun média ne change.
- **Base d'essai** : le modèle de `refonte` contient les cas du lot (images A à F, tags `essai_…`).

Vérifié dans la version compilée, sur des copies des bases d'essai : conversion de `refonte-ancien` (règles 1 et
« 123 → def » allumées, 2 à 4 éteintes, « Auto » et la table des « sautés » disparus, 133 511 liens tag-média et
53 synonymes inchangés, plus de case « Auto ») ; création : pop-in et case cochée, « Annuler » garde les deux champs,
case décochée = règle créée sans rien poser (champs vidés), case cochée = parent posé ; chaîne chaton → chat →
animal → être vivant posée d'un coup, et arrêtée sur un « chat » déjà là ; interrupteur : éteint ne retire rien et
ne pose plus, rallumé ne rattrape rien ; suppression : chaîne et « (3 médias) » affichés, case décochée, « Annuler »
depuis le menu du clic droit rend le menu, retrait seulement là où la règle l'a posé (un « animal » posé à la main et
un autre justifié par « chien → animal » restent) ; noms longs : chaque tag sur une seule ligne dans un texte de 4
lignes, copie en caractères ordinaires ; code de partage : règle « Auto » éteint importée éteinte, « Annuler » retire
ce que les règles importées ont posé ; zéro erreur `tsc` et `clippy`.

## Refonte des synonymes et des parents, lot R1 : bases d'essai (27/10/2026) — Backup v64

SPEC : nouvelle demande DEV-07 (retour T3, point AUT.21), livrée `[~]`. Notes ajoutées à TAGM-15 à TAGM-18 : la
refonte est décidée (document « Refonte synonymes et parents - décisions.md » : décisions D1 à D15, cas limites,
plan en 8 lots). Aucun changement de l'application.

- **Base `refonte`** (`échantillon test SFW\MyBoard-test\refonte`) : copie de `booru` (bonnes catégories), ses
  médias pointent vers `BooruScrap - 3k demo - Copie` ; 3 293 médias (les 7 dont le fichier n'est plus dans la copie
  sont retirés).
- **Base `refonte-ancien`** : la même, faite avec la version d'avant la refonte, pour tester la conversion : 46
  groupes de tags proches fusionnés au niveau « Large » (47 anciens synonymes, comme dans `booru-copy` : cattail →
  cat_tail, hands_up → hand_up…), et les cas A-01 à A-06 (tags `essai_…`, leur description dit le cas) : deux
  synonymes cochés vers le même tag, un nom seul coché, un synonyme décoché et un nom seul décoché, des règles dans
  les 4 états avec des médias « sautés », une règle déplacée par une fusion, une fusion faite sans garder l'ancien nom.
- **Trois fichiers à double-cliquer** dans `MyBoard-test` : « Lancer MyBoard - refonte », « Lancer MyBoard - refonte
  ancien format », « Remettre les bases refonte à zéro » (recopie les modèles de `refonte-modeles` ; refusé tant
  qu'un MyBoard tourne).

Vérifié : remise à zéro d'une base volontairement modifiée (contenu identique au modèle ensuite) ; refus quand
MyBoard tourne ; « Lancer » ouvre bien MyBoard sur `refonte` (dossier de données, version 7 après ouverture, 3 293
médias) ; dans la version compilée (inchangée), sur une copie : 25 vignettes visibles sur 25 chargées, une image GIF
et une vidéo lues depuis la copie des fichiers ; compteurs des tags et des médias justes après le retrait des 7 médias.

## Phase 3, correctifs du test, retouches du lot 16 : titres collés, espace fixe, retour en haut fluide (26/10/2026) — Backup v63

SPEC : `[x]` (validé par toi) : point TAGM-15.14. Livrés `[~]` : TAGM-04 (retouches des points TAGM-15.3 et
TAGM-04.13), GRID-14 (retouches des points AUT.5 et AUT.19, nouveau point AUT.20). Complément de D-046.

- **Gestionnaire** : la ligne des titres des colonnes garde sa bordure du haut et ses coins arrondis une fois
  collée, sans bouger d'un pixel.
- **Bibliothèque** : l'espace entre la pagination du haut et les vignettes reste fixe lui aussi.
- **Retour en haut** (filtre, tri, recherche) : il glisse, vite puis de plus en plus lentement.
- **Barre latérale** : plus de saut d'1 px au premier défilement.

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » (fenêtre de 1 040 px) :
bibliothèque : haut fixe de 89 à 205 px au repos comme défilé (espace de 16 px compris), juste dessous : les
vignettes ; barre latérale de 89 à 1 040 px au repos comme défilée (avant : 88 une fois défilée, et 1 041 en bas) ;
gestionnaire : titres des colonnes de 245 à 283 px au repos comme collés, bordure de 1 px sur les quatre côtés,
coins arrondis, case « tout cocher » à 10 / 10 px entre les bordures ; retour en haut relevé image par image :
bibliothèque (type de média) de 3 000 px à 0 en 0,3 s, toujours en descendant ; gestionnaire (tris Nom, Médias,
Catégorie, « Rares », filtre « a ») : toujours en descendant, fin en 0,35 s environ. Deux défauts trouvés et
corrigés avant la livraison : la 1re image de l'animation, datée un peu avant son lancement, envoyait la page en
bas (3 000 → 3 262 px) avant de remonter ; et une image lente (tri de 13 106 tags) la faisait sauter de 3 000 à
648 px.

## Phase 3, correctifs du test, lot 16 : haut de page fixe, onglet des règles, retour en haut (26/10/2026) — Backup v62

SPEC : `[x]` (validés par toi) : SRCH-26 ; points TAGM-13.5, TAGM-13.6, SRCH-26.1 à SRCH-26.3. Livrés `[~]` :
TAGM-04 (points TAGM-15.3 et TAGM-04.13), GRID-14 (points AUT.5 et AUT.19), TAGM-15 (point TAGM-15.14).
Décision D-046.

- **Gestionnaire de tags** : les onglets, l'en-tête de la page, les filtres et les titres des colonnes restent en
  haut pendant le défilement ; un nouveau filtre ou tri ramène en haut.
- **Bibliothèque** (essai) : les filtres et la ligne du titre et de la pagination restent en haut ; une autre
  page, un autre filtre, tri ou recherche ramène en haut.
- **Synonymes et parents** : la page ne défile plus ; chaque tableau a sa barre de défilement et s'arrête au bas
  de la fenêtre.

Vérifié dans la version compilée, sur des copies de la bibliothèque « booru » (fenêtre de 1 040 px) :
bibliothèque défilée de 1 500 px : haut fixe de 89 à 189 px, exactement à sa place de départ, les vignettes
passent dessous ; tri « Anciens », type de média, recherche « 1girl », nom de fichier « png » : retour en haut ;
Ctrl + molette : la page reste à 800 px ; gestionnaire défilé de 3 000 px : haut fixe de 89 à 245 px (comme au
départ), titres des colonnes collés dessous (245 à 282), fond opaque, les lignes passent dessous ; filtre
« hair », tri par nom, « Rares » : retour en haut ; « Afficher 100 de plus » : la page reste à 2 000 px ;
« Synonymes et parents » avec 80 synonymes d'essai (copie jetable, supprimés ensuite) : page de 1 008 px pour
1 008 visibles (aucun défilement), liste des synonymes de 599 px visibles pour 2 820, molette dans la liste :
elle défile, jusqu'au bout, sans faire bouger la page ; fenêtre de 720 px (simulée) : listes de 279 px, pied de
page en bas ; l'onglet « Tags » défile toujours (4 270 px pour 1 008).

## Phase 3, correctifs du test, lot 15 : recherche par nom de fichier, pluriels français (26/10/2026) — Backup v61

SPEC : livrés `[~]` : SRCH-26 (points SRCH-26.1, SRCH-26.2, SRCH-26.3), TAGM-13 (point TAGM-13.6). Notés le
26/10 : FUT-11 (détection des tags proches par le sens, IA locale), FUT-08 et FUT-09 complétés.

- **Pastille du nom de fichier** : loupe et texte à la même hauteur que la croix et que le texte des tags.
- **Exclure un nom de fichier** : bouton « Contient / Exclut » dans « Rechercher un fichier », ou « -abc » tapé ;
  pastille « −abc » rayée ; « Exclure ce nom » / « Inclure ce nom » dans le menu de la pastille.
- **Page sans résultat** : bouton « Effacer la recherche par nom ».
- **Tags proches, Large** : pluriels français (« oiseaux » ~ « oiseau », « chevaux » ~ « cheval »).

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » : bouton « Contient » (doré) calé
sur la loupe du champ (bords droits à 275 px), ligne du titre toujours de 28 px, clic : « Exclut » (rouge), 2e
clic : « Contient » ; « png » : 579 médias, Exclut + « png » : 2 729 (579 + 2 729 = 3 308, toute la
bibliothèque), « -png » tapé : 2 729 ; après la recherche, le bouton revient à « Contient » ; pastille « −png »
rayée, bulles justes ; menu : « Inclure ce nom » (579) puis « Exclure ce nom » (2 729) ; avec le tag « 1girl » :
423 avec « png », 1 856 sans (423 + 1 856 = 2 279, tous les « 1girl ») ; pastilles « png » et « 1girl » : 22 px
de haut, texte à 1 / 5 px, croix et loupe à 5 / 5 px ; exclut « . » : « Aucun fichier dont le nom ne contient
pas « . » dans la bibliothèque. », bouton « Effacer la recherche par nom » : 3 308 médias ; tags d'essai sur une
copie jetable : en Large, « zz cheval ~ zz chevaux », « zz jeu ~ zz jeux », « zz oiseau ~ zz oiseaux », « zz bijou
~ zz bijoux », « zz journal ~ zz journaux » (la 1re version groupait mal « oiseaux » : ordre des règles corrigé
avant la livraison) ; en Strict, aucun ; tags d'essai supprimés.

## Phase 3, correctifs du test, lot 14 : détection Strict / Large des tags proches (26/10/2026) — Backup v60

SPEC : `[x]` (validés par toi) : TAGM-08 ; points TAGM-04.11, TAGM-04.12, TAGM-13.4, TAGM-08.1 (TAGM-13.3
gardé `[~]` jusqu'à la refonte TAGM-15 / 16). Livré `[~]` : TAGM-13 (point TAGM-13.5).

- **Tags proches** : « Détection : Strict | Large » en haut de la pop-in. Large trouve aussi les noms qui ne
  diffèrent que par le « s » d'un mot (« hand on own hip » ~ « hands on own hips ») ou par l'ordre des mots
  (« unicorn gundam » ~ « gundam unicorn »). Le choix est retenu, et le compteur du bouton le suit.

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » faite pour l'essai : Strict :
« Tags proches (20) », 20 groupes, 1er « fang ~ fangs » (comme avant) ; Large : 47 groupes, bouton « Tags
proches (47) », liste remise en haut, tous les groupes de Strict y sont, « hand on own hip ~ hands on own
hips », « hand on own knee ~ hands on own knees ~ hands on own knee », « unicorn gundam ~ gundam unicorn » ;
« Tout fusionner » : « Fusionner les 47 groupes ? » (Annuler) ; Ignorer le groupe « hand on own knee » en
Large : 46 groupes, et en Strict « hands on own knees ~ hands on own knee » reste proposé ; Large retenu après
fermeture de la pop-in, rechargement et redémarrage de l'application (46 groupes), puis remis en Strict.

## Phase 3, correctifs du test, lot 13 : filtres, « Tout fusionner », « Tags proches » partout (26/10/2026) — Backup v59

SPEC : `[x]` (validés par toi) : points TAGM-11.3, TAGM-13.1, TAGM-13.2, AUT.18 (GEN-24 gardé `[~]` comme
principe). Livrées `[~]` : TAGM-04 (points TAGM-04.11, retouche, et TAGM-04.12), TAGM-13 (points TAGM-13.3,
TAGM-13.4), TAGM-08 (point TAGM-08.1).

- **Filtres du gestionnaire** : la croix du champ reste affichée, grisée quand il est vide ; le compteur « N / X
  tags » ne rétrécit plus, rien ne bouge quand N change.
- **Tags proches** : « Tout fusionner », avec confirmation, fusionne tous les groupes d'un coup ; le bouton
  « Tags proches » est aussi dans l'onglet « Synonymes et parents ».
- **Supprimer les tags non utilisés** : grisé, il dit pourquoi (« Aucun tag non utilisé »).

Vérifié dans la version compilée, sur des copies de la bibliothèque « booru » : croix grisée, sans bulle,
curseur « interdit » champ vide, active avec « long », clic : champ vidé, curseur dans le champ ; compteur de
« 13 106 / 13 106 » à « 0 / 13 106 » (filtres « hair », « long », « zz5m », « zzzzzz ») : même place au
dixième de pixel près (104,9 px), champ et filtres immobiles ; onglet « Synonymes et parents » : « Tags proches
(20) » seul, collé au bord droit de l'en-tête, pop-in, loupe et retour arrière qui la rouvre dans cet onglet ;
sur une copie faite pour l'essai : « Tout fusionner » (doré, à droite de « Fermer »), « Fusionner les 20
groupes ? », Annuler : rien ne change, Entrée : 13 106 → 13 086 tags, 20 synonymes créés, le nom gardé choisi
à la main (« fangs ») a reçu les médias de « fang », pop-in « Aucun tag proche à fusionner. » sans le
bouton ; après suppression du seul tag non utilisé, bouton grisé avec la bulle « Aucun tag non utilisé ».

## Phase 3, correctifs du test, lot 12 : molette, croix du filtre, loupe des tags proches (26/10/2026) — Backup v58

SPEC : `[x]` (validées par toi) : TAGM-11 ; points TAGM-04.5, TAGM-04.7, TAGM-04.8, TAGM-04.9, TAGM-11.1.
Livrées `[~]` : GEN-24 (nouvel ID, point AUT.18), TAGM-04 (point TAGM-04.11), TAGM-13 (points TAGM-13.1,
TAGM-13.2). Nouveau point TAGM-13.5 (sensibilité, lot à part) ; TAGM-11.2 reporté à la refonte TAGM-15.13.
Décision D-045.

- **Molette en roue libre** : après « Afficher 100 de plus » ou « Page suivante », le défilement continue sans
  bouger la souris.
- **Gestionnaire de tags** : une croix au bout du champ « Filtrer par nom… » efface le texte.
- **Tags proches** : une loupe au bout de chaque tag lance sa recherche ; le retour arrière rouvre la pop-in
  telle qu'on l'a quittée.

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » : molette avec de vraies entrées
Windows (200 crans par seconde, puis 500 demi-crans par seconde avec le curseur posé en cours de route), clic
sur la languette arrivée sous le curseur : le défilement continue (3 905 et 3 909 px, sans bouger ; avant la
correction : 7 à 9 px malgré plus de 400 crans reçus, puis reprise après 15 px de déplacement) ; « Page
suivante » de la bibliothèque arrivé sous le curseur : page 2, retour en haut, puis descente jusqu'en bas
(4 441 px) sans bouger ; croix : absente champ vide, présente avec « long » (38 / 38), clic : champ vidé,
curseur dans le champ, croix partie, « 100 / 13 106 » ; « Tags proches » : 40 loupes, bulle « Rechercher
« fang » » ; 2e nom gardé, case décochée, liste défilée de 300 px, loupe d'un tag : la bibliothèque cherche ce
tag, le nom gardé de son groupe n'a pas changé ; bouton 4 de la souris : la pop-in revient à 300 px avec les
mêmes choix ; Échap : fermée ; avance puis retour : elle ne revient plus ; rouverte par le bouton : choix par
défaut.

## Phase 3, correctifs du test, lot 11 : création d'un tag, confirmation, Échap (25/10/2026) — Backup v57

SPEC : `[x]` (validé par toi) : point TAGM-04.6. Livrées `[~]` : TAGM-04 (retouches des points TAGM-04.5 et
TAGM-04.7, points TAGM-04.8 et TAGM-04.9), TAGM-11 (point TAGM-11.1).

- **« Afficher 100 de plus »** : en languette accrochée au bas du tableau, centrée ; « N / X tags affichés »
  dessous, centré.
- **Tris** : colonnes Description, Synonymes et Parents élargies (84 px) : la flèche du tri a sa place.
- **Créer un tag** : bouton doré « + Créer un tag » en tête de la page ; pop-in avec le nom et la catégorie ;
  nom déjà pris refusé ; le filtre montre ensuite le nouveau tag.
- **Catégorie de plusieurs tags** : confirmation « Changer la catégorie de N tags ? » dès 2 tags cochés.
- **Échap** décoche tous les tags (hors d'un champ, rien d'ouvert par-dessus).

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » (fenêtre 1920 × 1040) : colonnes
nom 570 px (618 avant), Description / Synonymes / Parents 84 px ; flèche du tri de 12 px entière, à 22 px de
« Synonymes » (tri Description), 33 px de « Parents », 48 px de « Actions » ; languette collée au bord du bas du
tableau (sans bord du haut, coins du bas arrondis), centrée au pixel, « 100 / 13 106 tags affichés » 8 px
dessous, centré ; clic : 200 ; filtre « zz5 » : « 10 / 10 tags affichés » sans languette ; « Créer un tag »
doré, 1er de l'en-tête ; pop-in : focus dans le nom, « Général » par défaut ; vide : « Créer » grisé ;
« zz5 long hair » : « Ce tag existe déjà » ; « zz5m cats » : « C'est déjà un synonyme de « zz5m cat » » ;
« zz5i minou » (synonyme décoché) : « Créer » actif ; Entrée sur « zz l11 essai » : créé en « Général », sans
média, pop-in fermée, filtre « zz l11 essai » (une ligne), message « Tag « zz l11 essai » créé » ; « zz l11
deux » en « Artiste » par le bouton « Créer » ; Échap dans la pop-in : rien de créé ; clic droit dans le nom :
menu des champs ; 2 tags cochés, « Méta » : « Changer la catégorie de 2 tags ? », « Les 2 tags cochés
passeront dans la catégorie « Méta ». », « Changer » ; Annuler : rien ne change, toujours cochés ; Entrée : les
2 en « Méta » ; Échap dans la confirmation : rien ne change, toujours cochés ; 1 tag coché, « Général » :
changé sans pop-in ; Échap dans le filtre : toujours cochés ; Échap hors d'un champ : tout décoché ;
renommage puis Échap : le champ se ferme, la case reste cochée, un 2e Échap décoche. Tags d'essai supprimés.

## Phase 3, correctifs du test, lot 10 : gestionnaire de tags, 100 par 100, renommage, tris (25/10/2026) — Backup v56

SPEC : `[x]` (validées par toi) : VIEW-27, VIEW-30 ; points TAGM-04.3, TAGM-04.10, AUT.6, AUT.17 validés.
Livrées `[~]` : TAGM-04 (points TAGM-04.5, TAGM-04.6, TAGM-04.7).

- **100 tags à la fois** : « Afficher 100 de plus » sous le tableau, avec le nombre affiché ; la case de
  l'en-tête coche les tags affichés ; « Sélectionner les N tags » (barre des actions groupées) coche tous les
  tags du filtre ; « Catégorie » devient « Modifier la catégorie ».
- **Renommage** : bouton ↵ au bout du champ, qui valide comme Entrée.
- **Tris** : Description, Synonymes et Parents, par un clic sur le titre de la colonne (un 2e clic inverse).

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » : « 100 / 13 106 tags affichés »,
« Afficher 100 de plus » : 200 puis 300 (tableau de 200 lignes de 39 px), nouveau tri : 100 ; filtres
« long » (38 / 38) et « zz5 » (10 / 10) ; case de l'en-tête : « 100 cochés », « Sélectionner les 13 106
tags » : « 13 106 cochés », bouton grisé ; filtre « long », une case : « Sélectionner les 38 tags » : « 38
cochés » ; « Modifier la catégorie » ; tag d'essai renommé par le bouton ↵ (« zz_l10_essai_bis » en base,
champ fermé) puis supprimé ; tris : Description (« zz5 long hair », « zz5 longhair », « zz5i felin » puis
les autres de A à Z), Synonymes (« zz5i felin », « zz5m cat », « zz5m d »), Parents (« zz5p animal » avec 2
parents, puis « zz5i felin », « zz5p chat ») ; 2e clic : ceux qui n'en ont pas d'abord, de A à Z.

## Phase 3, correctifs du test, lot 9 : historique de la visionneuse, retouches du gestionnaire (25/10/2026) — Backup v55

SPEC : livrées `[~]` : VIEW-27 (points AUT.6, AUT.17), VIEW-30 (changé, à revalider), TAGM-04 (points
TAGM-04.3, TAGM-04.10). Décision D-044.

- **Retour arrière / avant** : ouvrir un média est une vraie étape. Grille → média → clic sur un tag → retour
  = le média (avec la recherche d'avant) → retour = la grille ; l'avance refait le chemin. Une seule étape par
  visionneuse, qui garde la dernière image vue. Bouton 4 dans la visionneuse : vrai retour ; croix, Échap ou
  clic sur le fond : fermeture avec une nouvelle étape (le bouton 4 rouvre alors l'image).
- **Gestionnaire de tags** : « Créé le » au centre ; case centrée au pixel près dans sa zone (lignes de 39 px).

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » : 1re vignette, clic sur son tag
« zz test suppression », ← : la visionneuse revient sur « ro-2.jpg » sans la recherche, ← : la grille, → : le
média, → : la recherche du tag ; 2e vignette puis → ×5 (« test-4.jpg »), ← : la grille, → : la même image,
→ sans effet (flèche grisée) ; croix puis ← : l'image rouvre, ← : la grille ; Échap puis ← : l'image rouvre ;
bouton 4 de la souris dans la visionneuse : la grille ; Alt + → / Alt + ← ; flèches de la barre de titre
grisées ou non comme il faut à chaque étape ; gestionnaire : zone de la case 44 × 38 px, 14 / 14 / 11 / 11 px
autour de la case, en-tête 14 / 14 / 10 / 10, ligne de 39 px, nom 9 / 9, catégorie et œil 5 / 5, date et son
en-tête centrés ; clic au dernier pixel droit de la zone : case cochée, 1 px plus loin : recherche du tag
(le nom) ; image d'essai « ro-2.jpg » ouverte, fermée, retirée de la bibliothèque (fichier gardé), puis
rechargement et ← sur son étape : la visionneuse montre « lock-1.jpg », qui a pris sa place ; « ro-2.jpg »
réimporté ensuite.

## Phase 3, correctifs du test, lot 8 : gestionnaire de tags, + / − de la recherche (25/10/2026) — Backup v54

SPEC : livrées `[~]` : TAGM-04 (points TAGM-04.1 à TAGM-04.4, TAGM-15.2), SRCH-29 (retouche). Nouveau point
AUT.17 noté dans VIEW-27 (lot 9, avec AUT.6).

- **Gestionnaire de tags** : deux vrais onglets « Tags » et « Synonymes et parents » sur toute la largeur,
  juste sous l'en-tête ; page plus large (72 % de la fenêtre) ; « Créé le » à droite, « Actions » au centre ;
  toute la colonne de la case est cliquable.
- **Recherche** : un tag déjà cherché n'est plus grisé (on peut relancer une recherche avec lui seul) ; seul
  son + ou son − inutile est grisé, avec sa bulle.

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » : onglets de 0 à 1 910 px (barre de
défilement à droite), collés sous l'en-tête, 955 + 955 px, l'actif en doré, bascule dans les deux sens ;
largeur : 1 382 px fenêtre agrandie (tableau 1 104 → 1 334 px), 1 152 px en « Niveau inférieur » (1 600 px de
large), toute la largeur à 1 100 px ; « Créé le » et son en-tête finis au bord droit de la colonne, groupe des
actions et son en-tête au centre ; case cochée par un clic à 2 px du bord de la ligne et à 4 px à droite de la
case, « tout cocher » par un clic à côté ; recherche « long_hair smile blue_eyes » : « long hair » au nom
normal, + grisé (bulle « déjà inclus »), sans effet au clic, − actif (passe en exclusion), puis − grisé
(« déjà exclu ») et + actif ; clic sur le nom « blue eyes », Entrée : nouvelle recherche avec lui seul ;
« smile smi » : « smile » au nom grisé (« champ textuel »).

## Phase 3, correctifs du test, lot 7 (suite) : retour du champ de recherche, tags déjà là grisés (25/10/2026) — Backup v53

SPEC : `[x]` (validées par toi) : SEL-12 (points SEL-07.7, SEL-07.11, SEL-07.12), point AUT.16 (PAGE-04 reste
`[x]`). `[-]` : SRCH-28, abandonné (ton choix). `[~]` : SRCH-29, revu.

- **Recherche de la barre latérale** : de nouveau le champ texte d'avant le lot 7 (plusieurs mots, + / −).
- **Tags déjà là** : ils restent à leur place dans les suggestions, grisés, avec une bulle qui dit pourquoi
  (déjà sur l'image, déjà dans la recherche, déjà exclu, déjà tapé, déjà sur tous les médias cochés…). Les
  flèches les sautent, un clic sur leur nom ne fait rien ; dans la recherche, + / − restent actifs : on peut
  de nouveau exclure un tag déjà cherché.

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » : champ de recherche (case de
saisie) ; recherche « long_hair smile », puis « long_h » : « long hair » grisé en tête (bulle « déjà inclus
dans cette recherche »), ↓ le saute, clic sur son nom sans effet, son « − » le passe en exclusion
(« −long hair »), puis bulle « déjà exclu » ; « blue_eyes smile blue_e » : « blue eyes » grisé (« champ
textuel ») ; visionneuse : tag du média grisé (« cette image ») ; sélection : tag commun aux 2 médias grisé
(« tous les médias sélectionnés »), pastille écrite grisée, ↑ la saute ; import et formulaire de règle :
grisés avec leur bulle ; liste des synonymes de « highres » : « highres » grisé (« C'est le tag lui-même ») ; pagination du haut après une recherche d'un média ; essais du champ à pastilles
(lot 6) refaits.

## Phase 3, correctifs du test, lot 7 : recherche à pastilles, suggestions, copier-coller (25/10/2026) — Backup v52

SPEC : `[x]` (validée par toi) : SEL-07 ; points SEL-07.4, SEL-07.6, SEL-07.8, SEL-07.9, SEL-07.10 validés.
Livrées `[~]` : SRCH-28, SRCH-29, SEL-12 (points SEL-07.11, SEL-07.12) ; PAGE-04 corrigé (point AUT.16).

- **Recherche de la barre latérale** : un champ à pastilles. Un mot devient une pastille à l'espace ou au
  choix d'une suggestion ; Entrée ou le bouton lancent la recherche avec tout ce qui est écrit, et le champ
  se vide ; les termes de la recherche restent dans la ligne du dessous ; + / − ajoutent directement.
- **Suggestions sans les tags déjà là** (recherche, visionneuse, barre de la sélection, tags par défaut de
  l'import, règles) ; « Ajouter » de la sélection écarte aussi les tags déjà sur tous les médias cochés. La
  liste garde ses 10 suggestions.
- **Pastilles** : double-clic = la pastille ; copiées, elles se collent comme pastilles dans les champs à
  pastilles de MyBoard, et comme texte ailleurs.
- **Pagination du haut** : elle revient bien centrée sur la fenêtre après une recherche d'une seule page.

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » : recherche « incredibly
absurdres » (1 média), retour : page active du haut à 960 px (1 099 px avec la version d'avant, défaut
reproduit) ; champ de recherche : « long_hair » + espace, « -smile » + espace (pastille rayée), Entrée (3
termes lancés, champ vidé), « long_h » sans « long hair », « smi » sans « smile », + d'une suggestion
(ajouté directement), suggestion choisie (pastille, rien de lancé), bouton (nouvelle recherche) ;
visionneuse : le tag du média n'est pas proposé ; sélection : tag commun aux 2 médias écarté (commande du
cœur Rust : 1 tag commun, 1 d'après la base), pastilles écrites écartées ; tags par défaut de l'import et
formulaire de règle : « long_hair » écarté ; double-clic sur une pastille ; Ctrl + C (texte copié
« zz_l7_a zz_l7_b », presse-papiers sauvé puis remis), Ctrl + V (doublons écartés), Ctrl + X puis Ctrl + V,
collage dans la recherche, collage dans « Retirer » (le tag absent de la sélection écarté), Copier / Coller
du menu du clic droit ; essais du lot 6 (champ à pastilles) et de la visionneuse refaits.

## Phase 3, correctifs du test, lot 6 (suite) : champ à pastilles éditable (25/10/2026) — Backup v51

SPEC : `[x]` (validées par toi) : SEL-03 ; points SEL-03.2, SEL-07.2, AUT.14 validés. Livrées `[~]` : SEL-12
(points SEL-07.6, SEL-07.7, SEL-07.9, SEL-07.10), SEL-07 (point SEL-07.8). Décision D-043.

- **Champ « Ajouter / Retirer des tags »** : une petite zone éditable. On peut taper à plusieurs endroits
  (les suggestions suivent le texte où est le curseur) ; un clic entre deux pastilles y place le curseur ; un
  cliquer-glisser (ou Maj + flèches) sélectionne textes et pastilles, effacés d'un seul Retour arrière ;
  Ctrl + A : le texte, puis tout ; pastilles sélectionnées dorées comme un texte surligné ; Ctrl + Z défait
  une frappe entière ; menu d'édition du clic droit ; une pop-in de création annulée laisse le texte.
- **« Appliquer » grisé par un texte tapé** : bulle « Valide ou efface d'abord le texte tapé ».
- **Fin du mode sélection** (Échap, « Terminer ») : les deux champs se vident.

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » : textes tapés à deux endroits
(liste de suggestions à 86 px puis 259 px, sous chaque texte), Entrée sur un texte, bulle et « Appliquer »
grisé ; clics au milieu des écarts de 4 px et à 1 px des pastilles : curseur entre les bonnes pastilles ;
clic dans le vide : à la fin ; glisser depuis le début, depuis la moitié droite puis gauche d'une pastille ;
Retour arrière sur la sélection puis Ctrl + Z ; double-clic, triple-clic ; Ctrl + A dans un texte, 2e Ctrl + A,
hors texte ; Maj + ←, Maj + Fin, Maj + Début, Suppr à travers une pastille ; « abc » défait en une fois, effacements aussi ; accent « ê » par composition ;
Ctrl + C (presse-papiers sauvé puis remis), menu du clic droit (Tout sélectionner, Couper, Annuler) ; tag
inconnu : pop-in annulée (texte gardé) puis créé ; Entrée : 4 tags d'essai posés sur les 2 médias, 2 retirés
par « Retirer » ; halo et bordure dorée ; « Terminer » et Échap : champs vidés ; recherche de la barre latérale
et ajout de tag de la visionneuse (liste partagée) inchangés ; essais des sous-menus refaits.

## Phase 3, correctifs du test, lot 6 : halo, pastilles, menu qui suit sa vignette (24/10/2026) — Backup v50

SPEC : livrées `[~]` : SEL-03 (retouche du point SEL-03.2), SEL-07 (point SEL-07.2 refait), nouvelle SEL-12
(point SEL-07.4), GEN-23 (point AUT.14).

- **Champ signalé depuis le menu ⋮** : le halo doré remplit tout le champ et l'entoure ; ensuite, la
  bordure du champ de la barre de la sélection qui a le focus reste dorée (#d9a94e).
- **Ctrl + Z / Ctrl + Y dans les champs de la barre de la sélection** : comme dans un éditeur de texte,
  ajouts compris ; une nouvelle action après des Ctrl + Z abandonne la suite (plus de doublons).
- **Curseur entre les pastilles** : ← / →, Début / Fin, clic sur une pastille ou dans le vide ; Retour
  arrière et Suppr effacent la pastille avant / après le curseur ; un tag validé s'insère au curseur. Un
  texte tapé pas encore validé reste en place, le curseur peut le quitter ; « Appliquer » attend qu'il soit
  validé ou effacé.
- **Menu ouvert sous une pop-in** : quand la fenêtre change de taille, il suit la vignette (ou le bouton)
  sur laquelle il a été ouvert, sous-menu compris.

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » : menu d'une vignette sous la
pop-in « Supprimer », fenêtre rétrécie de 70 px par la gauche (vignette déplacée de 53 px et réduite de 308 à
290 px : le menu reste au même endroit de la vignette), remise, agrandie, niveau inférieur : idem ; sous-menu
ouvert par un clic sous la pop-in « Créer un dossier… » : il reste collé au menu ; menu ⋮ de la sélection :
reste sous son bouton ; halo : fond doré et lueur intérieure pendant l'effet, bordure #d9a94e après ;
exemple du retour (4 tags, Ctrl + Z ×4, les 5 tags réécrits) : Ctrl + Z retire « e » puis « d », sans
doublon ; Ctrl + Y, puis une nouvelle étape : Ctrl + Y et Ctrl + Maj + Z sans effet ; croix puis Ctrl + Z ;
←, →, Début, Fin, Retour arrière et Suppr au milieu, tag validé inséré au curseur, écarts de 4 px gardés ;
texte « zz » au milieu : curseur sorti du texte (sans suggestions, curseur du texte caché), lettre ignorée,
pastille voisine effacée puis remise par Ctrl + Z, retour dans le texte par ses deux bords, Entrée sans effet
et « Appliquer » grisé tant que le texte est là ; clics sur une pastille et dans le vide ; Entrée : 3 tags
d'essai posés sur les 2 médias, 2 retirés par le champ « Retirer » ; essais des lots 5 et 1 (sous-menus)
refaits.

## Phase 3, correctifs du test, lot 5 : fenêtre, rectangle, barre de la sélection (24/10/2026) — Backup v49

SPEC : livrées `[~]` : GEN-23 (corrigé), SEL-06 (point SEL-06.2), SEL-03 (points SEL-03.1, SEL-03.2),
SEL-07 (points SEL-07.2, SEL-07.3).

- **Pop-in ouverte depuis un menu** : « Agrandir », « Réduire » et le double-clic sur la barre de titre
  ne la ferment plus ; le menu reste dessous et se replace dans la fenêtre.
- **Rectangle de sélection** : dessiné dès son point de départ, même hors de la grille.
- **Menu ⋮ de la sélection** : nouvelle entrée « Retirer des tags de la sélection » ; le champ qui reçoit
  le curseur depuis le menu s'entoure d'un halo doré qui pulse deux fois.
- **Barre du bas de la sélection** : champ vide, Retour arrière efface la dernière pastille, Ctrl + Z la
  remet, Ctrl + Y l'efface de nouveau ; Entrée dans un champ vide = « Appliquer ».

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » : pop-in ouverte depuis le
menu d'une vignette, puis « Niveau inférieur » (menu replacé dans la fenêtre), double-clic sur la barre
de titre, « Réduire » puis rétablir : la pop-in reste ; Échap la ferme et laisse le menu ; menu seul :
fermé au changement de taille ; rectangle depuis la barre des filtres (haut à 125 px, grille à 205 px) et
depuis la barre latérale (bord gauche au point de départ) ; menu ⋮ : nouvelle entrée, curseur et halo
(parti après 1,6 s) ; pastilles : Retour arrière ×2, Ctrl + Z ×2 (ordre retrouvé), Ctrl + Y, texte
« ab » + Retour arrière (seul le texte change) ; Entrée : 2 tags d'essai posés sur les 2 médias puis
retirés de même ; essais des lots 1 et 3 refaits.

## Phase 3, correctifs du test, lot 4 : dossiers de la sélection, badge, surlignage (24/10/2026) — Backup v48

SPEC : livrées `[~]` : SEL-08 (SEL-08.1, SEL-08.2), FOLD-14, nouvelle GEN-23 ; retouches de SEL-06 (25 %,
surlignage) ; GRID-13 précisée.

- **Liste des dossiers d'une sélection** (clic droit d'une vignette cochée, menu ⋮) : ✓ et « 20 / 20 »
  quand un dossier contient toute la sélection, « – » et « 7 / 20 » quand il en contient une partie.
- **« Ajouter / Retirer d'un dossier »** quand le média est déjà dans un dossier (menu d'une vignette,
  bouton D de la visionneuse) ; pour une sélection, quand un dossier les contient tous.
- **Badge des ajouts** (dossiers, favoris, et gestionnaire de tags) : plus grand, bordure dorée, 3 s,
  centré dans la fenêtre sur la ligne des filtres (en haut de la page si elle a défilé).
- **Rectangle de sélection** : fond à 25 %. **Texte surligné** : retiré au premier clic ailleurs, qui
  garde son effet.
- **Pop-in ouverte depuis un menu** : elle ne se ferme plus quand on clique dans une autre fenêtre ou sur
  l'autre écran (GEN-23).

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » : texte « N médias »
surligné puis clic sur une vignette (visionneuse ouverte, surlignage retiré), dans le vide, sur un
bouton (liste ouverte, surlignage retiré) ; clic droit : « Copier », surlignage gardé ; menu seul et
perte du focus : fermé ; pop-in ouverte depuis le menu et perte du focus : pop-in et menu restent, Échap
ferme la pop-in ; dossiers d'essai (5 médias dans l'un, 2 dans l'autre) : « Ajouter / Retirer 5 d'un
dossier », « – zz-partiel 2 / 5 », « ✓ zz-tous 5 / 5 », un clic ajoute les 3 autres ; vignette seule
et bouton D : « Ajouter / Retirer d'un dossier » ; badge : 14 px, bordure dorée, centré sur la ligne
des filtres, parti après 3 s, en haut de la page après défilement ; rectangle à 25 %.

## Phase 3, correctifs du test, lot 3 : sélection et surlignage (24/10/2026) — Backup v47

SPEC : livrées `[~]` : SEL-01 (SEL-01.2), SEL-03 (SEL-01.3), SEL-06 (SEL-06.1 à SEL-06.3) ; note dans GEN-17.

- **Plus rien ne se surligne au cliquer-glisser**, comme dans une application de bureau : seuls les
  textes d'information restent sélectionnables et copiables (compteurs, nombre de médias, titres, infos
  du fichier dans la visionneuse, notes, textes des pop-ins…) et les champs de saisie. Un double-clic
  sur une vignette ne surligne plus son nom.
- **Ctrl + A** ne sélectionne plus toute la page (sauf dans un champ) ; en mode sélection, il coche la
  page affichée, comme « Tout ».
- **Rectangle de sélection** : il démarre n'importe où dans la fenêtre (barre des filtres, barre
  latérale, textes…), sauf sur un bouton, un champ, la barre de titre ou une barre de défilement ; son
  fond est un peu plus opaque (15 %).
- **Menu ⋮ de la sélection** : « Sélectionner tous les résultats » en premier.

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » : glisser sur la grille et
de la barre des filtres à la grille : rien de surligné ; compteurs de l'en-tête, « N médias », infos de
la visionneuse : surlignés, clic droit « Copier » ; Ctrl + A : rien hors champ, tout le texte dans le
champ de recherche, la page cochée en mode sélection (50 médias) ; double-clic sur une vignette : rien
de surligné ; rectangle depuis la barre des filtres, le texte « N médias » et la barre latérale :
vignettes cochées, rien de surligné ; depuis un bouton ou la barre de titre : pas de rectangle ; fond
à 15 % ; ordre du menu ⋮ ; essais des lots 1 et 2 refaits.

## Phase 3, correctifs du test, lot 2 (suite) : Espace et Entrée dans les pop-ins (24/10/2026) — Backup v46

SPEC : GEN-20 reste `[~]` (corrigé et précisé après ton test) ; TAGM-15.1 fait au passage.

- **Espace** coche ou décoche la case principale d'une pop-in sans qu'elle ait le focus (« Supprimer les
  fichiers de votre stockage », « Sélection manuelle », « Garder les anciens noms comme synonymes », case
  d'une règle de parent).
- **Entrée confirme toutes les pop-ins de confirmation** (le bouton de droite), sans avoir à lui donner le
  focus : 2e pop-in de suppression (seulement une demi-seconde après son ouverture : deux appuis réflexes
  n'effacent pas les fichiers), confirmations des menus, suppression d'un dossier ou d'un synonyme,
  « Nom déjà utilisé », création et renommage d'un tag, fusions, import de tags, pop-ins d'erreur.
  Pas dans « Tags proches », où chaque groupe a ses propres boutons.
- **« + Nouveau »** : après la création, le focus va sur le nouveau dossier de la liste.

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » : Espace sans focus coche,
décoche, recoche ; Entrée sans focus ouvre la 2e pop-in, un 2e appui immédiat ne fait rien, un appui
0,5 s plus tard efface le fichier (créé exprès pour l'essai) et retire le média ; confirmation d'un menu
(suppression d'un dossier) par Entrée ; « + Nouveau », Entrée : dossier créé, focus sur sa ligne ; nom
pris, Entrée sur « Nom déjà utilisé » : « vacances-3 » créé, focus sur sa ligne ; « Créer un nouveau
tag » par Entrée : tag créé et posé ; essais du lot 2 refaits, mêmes résultats.

## Phase 3, correctifs du test, lot 2 : clavier des pop-ins, case de sélection (23/10/2026) — Backup v45

SPEC : validées `[x]` par l'utilisateur : CTX-20, CTX-21. Livrées `[~]` : GEN-20 (GEN-20.1, GEN-20.2 du
retour de test), SEL-05 (SEL-01.1).

- **Clavier dans les pop-ins** (toutes) : à l'ouverture, la pop-in prend le focus (un de ses champs le
  garde) ; Tab et Maj + Tab tournent entre ses commandes (croix, case, boutons…) et ne passent plus à la
  page derrière ; à la fermeture, le focus revient là où il était.
- **Case à cocher d'une pop-in** : Espace la coche ou la décoche, Entrée confirme (comme Windows).
- **Case de sélection des vignettes** : réduite plus doucement : 24 px jusqu'à 10 colonnes, 11,4 px à 30
  colonnes sur l'écran 1080p (7 px avant) ; l'étoile garde sa taille.

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » :
- pop-in de suppression ouverte depuis le menu d'une vignette : focus dans la pop-in ; Tab : croix → case →
  Annuler → Oui → croix, Maj + Tab à l'envers ; Espace coche, décoche, recoche ; Entrée sur la case cochée :
  2e pop-in, focus dedans, Tab y reste ; Échap, Échap : focus rendu à la page, aucun média supprimé ;
- « Nouveau dossier » : le champ garde le focus, Tab reste dans la pop-in, Échap rend le focus à
  « + Nouveau » ; confirmation ouverte depuis un menu : Tab y reste, Échap la ferme et laisse le menu
  ouvert (CTX-02) ; « Créer un nouveau tag » dans la visionneuse : Tab y reste (choix de la catégorie
  compris), Échap rend le focus au champ du tag ;
- case de sélection mesurée de 4 à 30 colonnes (étoile inchangée) ; sous-menus du lot 1 revérifiés.

## Phase 3, correctifs du test, lot 1 (suite) : délai des sous-menus (23/10/2026) — Backup v44

SPEC : CTX-20 reste `[~]` (corrigé après ton test).

- **Délai de fermeture d'un sous-menu** : passer d'une entrée à l'autre (ou bouger sur l'une d'elles)
  relançait les 250 ms, et le sous-menu restait ouvert tant que la souris bougeait. Le délai part
  maintenant de la sortie de l'entrée « ▸ » (ou du sous-menu) et n'est plus relancé ; un retour sur
  l'entrée « ▸ » ou dans le sous-menu l'annule toujours.

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » : allers-retours
« Sélectionner » ↔ « Ouvrir avec… » pendant 1,8 s : fermé après ≈ 260 ms (ouvert au survol comme par
un clic) ; souris en mouvement continu sur « Sélectionner » : fermé après ≈ 300 ms ; menu ⋮ d'un
dossier, allers-retours « Renommer » ↔ « Masquer » : fermé ; tous les essais du lot 1 refaits, mêmes
résultats.

## Phase 3, correctifs du test, lot 1 : sous-menus « ▸ » (23/10/2026) — Backup v43

SPEC : livrées `[~]` : CTX-20 (CTX-20.1, CTX-20.2 du retour de test), CTX-21.

- **Clic sur une entrée « ▸ »** (par exemple « Ajouter à un dossier ») : son sous-menu reste ouvert quand
  la souris sort des menus ou passe sur un séparateur, et même quand elle entre dans le sous-menu puis en
  ressort ; il se ferme 250 ms après le survol d'une autre entrée (comme Windows). Aucune entrée du
  sous-menu n'est choisie d'avance au clic (au clavier, Entrée choisit toujours la première).
- **Surbrillance** : une autre entrée quittée ne rend plus la surbrillance à l'entrée « ▸ » dont le
  sous-menu se ferme ; une entrée grisée survolée n'en a pas. L'entrée « ▸ » garde la sienne tant que son
  sous-menu est affiché.
- **Sous-menu ouvert au survol, quitté vers l'extérieur** (CTX-21) : il se ferme 250 ms après (le menu
  principal reste ouvert), sauf si la souris revient dans le sous-menu ou sur son entrée avant.

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » (relevés à 60, 200, 400 et
800 ms) : « ▸ » → « Sélectionner » → séparateur : aucune surbrillance, sous-menu fermé ; survol puis
grille : fermé après le délai ; clic puis grille, puis séparateur : ouvert ; puis « Ouvrir avec… » :
fermé après le délai ; sous-menu quitté vers l'extérieur : fermé (ouvert par un clic : reste ouvert) ;
sortie et retour en moins de 250 ms : ouvert ; diagonale jusqu'à « Créer un dossier… » : ouvert ; un
dossier du sous-menu ouvert par un clic s'ajoute bien ; clavier inchangé ; menu ⋮ d'un dossier >
« Couleur ▸ » : pareil.

## Phase 3, lot 5 : synonymes et tags parents (20/10/2026) — Backup v42

SPEC : livrées `[~]` : TAGM-15, TAGM-16, TAGM-17, TAGM-18, SRCH-27, DEL-08, GRID-12, FOLD-13 ; GEN-21
appliqué (laissé ouvert) ; notes ajoutées à DEL-04 et CTX-16. Restent à préciser `[?]` : TAGM-19, CTX-21.
Choix : D-041, D-042.

- **Gestionnaire de tags, onglet « Synonymes et parents »** (à côté de « Tags » ; chaque onglet est une
  page de l'historique) : synonymes et règles de parents côte à côte, un formulaire pour en ajouter, une
  case par ligne pour désactiver / réactiver, une corbeille, un filtre, un menu du clic droit.
- **Synonymes (TAGM-15)** : déclarer « A = B » fusionne A dans B ; taper A (visionneuse, barre de la
  sélection, tags par défaut de l'import, recherche) donne B ; suggestions « A → B ». Décocher défait la
  fusion à l'identique (A revient sur ses médias, B quitte ceux qui ne l'avaient pas) ; recocher la refait.
- **Tags parents (TAGM-16)** : « C → P » ajoute P aux médias qui ont déjà C (confirmation avec le nombre),
  puis à chaque ajout de C, en chaîne. Décocher retire P des médias qui l'ont reçu par la règle ; recocher
  le remet et propose les médias tagués entre-temps ; interrupteur « Auto » ; retirer P à la main d'un
  média le fait oublier à la règle.
- **Tableau des tags** : colonnes « Synonymes » et « Parents » (bouton → petite liste modifiable ; les
  enfants y sont en lecture seule).
- **Fusions (TAGM-17)** : case « Garder les anciens noms comme synonymes », cochée par défaut (renommage
  vers un nom existant, fusion groupée, tags proches).
- **Code de partage (TAGM-18)** : descriptions, synonymes et règles en plus ; aperçu de l'import exact ;
  « Annuler » retire tout ce qui a été importé.
- **Renommer un tag de la recherche (SRCH-27)** : la pastille prend le nouveau nom, aussi dans le retour
  arrière ; de même après une fusion.
- **Fichiers en lecture seule (DEL-08)** : refusés ; pop-in avec la liste des fichiers et leurs chemins
  (clic = Explorateur), « Copier », « Supprimer quand même » (rouge) ; s'il reste des échecs, la pop-in se
  met à jour avec la raison, sans le bouton ; en mode sélection, les médias revenus restent cochés.
- **Pages sans résultat (GRID-12)** : « Aucune vidéo ni fichier audio dans ce dossier. », « Aucune image
  dans les favoris. »… ; même règle pour « Aucun fichier trouvé » (SRCH-26).
- **Création des dossiers (FOLD-13)** : « + Nouveau » du menu burger et « Créer un dossier… » d'un média
  créent de nouveau le dossier (cassé depuis le lot 3) ; « Nom déjà utilisé » (FOLD-12) revient.

Vérifié dans la version compilée, sur des copies de la bibliothèque « booru » :
- 8 essais automatiques de la logique (base en mémoire, non gardés dans le dépôt) : fusion puis défaite
  exacte, retrait à la main, parents en chaîne décochés / recochés / ajouts proposés, parent justifié par
  une autre règle, « Auto », fusion avec synonymes et règles, défaire une fusion retire les parents qu'elle
  avait apportés, chaîne créée après coup ;
- synonymes : pop-in, badge, suggestions, recherche, visionneuse, décocher / recocher / corbeille ; parents :
  tout le cycle, colonnes, petites listes, corbeille ; aucun compteur faux ; menus du clic droit ;
- SRCH-27 (retour arrière compris), fusions avec et sans la case, renommer en un synonyme ; export, import,
  « Annuler » (presse-papiers remis ensuite) ;
- DEL-08 avec des fichiers créés pour l'essai (en lecture seule, tenus ouverts) : pop-in, « Supprimer quand
  même », mise à jour, sélection, lecture seule remise ; le clic sur un chemin n'a pas pu être vérifié ;
- GRID-12 ; FOLD-13 : « + Nouveau » avec un nom libre (Entrée) : créé et affiché ; nom pris (clic sur « Créer ») : « Nom déjà
  utilisé » propose « vacances-3 », « Oui » le crée ; « Non » revient au champ ; renommer en un nom pris :
  « vacances-4 » proposé ; clic droit d'une vignette et touche D de la visionneuse > « Créer un dossier… » :
  créé avec ce média ; mode sélection : créé avec les 2 médias et son badge ;
- lots 3, 4 et SRCH-26 revérifiés ;
- 100 000 médias : règle sur 74 750 médias 2,0 s (décocher 3,2 s, recocher 2,1 s) ; synonyme sur 28 461
  médias 1,4 s ; ajouter un tag sans règle à 50 000 médias 563 ms (837 ms avant), le retirer 643 ms
  (615 ms avant) ; suggestions 3 à 5 ms ; suppression de 300 médias 255 ms (252 ms avant). Détail : D-042.

## Phase 3, SRCH-26 : recherche par nom de fichier (20/10/2026) — Backup v41

SPEC : livrée `[~]` : SRCH-26. Choix : D-039.

- **Menu burger, « Rechercher un fichier »** (sous la navigation, au-dessus des dossiers) : Entrée ou la
  loupe ferment le menu ; la grille montre les médias de la vue en cours (bibliothèque, favoris, dossier)
  dont le nom contient le texte, sans tenir compte des majuscules, en plus des tags.
- **Pastille blanche** (petite loupe) en premier parmi les termes de la recherche ; sa croix la retire ;
  clic droit : Copier le texte · Retirer de la recherche ‖ Tout effacer (proposé).
- **Aucun résultat** : « Aucun fichier trouvé » / « Aucun fichier dont le nom contient « abc » dans la
  bibliothèque… » et un bouton « Retirer le nom de fichier » (texte proposé).

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » :
- place de la section dans le menu ; « test » : 6 médias (comme en base), menu refermé ; « TEST » par la
  loupe : mêmes 6 ; avec le tag des fichiers de test (bouton +) : 6 ; croix de la pastille ; retour
  arrière (pastille revenue) puis avance ; menu de la pastille ; « 12363 » seul : 80 (comme en base) ;
  clic sur un tag de la barre latérale : le nom de fichier part ; page sans résultat et son bouton ;
- vue Favoris : 1 résultat (comme en base) ; depuis le gestionnaire de tags : bibliothèque avec le nom
  de fichier ; visionneuse : précédent / suivant restent dans les 6 résultats ; « Sélectionner tous les
  résultats » : 6 ; « Tout effacer » : tout retiré ;
- lots 3 et 4 revérifiés ; sur 100 000 médias : 40 à 100 ms la première fois, 3 ms ensuite.

## Phase 3, lot 4 : gestionnaire de tags (20/10/2026) — Backup v40

SPEC : livrées `[~]` : TAGM-04, TAGM-05, TAGM-08, TAGM-10 à TAGM-14 ; CTX-04 et CTX-12 (entrées
activées), CTX-16 (menu des lignes), NAV-02 (« Gestionnaire de tags »). Choix : D-036, D-038.

- **Page « Gestionnaire de tags »** (menu burger) : bouton « Bibliothèque », titre et « N tags · M médias
  taggés » ; boutons Tags proches (N) · Exporter ▾ · Importer · Supprimer les tags non utilisés ; filtres
  nom, catégorie, Masqués, Rares ; tableau Nom · Catégorie · Médias · Créé le · Description · Actions
  (œil, crayon, corbeille), trié par clic sur l'en-tête, fluide avec des milliers de tags.
- **Dans une ligne** : clic sur le nom = recherche dans la bibliothèque (retour arrière = gestionnaire) ;
  crayon = nom modifiable (Entrée, Échap ; fusion proposée si le nom existe) ; catégorie au choix ;
  description (même zone que la note des médias) ; clic droit = menu du tag.
- **Actions groupées** (cases) : catégorie, masquer, ne plus masquer, fusionner (nom gardé au choix),
  supprimer.
- **Tags proches** : groupes de noms presque identiques, « Fusionner » ou « Ignorer ».
- **Exporter ▾** (affichés, tous, cochés) : code de partage copié, badge « N tags copiés » ;
  **Importer** : code collé, aperçu « N à créer, M déjà présents », puis « N tags importés » avec Ok /
  Annuler.
- **Supprimer les tags non utilisés** : « Supprimer les N tags non utilisés ? », case « Sélection
  manuelle » (liste cochée, décocher garde le tag).
- **Partout** : menus des tags actifs (Renommer…, Changer de catégorie ▸, Masquer, Supprimer le tag…) ;
  tag masqué absent des suggestions et de la barre latérale, gris clair et en dernier dans la
  visionneuse ; description en bulle d'aide (barre latérale, visionneuse, termes de la recherche).

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » (13 098 tags ; tags de
test « zz_mgr_… » créés pour l'occasion) :
- en-tête juste (13 098 tags, 3 306 médias taggés), 29 lignes dessinées, tri par défaut identique à la
  base, tri par nom, filtres nom et Rares ;
- renommer dans la ligne ; renommer en un nom existant → « « zz mgr y » existe déjà et 2 médias y sont
  attachés… » → fusion, aucun compteur faux ;
- masquer : absent de la barre latérale et des suggestions, recherche explicite (2 médias), filtre
  Masqués, gris et dernier dans la fiche de la visionneuse ; description enregistrée et en bulle ;
- clic droit d'une ligne (« Renommer… » ouvre la modification dans la ligne), corbeille, clic sur un nom
  puis retour arrière ;
- actions groupées : 3 masqués, catégorie « Artiste », fusion en 1, suppression ;
- tags proches : fusion d'un groupe de 3, « Ignorer » enregistré ; export (badge, code dans le
  presse-papiers, remis ensuite), import avec Annuler puis Ok ; tags non utilisés : décocher 1 (6 → 5),
  les 5 autres supprimés ;
- menus des tags de la barre latérale actifs ; note de la visionneuse : écrite, enregistrée, effacée ;
- lot 3 revérifié (sélection) ; tableau : défilement 144 images/s, tri par nom 118 ms.

## Phase 3, lot 3 : sélection multiple (20/10/2026) — Backup v39

SPEC : livrées `[~]` : SEL-01 à SEL-10, DEL-07 ; CTX-05 (« Sélectionner »), CTX-16 (menus de la
sélection). Choix : D-036, D-037.

- **Bouton « Sélection multiple »** à droite de « Disposition » ; en mode sélection : Tout (coche la
  page, ajoute à la sélection) · Aucun (vide la sélection) · Terminer · ⋮. Les autres boutons ne bougent
  pas. Case 24×24 en haut à gauche (réduite avec la vignette), contour doré si cochée.
- **Clic** = coche / décoche ; **Maj + clic** = toute la rangée (déjà toute cochée : la décoche) ;
  **rectangle** depuis n'importe où dans la grille, il ajoute (Ctrl : il décoche), la grille défile près
  des bords. Échap ou « Terminer » quittent le mode.
- **Une seule sélection**, gardée en changeant de page, de recherche, de vue, en ouvrant la visionneuse
  (« Ouvrir » du clic droit) et après un retour arrière / avant ; compteur « N sélectionnés ».
- **Menu d'une vignette cochée** : « Ajouter N aux favoris » (ou « Retirer X des favoris »), « Ajouter X à
  un dossier ▸ » (dossier qui les contient tous : coché, un clic les en retire), « Désélectionner »,
  « Retirer X de ce dossier » (page d'un dossier), « Supprimer X de la bibliothèque… ». Badge bref en haut :
  « Y ajoutés au dossier « nom » », « N ajoutés aux favoris »… Vignette non cochée : son menu habituel.
- **Menu ⋮** : mêmes entrées, « Ajouter des tags à la sélection », « Sélectionner tous les résultats ».
- **Barre du bas** : « N sélectionnés · Ajouter des tags… · Retirer des tags… · Appliquer » (pastilles ;
  « Retirer » ne propose que les tags de la sélection ; nouveau tag : pop-in de création).
- **DEL-07** : 2e pop-in de suppression au singulier pour un seul média.

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » (fichiers de test créés pour
l'occasion) :
- barre des filtres identique au pixel près avant / après le bouton ; 42 cases pour 42 vignettes ;
  clic, Maj + clic (7 de la rangée, puis 0), Tout (102 = la page), Aucun (0) ; rectangle sur 6 vignettes,
  Ctrl + rectangle (−2), nouveau rectangle (+1), défilement automatique (0 → 2 340 px) ; étoile sans effet
  sur la sélection ; Échap dans le champ des tags sans effet, Échap ailleurs : mode quitté et vidé ;
- menus : vignette cochée (« Ajouter 2 aux favoris · Ajouter 3 à un dossier ▸ · Désélectionner ·
  Supprimer 3… »), non cochée (menu habituel) ; badges « 2 ajoutés aux favoris », « 3 retirés des
  favoris », « 2 ajoutés au dossier « vacances-2 » » (1 y était déjà), « 3 retirés du dossier… »,
  « 2 retirés du dossier « Fonds d'écran » » (page du dossier), « 3 ajoutés au dossier « zz sel
  dossier » » (créé depuis la sélection) ;
- visionneuse ouverte puis fermée, vue Favoris puis retour arrière, avant / arrière, bouton 4 : toujours
  les 3 mêmes médias cochés ;
- nouveau tag ajouté aux 3 médias (pop-in de création), puis retiré (proposé par « Retirer ») ; aucun
  compteur faux ; « Sélectionner tous les résultats » : 3 306 ;
- suppression de 2 médias (pop-ins au pluriel), 2e pop-in au singulier pour 1 média ; réimport et
  « Restaurer » ;
- fluidité à 30 colonnes : 173 images/s hors sélection, 164 en mode sélection, 168 page entière cochée ;
  cocher une vignette : 12 à 47 ms.

## Phase 3, LIB-16 : taille des miniatures selon la taille réelle des vignettes (19/10/2026) — Backup v38

SPEC : livrée `[~]` : LIB-16. Choix : D-035 (remplace les seuils en colonnes de D-015).

- La grille prend la plus petite miniature (128, 320, 640 ou **1 280 px**, nouvelle) au moins aussi
  large que la vignette en pixels réels de l'écran (mise à l'échelle de Windows comprise), à 5 % près ;
  recalculé au changement de densité, de taille de fenêtre ou d'écran.
- 128 et 320 px faites à l'import comme avant ; 640 et 1 280 px à la demande, dans le même cache de 1 Go.
- Sur tes écrans à 100 % : 1080p : 640 px à 4 colonnes (avant 4 à 6), 320 de 5 à 11, 128 dès 12 (avant
  16) ; 1440p : inchangé (640 de 4 à 6, 320 de 7 à 15, 128 dès 16).

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » (écrans simulés par le
protocole de pilotage) :
- densités 4 à 30 sur 1080p, 1440p, 4K à 100 / 150 / 200 % et 5K à 200 % : la taille affichée est celle
  prévue partout (0 écart) ; 5K 200 %, 4 colonnes : les 12 vignettes visibles affichent l'aperçu 1 280 px ;
- mise à l'échelle passée de 200 à 100 % sans relancer : 640 → 320 px ;
- média supprimé : ses aperçus 640 et 1 280 px partent avec lui ; cache au-delà de 1 Go : les plus anciens
  sont supprimés d'abord, dans les deux tailles ;
- mesures (D-035) : fabrication de 100 aperçus 5,9 s (640) / 10,5 s (1 280) ; page suivante inchangée.
- Non vérifiable ici : un vrai écran 4K ou 5K, et le passage réel d'un écran à 100 % à un écran à une
  autre mise à l'échelle (les deux écrans de test sont à 100 %).

## Phase 3, petits correctifs après les lots 1 et 2 (19/10/2026) — Backup v37

SPEC : livrées `[~]` : CTX-20, VIEW-50, FOLD-12, GEN-19, GEN-20, DEL-06 ; FOLD-04 (texte du dossier vide) et
GRID-08 (étoile en mode « nom seul ») restent `[~]`. DEL-04 : moyen de provoquer l'échec corrigé.

- **Sous-menus « ▸ »** (CTX-20) : le sous-menu se ferme 250 ms après que la souris a quitté son entrée
  (autre entrée, même grisée, séparateur, hors du menu), et l'entrée perd sa surbrillance avec lui ; il
  reste ouvert si la souris le rejoint, même en diagonale ou par son bord. Corrigé en même temps : en
  passant sur une autre entrée, la fermeture pouvait se perdre si la souris s'arrêtait aussitôt.
- **Barre de lecture** (VIEW-50) : après un clic sur le volume, la lecture, la boucle, le son, la vitesse ou
  le plein écran, F et les autres touches marchent et aucun contour doré n'apparaît.
- **Nom de dossier déjà pris** (FOLD-12) : le nom proposé part du nom sans son suffixe « -nombre »
  (« abc-3 » pris, avec « abc-2 » à « abc-4 » existants → « abc-5 »).
- **Dossier vide** (FOLD-04) : « (clic droit sur une vignette, ou touche D dans la visionneuse) ».
- **Étoile des vignettes** (GRID-08) : masquée en mode « nom seul », au même seuil que les autres infos.
- **Cases à cocher** (GEN-19) : bord gris clair, bien visible quand la case est décochée.
- **Entrée** (GEN-20) : dans la pop-in de suppression et celle de restauration, Entrée vaut le bouton de
  confirmation, même quand la case a le focus.
- **Espaces des pop-ins** (DEL-06) : 16 px entre le titre, chaque paragraphe, la case et les boutons
  (suppression d'un média, confirmations des menus, « Effacer la note », « Nom déjà utilisé »).

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » (fichiers de test créés pour
l'occasion) :
- sous-menu « Ajouter à un dossier » : fermé et sans surbrillance 400 ms après être passé sur un séparateur,
  hors du menu, sur « Sélectionner » (grisée) ou sur « Ajouter aux favoris » (alors en surbrillance) ;
  toujours ouvert dans le sous-menu, sur son bord et après un passage en diagonale ; même chose pour
  « Couleur » du menu ⋮ d'un dossier ;
- vidéo : volume glissé de 0,26 à 0,74, focus rendu au relâchement, F passe en plein écran ; après un clic
  sur chacun des cinq boutons : focus sur la page, aucun contour, F marche ;
- « abc-3 », « abc-4 » → « abc-5 » (pop-in « Ce nom est déjà utilisé, voulez-vous le renommer « abc-5 » ? ») ;
- étoile visible à 17 colonnes, masquée à 18 et 30 (écran 1080p) ; texte du dossier vide ;
- bord de la case décochée gris clair, cochée dorée ; espaces mesurés : 16 / 16 / 16 / 16 (1re pop-in de
  suppression), 16 / 16 (2e pop-in, confirmation d'un dossier, « Nom déjà utilisé ») ;
- Entrée : focus sur la page → média retiré de la bibliothèque ; focus sur « Annuler » → annulé, menu
  toujours ouvert ; case cochée et focus dessus → 2e pop-in ; pop-in de restauration au réimport, focus sur
  une case → données remises (réserve vide, tag retrouvé) ;
- DEL-04 : un fichier en **lecture seule** est quand même effacé par MyBoard (attribut vérifié) ; un fichier
  **ouvert en exclusivité** par une commande PowerShell → « Erreur Windows 32 », le média revient avec ses
  données, le fichier reste.

## Phase 3, lot 2 : dossiers (17/10/2026) — Backup v36

SPEC : livrées `[~]` : FOLD-01 à FOLD-04, FOLD-07, FOLD-09, VIEW-15 ; NAV-02 (« Dossiers ») ; menu CTX-05
(« Ajouter à un dossier ▸ », « Retirer de ce dossier ») ; CTX-16 (menus des dossiers). FOLD-09 corrigé :
seul le menu d'une vignette a « Ajouter à un dossier ▸ » (pas ceux de l'image et de la vidéo). Choix :
D-032, D-034.

- **Menu burger, Dossiers** : « + Nouveau » (pop-in du nom), puis les dossiers par ordre alphabétique :
  pastille de couleur, nom, nombre de médias, menu ⋮ (le clic droit sur la ligne ouvre le même) :
  Renommer… · Couleur ▸ (8 couleurs) · Masquer ‖ Supprimer… (rouge, « Ses N médias resteront disponibles
  dans la bibliothèque. »). Nom déjà pris : « Ce nom est déjà utilisé, voulez-vous le renommer « nom-2 » ? »
  (Non = retour au champ). Couleur attribuée automatiquement à la création, à tour de rôle.
- **Masquer** : le dossier quitte la liste et les listes à cocher, ses médias restent partout ; ligne
  « Dossiers masqués (N) » en bas (provisoire, FOLD-06) qui les montre en gris, avec « Ne plus masquer ».
- **Liste à cocher** : « Ajouter à un dossier ▸ » du menu d'une vignette et bouton Dossier de la
  visionneuse (touche D, liste au-dessus du bouton) : coche = le média y est ; clic = ajouter ou retirer ;
  « Créer un dossier… » en bas (le média y est rangé aussitôt).
- **Page d'un dossier** : la page de la bibliothèque limitée au dossier, titre « nom · N médias »,
  « Recherche dans le dossier », tris « Ajout au dossier : récents / anciens », recherche vide en y
  entrant ; menu d'une vignette : « Retirer de ce dossier » au-dessus de « Supprimer de la bibliothèque… » ;
  dossier vide : « Ce dossier est vide ».
- Suppression d'un média (DEL-05) : ses dossiers sont gardés avec ses données ; à la restauration, un
  dossier supprimé entre-temps est signalé « (supprimé depuis) » et n'est pas recréé.

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » (fichiers de test créés pour
l'occasion) :
- création de « Vacances » (doré) et « Fonds d'écran » (vert), liste alphabétique ; « vacances » refusé →
  « vacances-2 » proposé, « Oui » le crée ; renommer « Vacances » en « Fonds d'écran » → « Fonds
  d'écran-2 » proposé, « Non » revient au champ, puis « Voyage » ; couleur « Rose » appliquée ;
- menu d'une vignette : liste « Fonds d'écran · vacances-2 · Voyage ‖ Créer un dossier… », clic sur
  « Voyage » : coché, enregistré en base ; visionneuse, touche D : liste au-dessus du bouton (bas de la
  liste 4 px au-dessus), ajout dans « Fonds d'écran », « Créer un dossier… » → « Nouveau test » créé et
  coché ;
- page de « Fonds d'écran » : titre « Fonds d'écran · 1 média », grille au même endroit (205 px),
  « Retirer de ce dossier » → « Ce dossier est vide » et « · 0 média » ;
- « Masquer » « Voyage » : « Dossiers masqués (1) », dépliée : « Voyage » en gris, menu « Ne plus
  masquer » ; absent de la liste à cocher ;
- dossier « Nouveau test » supprimé pendant qu'on le regarde : retour à la bibliothèque ; média dans
  « Voyage » et « Nouveau test » supprimé puis réimporté : pop-in « Dossiers : Voyage, Nouveau test
  (supprimé depuis) », « Restaurer » : de nouveau dans « Voyage » seulement, compteurs justes ;
- vidéo en plein écran, touche D : la barre du bas reste affichée tant que la liste est ouverte (souris en
  haut de l'écran) ; 3,6 s immobile sur la vidéo : commandes cachées et liste fermée ; immobile sur la
  liste : rien ne se cache.

## Phase 3, lot 1 : suppression et favoris (17/10/2026) — Backup v35

SPEC : livrées `[~]` : DEL-01 à DEL-05, FAV-01 à FAV-06, PAGE-05, VIEW-11, VIEW-14, GRID-08 (étoile) ;
NAV-02 (« Favoris » actif) ; entrées actives dans les menus CTX-05, CTX-06, CTX-07. Choix : D-032, D-033.
Base de données : schéma v5 (migration automatique au lancement).

- **Supprimer** (bouton rouge et touche Suppr de la visionneuse, « Supprimer de la bibliothèque… » des
  menus de la vignette, de l'image et de la vidéo) : pop-in « Supprimer « nom » de la bibliothèque ? ».
  Par défaut le fichier n'est pas touché : le média disparaît aussitôt de toutes les pages, sa vignette et
  ses miniatures sont effacées, ses tags, son favori, ses dossiers et sa note sont gardés 1 mois. Case
  « Supprimer les fichiers de votre stockage » (décochée à chaque ouverture) : 2e pop-in à bordure rouge,
  puis fichier effacé définitivement (sans la Corbeille) et données effacées. Fichier impossible à
  effacer : son média revient avec toutes ses données, une pop-in donne l'erreur de Windows.
- Visionneuse : après une suppression, le média suivant s'affiche (le précédent si c'était le dernier,
  fermeture s'il n'en reste aucun).
- Suppression réelle en arrière-plan, reprise au lancement suivant si MyBoard a été fermé entre-temps ;
  données gardées effacées au bout d'un mois (sans toucher aux compteurs).
- **Réimport** d'un fichier supprimé il y a moins d'un mois : à la fin de l'import, pop-in « Restaurer les
  données… » (miniature, nom, date de suppression, tags, favori, dossiers, note ; une case par média) ;
  « Restaurer » ou « Ne rien restaurer ».
- **Favoris** : étoile en haut à droite de chaque vignette (toujours visible, dorée pour un favori, réduite
  avec la vignette), bouton de la visionneuse (touche S), « Ajouter aux favoris » / « Retirer des favoris »
  du menu d'une vignette ; l'étoile change partout à la fois.
- **Vue Favoris** (menu burger) : la page de la bibliothèque limitée aux favoris, titre « Favoris · N
  médias » à gauche de la pagination du haut, « Recherche dans les favoris », tris « Ajout aux favoris :
  récents / anciens » en plus ; recherche vide en y entrant, le retour arrière retrouve celle d'avant.
  Sans favori : « Aucun favori pour le moment ».
- **PAGE-05** : la ligne de la pagination du haut est toujours là, même sans autre page ; la grille ne
  remonte plus.

Vérifié dans la version compilée, sur une copie de la bibliothèque « booru » et 6 fichiers créés pour le
test (aucun fichier de l'utilisateur) :
- étoile d'une vignette : dorée au clic, la visionneuse ne s'ouvre pas ; touche S dans la visionneuse puis
  fermeture : l'étoile de la vignette a suivi ; menu : « Retirer des favoris » pour un favori ;
- vue Favoris : titre « Favoris · 2 médias », 2 vignettes, tris d'ajout (ordre vérifié dans les deux
  sens) ; bibliothèque : tri affiché « Récents » ; grille à 205 px du haut avec ou sans pagination ;
- recherche « zz_test_suppression » dans la bibliothèque → Favoris : aucune recherche → retour : la
  recherche et ses 6 résultats reviennent ;
- suppression simple : vignette absente 0,17 s après « Oui » ; compteur du tag 6 → 5 ; fichier toujours
  sur le disque ; réserve : tag, favori et note ; Échap sur la pop-in ouverte d'un menu : le menu reste ;
- réimport du fichier : pop-in de restauration (Échap ne la ferme pas) ; « Restaurer » : compteur 6, favori
  et note revenus, réserve vide ;
- suppression avec le fichier : 2e pop-in à bordure rouge, « Annuler » revient à la 1re (case toujours
  cochée) ; « Oui » : fichier effacé, rien en réserve ;
- fichier ouvert en exclusivité par un autre programme : pop-in « Erreur Windows 32 », média revenu,
  fichier intact, compteur inchangé ;
- visionneuse : Suppr → pop-in → « Oui » : le suivant s'affiche ; sur le dernier : le précédent ;
- 300 médias d'un coup : absents de la grille 8 ms après la demande, retirés réellement en 0,13 s ;
  compteur de « 1girl » diminué exactement de 171 ; aucun tag au compteur faux ; aucune miniature restée ;
- suppression interrompue (média resté marqué) : retiré au lancement suivant ; réserve vieille de 31 jours :
  effacée au lancement, compteurs inchangés.

**Fluidité de la grille avec l'étoile** (bibliothèque de 100 000 médias, `bench-grid --ecran 1920x1080`,
avant : moyenne de 2 mesures ; avec l'étoile : 1 mesure de la version livrée) :

| Colonnes | Changer de densité | Page suivante | Défilement (images/s) |
|---|---|---|---|
| 20, avant (v34) | 370 ms | 217 ms | 170 |
| 20, avec l'étoile | 474 ms | 231 ms | 160 |
| 30, avant (v34) | 700 ms | 387 ms | 168 |
| 30, avec l'étoile | 916 ms | 425 ms | 153 |

Jusqu'à 14 colonnes : pas de différence nette. L'étoile a été sortie du calque réduit des infos (dans ce
calque, le défilement tombait à 140 images/s) ; une étoile en caractère de police au lieu de l'icône
Lucide a aussi été mesurée (≈ 840 ms et 160 images/s à 30 colonnes, captures dans
`new V2\Explications étoile`) : proposée, pas appliquée.

## Mesures des miniatures (LIB-15) (17/10/2026) — Backup v34

SPEC : LIB-15 livrée `[~]` (mesures seulement, aucun code modifié). Cadrage de la phase 3 écrit
avant : DEL-04, DEL-05, FAV-04 à 06, FOLD-06 à 11, PAGE-05, SET-14, SET-15, D-032.

Mesuré dans la version compilée, sur une copie de la bibliothèque « booru » (3 300 médias Danbooru),
sur les deux écrans (1920×1080 et 2560×1440, mise à l'échelle de Windows à 100 % sur les deux).

**Poids réel dans `thumbs.db`** (moyenne / médiane) : 128 px 3,8 / 3,7 Ko (12 Mo pour 3 300 médias) ;
320 px 15,2 / 14,7 Ko (49 Mo) ; grand aperçu 640 px 33 / 32 Ko.

**Résolution selon la densité** : largeur réelle d'une vignette à l'écran, comparée à la miniature
affichée (une miniature au moins aussi large que la vignette reste nette).

| Colonnes | Vignette 1080p | Vignette 1440p | Miniature |
|---|---|---|---|
| 4 / 5 / 6 | 388 / 308 / 256 px | 548 / 436 / 362 px | 640 px |
| 7 / 10 / 11 | 218 / 150 / 136 px | 309 / 214 / 194 px | 320 px |
| 12 / 15 | 124 / 97 px | 177 / 140 px | 320 px |
| 16 / 17 | 91 / 85 px | 131 / 123 px | 128 px |
| 20 / 30 | 71 / 45 px | 103 / 66 px | 128 px |

- Aucune densité n'affiche une miniature visiblement trop petite. Cas limites, sur le 1440p seulement :
  16 colonnes (vignette de 131 px pour une miniature de 128 px : agrandie de 2 %, de 7 % pendant le
  léger zoom du survol) et 7 colonnes (309 px pour 320 : agrandie de 2 % pendant le survol).
- Sur le 1080p, les seuils sont prudents : de 12 à 15 colonnes, la miniature 320 px est 2,6 à 3,3 fois
  plus large que la vignette (la 128 px suffirait) ; à 5 et 6 colonnes, l'aperçu 640 px est 2 à 2,5 fois
  plus large (la 320 px suffirait).

**Vitesse d'affichage** : page suivante jusqu'à ce que toutes les miniatures visibles soient affichées
(médiane de 5 pages) :

| Colonnes | Miniature | 1080p | 1440p |
|---|---|---|---|
| 5 | 320 px (puis 640) | 51 ms | 60 ms |
| 10 | 320 px | 103 ms | 129 ms |
| 15 | 320 px | 150 ms | 210 ms |
| 16 | 128 px | 174 ms | 179 ms |
| 20 | 128 px | 226 ms | 273 ms |
| 30 | 128 px | 404 ms | 480 ms |

- Lecture et décodage de 300 miniatures : 128 px ≈ 190 à 230 ms, 320 px ≈ 540 à 620 ms (2,7 fois plus).
- Grands aperçus 640 px d'un écran de vignettes (15) : fabriqués en 1,0 à 1,3 s pour des images, 7 à
  10 s pour des vidéos (image extraite par ffmpeg) ; déjà dans le cache : 35 à 60 ms.

**Débordement du cache des aperçus (D-015)** : cache de la copie rempli à 1 033 Mo (1 030 aperçus
factices de 1 Mo, plus anciens que les 99 vrais), puis deux pages neuves à 5 colonnes : le nettoyage
s'est déclenché au premier nouvel aperçu et a supprimé les 112 plus anciens (factices n° 1 à 112),
cache redescendu à 922 Mo (cible : 90 % de 1 Go) ; tous les vrais aperçus gardés (129, dont les 30
nouveaux). Le fichier `thumbs.db` garde sa taille (1,1 Go) : la place libérée (111 Mo) est réutilisée
par les aperçus suivants, SQLite ne rend pas la place au disque.

## Menu des vitesses fermé par un clic ailleurs, compte à rebours relancé par la vitesse (16/10/2026) — Backup v33

SPEC : VIEW-48 validé `[x]` ; VIEW-47 précisé `[~]` ; VIEW-49 (nouvelle) livrée `[~]`. Choix : D-031.

- VIEW-49 : menu des vitesses de la barre de lecture fermé par un clic ailleurs, Échap ou la
  disparition des commandes (3 s sans mouvement en plein écran). Un clic sur la vidéo ou le fond
  gris autour ferme seulement le menu (pas de pause, la visionneuse reste ouverte) ; un clic sur un
  bouton ou dans la barre du bas ferme le menu et agit.
- VIEW-47 : commandes affichées, `<` / `>` relancent le compte à rebours de 3 s ; commandes cachées :
  rien ne change.
- Le « clic avalé » du menu du clic droit est partagé (`lib/swallowClick.ts`), même comportement.

Vérifié dans la version compilée (bibliothèque « booru », une vidéo) : menu des vitesses ouvert,
clic sur la vidéo → menu fermé, vidéo toujours en lecture ; clic sur le fond gris → menu fermé,
visionneuse ouverte ; clic sur lecture / pause → menu fermé et vidéo en pause ; clic dans le champ
d'ajout de tag → menu fermé, champ actif ; Échap → menu fermé ; clic droit → menu fermé, menu du clic
droit ouvert ; plein écran, 3,5 s sans bouger → commandes cachées et menu fermé. Souris immobile 2 s,
`>`, puis 2 s : commandes toujours affichées ; cachées 3,3 s après `>` ; `<` commandes cachées : elles
restent cachées. VIEW-48 inchangé (mêmes mesures qu'en v32). Menu du clic droit : un clic gauche
ailleurs le ferme sans ouvrir la vignette ; le clic suivant l'ouvre.

## Lecteur vidéo : badge de vitesse 2 s, largeur fixe, commandes gardées sous la souris (16/10/2026) — Backup v32

SPEC : NAV-07 validé `[x]` ; VIEW-47 précisé `[~]` ; VIEW-48 (nouvelle) livrée `[~]`. Choix : D-031.

- VIEW-47 : badges de vitesse affichés 2 s (son et boucle : 1,2 s) ; le libellé de vitesse de la
  barre de lecture a toujours la largeur de « 0,75× » : le volume et la barre de progression ne
  bougent plus d'une vitesse à l'autre.
- VIEW-48 : vidéo en plein écran, souris immobile sur la barre de lecture, le menu des vitesses, le
  bouton des notes, une flèche, la croix ou la barre du bas : les commandes restent affichées ; elles
  se cachent de nouveau 3 s après que la souris en est sortie.

Vérifié dans la version compilée (bibliothèque « booru », vidéo en plein écran) : bouton de vitesse
52 px et barre de progression 426,8 px pour les 6 vitesses ; badge de vitesse encore là à 1,6 s,
parti à 2,3 s ; badge du son parti à 1,4 s ; souris immobile 3,6 s : commandes cachées sur la vidéo,
affichées sur la barre de progression, le bouton et le menu des vitesses, les notes, les deux flèches,
la croix et la barre du bas ; ressortie sur la vidéo : cachées de nouveau.

## Raccourcis du lecteur vidéo, favoris sur S (16/10/2026) — Backup v31

SPEC : VIEW-47 (nouvelle) livrée `[~]` ; VIEW-36 modifié (favoris : `S`) ; FUT-08 (nouvelle) :
traduction de l'application en anglais, un jour. Choix : D-031.

- VIEW-47 : `M` couper / rétablir le son ; `<` / `>` vitesse d'un palier (0,5× à 2×) ; `L` boucle.
  Badge bref en haut au centre (« Son coupé », « 1,25× », « Boucle désactivée »…), visible même
  commandes cachées. Raccourcis affichés dans le menu du clic droit de la vidéo et dans les bulles
  d'aide de la barre de lecture.
- VIEW-36 : « Ajouter aux favoris » passe de `L` à `S` (« Star ») ; `L` = boucle (« Loop »).

Vérifié dans la version compilée (bibliothèque « booru », une vidéo) : M → muet puis son rétabli ;
> ×5 → 2× (arrêt à 2×) ; < ×6 → 0,5× (arrêt) ; L → boucle coupée puis remise ; badge disparu après
1,4 s ; en plein écran, souris immobile 3,5 s (barre de lecture cachée) : > → badge « 1,25× » visible ;
bulles « Couper le son (M) », « Vitesse de lecture (< / >) », « … (L) » ; menu : « Couper le son M »,
« Lecture en boucle L », « Vitesse < / > ▸ » ; pendant la saisie d'un tag, ces touches ne font rien ;
bouton Favoris : « Ajouter aux favoris (S) ».

## Flèches précédent / suivant et liste des suggestions (16/10/2026) — Backup v30

SPEC : SRCH-25 validé `[x]` ; NAV-07 (nouvelle) livrée `[~]` ; IMP-52 (nouvelle, à faire plus tard) :
ouvrir vers le haut la liste des suggestions des tags par défaut quand la place manque en dessous.

- NAV-07 : la liste des suggestions d'un champ de tag ne compte plus pour la navigation. Les flèches
  de la barre de titre montrent toujours l'historique réel (avant : « précédent » s'allumait même
  sans historique, « suivant » se grisait tout en restant utilisable) ; les boutons 4 / 5 de la
  souris font comme elles (retour / avance, fermeture de la visionneuse ; choix de l'utilisateur) ;
  seule Échap ferme d'abord la liste (option « Échap seulement » de la pile des éléments ouverts).

Vérifié dans la version compilée (bibliothèque « booru », fenêtre fraîchement ouverte), avant puis
après le correctif :
- sans historique, liste affichée : flèches grisée / grisée (avant : active / grisée) ;
- avec un historique dans les deux sens, liste affichée : active / active (avant : active / grisée) ;
- liste affichée : bouton 5 → recherche suivante, bouton 4 → précédente, liste fermée (avant :
  le bouton 5 ne faisait rien, le bouton 4 fermait seulement la liste) ; Échap ferme seulement la
  liste ; clic sur la flèche « suivant » → recherche suivante ;
- visionneuse, liste de l'ajout de tag affichée : Échap ferme seulement la liste ; bouton 4 ferme
  la visionneuse.

## Suggestions sans barre de défilement (16/10/2026) — Backup v29

SPEC : SRCH-18, SRCH-22, SRCH-24 et VIEW-46 validés `[x]` ; CTX-01, CTX-03, CTX-18, GEN-13 et GEN-17
laissés ouverts comme bases communes à suivre pour la suite (confirmé par l'utilisateur) ; SRCH-25
(nouvelle) livrée `[~]` ; DUP-05 (nouvelle, phase 5) : après un import, proposer de supprimer du
disque les doublons détectés.

- SRCH-25 : la liste des suggestions (barre latérale, visionneuse, import) prend la hauteur de ses
  suggestions (10 au plus, d'une ou deux lignes) : toutes sont affichées, sans barre de défilement.
  Avant : hauteur limitée à 288 px, alors que 10 noms d'une ligne en demandent 290 : la barre
  apparaissait presque toujours.

Vérifié dans la version compilée (copie de la base « booru », avec 10 tags à nom long) : barre
latérale, visionneuse et import, 10 noms d'une ligne : 290 px, 10 noms de 2 lignes : 490 px, 5 noms :
170 px ; aucun contenu qui défile, aucune barre de défilement (avant : barre de 10 px dans les trois
listes dès 10 suggestions).

## Recherche : dépliage sur toute la ligne, nouvelle recherche, bulles des noms coupés, pop-in de création (16/10/2026) — Backup v28

SPEC : SRCH-19, SRCH-20, SRCH-21 et SRCH-23 validés `[x]` ; SRCH-18 et SRCH-22 précisés `[~]` ;
SRCH-24 et VIEW-46 (nouvelles) livrées `[~]`. Choix : D-030.

- SRCH-18 : les pastilles se déplient dès que la souris approche de toute leur ligne (16 px à
  gauche, à droite et en dessous ; rien au-dessus : passer sur « Tout effacer » ne déplie rien).
  Sans recherche, la ligne affiche « Aucun tag dans la recherche » en gris. Une pastille coupée par
  « … » montre son nom complet dans une bulle au survol.
- SRCH-22 : un nom de suggestion coupé par « … » montre son nom complet dans une bulle au survol.
- SRCH-24 : Entrée ou le bouton de recherche lancent une nouvelle recherche avec les tags tapés
  seulement (avant : ajoutés à la recherche en cours, comme « + ») ; « solo -solo » tapés ensemble :
  le dernier l'emporte, comme avant.
- VIEW-46 : pop-in « Créer un nouveau tag » : un nom long passe à la ligne dans la largeur de la
  pop-in, 2 lignes au plus puis « … » (bulle au survol) ; la pop-in grandit vers le haut, les
  boutons ne bougent pas.

Vérifié dans la version compilée (copie de la base « booru », avec un tag de 162 caractères) :
- texte « Aucun tag dans la recherche » centré dans la ligne de 22 px ; titre « Tags » toujours à
  247 px ;
- dépliage : rien sur « Tout effacer », à 3 px au-dessus de la ligne ni à 20 px à sa gauche ;
  déplié à 15 px à gauche, sur le bord et au milieu de la ligne, et à 15 px sous les pastilles
  dépliées ; replié en remontant sur « Tout effacer » et à 20 px dessous ;
- « solo highres » + Entrée → solo + highres ; puis « 1girl » + Entrée → 1girl seul ; + d'une ligne
  de tags → 1girl + touhou ; « smile -smile » + bouton → −smile ; champ vidé ;
- bulles (attribut posé au survol, seulement si le nom est coupé) : 1re pastille coupée, 2e
  suggestion coupée (la 1re, entière, n'en a pas), nom coupé de la pop-in. La bulle elle-même
  (fenêtre de Windows) n'a pas pu être capturée par mes outils : à confirmer à l'œil ;
- pop-in : nom court → même place au pixel près qu'avant ; nom de 55 caractères → 2 lignes ; nom de
  116 caractères → 2 lignes puis « … » ; dans les 3 cas, bas de la pop-in à 653 px et bouton
  « Créer » à 592-628 px (avant : le nom débordait de 40 à 540 px à droite et les boutons
  descendaient de 10 px).

## Barre de recherche : termes sur une ligne, suggestions par mot (15/10/2026) — Backup v27

SPEC : SRCH-18 à SRCH-23 (nouvelles) livrées `[~]` ; SRCH-16, SRCH-17 et VIEW-44 validés `[x]`.
Choix : D-029.

- SRCH-18 : une seule ligne de pastilles sous le champ ; les termes en trop sont résumés par un
  « +N » collé au bord droit. La souris arrivée à 16 px du « +N » déplie les autres par-dessus la
  liste des tags ; elles se replient quand elle s'éloigne de plus de 16 px. La place de la ligne est
  toujours réservée : la liste des tags ne bouge plus.
- SRCH-19 : « Tout effacer » sur sa propre ligne, centré, juste au-dessus des pastilles ; visible mais
  grisé sans recherche.
- SRCH-20 : plusieurs tags tapés d'un coup : les suggestions portent sur le mot où se trouve le
  curseur de saisie (après chaque espace, ou en revenant dans un mot).
- SRCH-21 : boutons + / − à gauche de chaque suggestion de la barre latérale (ajout immédiat à la
  recherche ; le mot en cours est effacé, les autres restent). Clic sur le nom ou Entrée sur la
  suggestion choisie : le tag s'écrit dans le champ à la place du mot, suivi d'un espace.
- SRCH-22 : noms longs : la liste s'élargit jusqu'au double, puis le nom passe sur 2 lignes, puis
  « … » (barre latérale, visionneuse, import). La barre latérale passe au-dessus de la grille pour que
  la liste élargie ne soit pas cachée par les vignettes.
- SRCH-23 : suggestion survolée (ou choisie au clavier) sur fond gris plus clair (#2a2c33), nom dans
  la couleur de sa catégorie.

Vérifié dans la version compilée (bibliothèque de test « booru ») :
- liste des tags immobile, mesurée au pixel : titre « Tags » à 247 px sans recherche, avec 1 terme et
  à chaque terme ajouté jusqu'à 10 ;
- « Tout effacer » centré (centre 144 px = centre de la ligne), grisé (curseur « interdit ») sans
  recherche ;
- 10 termes : 2 pastilles + « +8 » au bord droit ; repliées à 20 px du « +N », dépliées à 15 px (à
  gauche comme au-dessus), toujours dépliées dans le panneau et à 15 px sous lui, repliées à 20 px ;
  rien ne se déplie sur « Tout effacer » (64 px du « +N ») ; 1re catégorie de tags à 48 px du « +N » ;
- 1re pastille très longue : coupée par « … » à côté du « +4 », sur la même ligne ; Tab saute les
  pastilles cachées ; menu burger toujours au-dessus de la barre latérale ;
- « 1gi » → 1girl ; espace → liste fermée ; « sol » → solo… ; « -lon » → −long hair… ; curseur ramené
  dans « 1gi » → 1girl ; Entrée sur la 1re → « -long_hair » écrit, suivi d'un espace ; clic sur un nom au milieu du
  texte → remplacé ; + → highres ajouté, mot effacé ; − → −smile ; Entrée → le reste du champ ;
- noms longs : liste de 224 px élargie à 392-448 px (×2 au plus), nom de 67 caractères sur 2 lignes,
  nom de 162 caractères coupé à 2 lignes par « … » (tag créé sur une COPIE de la base), sans
  défilement horizontal ; visionneuse : ×1,88 au plus, au-dessus du champ, sans + / − ; import :
  inchangé (champ large) ;
- survol : fond rgb(42, 44, 51) sur la liste rgb(31, 33, 38), couleur de catégorie gardée (barre
  latérale, visionneuse, import).

## Fond gris très sombre, rayure remontée d'un pixel (15/10/2026) — Backup v26

SPEC : VIEW-45, NAV-06 et ZOOM-10 validés `[x]` ; VIEW-44 et SRCH-16 ajustés `[~]`.

- VIEW-44 : fond de la visionneuse gris très sombre (#0d0e12), choix de l'utilisateur après
  comparaison des deux versions de `Backups/v24`.
- SRCH-16 : rayure d'un tag exclu remontée d'un pixel (ligne juste au-dessus du centre de la croix).
- SRCH-17 (réponse à une question, rien de changé) : mémoire de l'index bornée, mesurée.

Vérifié dans la version compilée :
- fond de la scène rgb(13, 14, 18) ;
- rayure sur la ligne 10 de la pastille (croix et lettres sans jambage centrées entre les lignes
  10 et 11) ;
- 5 000 recherches toutes différentes (1 à 4 termes tirés parmi les 3 008 tags, exclusions
  comprises) sur la base de 300 000 médias : 27 s en tout ; mémoire de MyBoard 72 Mo au départ,
  puis 109-110 Mo de la 1 000e à la 5 000e recherche (le plafond de 256 ensembles joue).

## Fond de la visionneuse, poubelle de la note, recherches dans l'historique, rayure, petites images (15/10/2026) — Backup v25

SPEC : VIEW-44, VIEW-45, NAV-06, SRCH-16 et ZOOM-10 livrés `[~]`. Choix : D-028.
`Backups/v24` = les deux versions du fond à comparer (code et programme de chacune).

- VIEW-44 : fond uni derrière le média au lieu du damier. Deux versions : « Noir » (#000000) et
  « Gris-tres-sombre » (#0d0e12) ; le Workspace et `target\release\myboard.exe` = noir en attendant
  ton choix. Le bug du fond devenu noir sur les vidéos en plein écran n'a pas pu être reproduit.
- VIEW-45 : poubelle rouge en haut à droite de la note (grisée si la note est vide) ; même
  confirmation que « Effacer la note… » du menu (« Oui » rouge ; Échap ou le bouton 4 annulent).
- NAV-06 : chaque recherche est une étape de l'historique : flèches de la barre de titre, boutons
  4 / 5 de la souris et Alt + ← / → passent d'une recherche à l'autre (avant : flèches grisées).
- SRCH-16 : rayure d'un tag exclu au centre de la croix et du texte (avant : 1,5 px trop haut).
- ZOOM-10 : clic sur une petite image : 200 % ; nouveau clic : 100 %.

Vérifié dans la version compilée (les deux versions pour le fond) :
- fond de la scène : rgb(0, 0, 0) (Noir), rgb(13, 14, 18) (Gris-tres-sombre) ;
- note : poubelle grisée sur une note vide, active après la frappe ; confirmation « Effacer la
  note ? » ; Échap et bouton 4 la ferment (note toujours ouverte, en écriture) ; « Oui » (rouge)
  efface la note et la ferme ;
- historique : « highres », « + 1girl », « − touhou » : précédent → « highres + 1girl » →
  « highres » ; Alt + → et suivant reviennent ; clic sur une pastille de la visionneuse puis
  précédent : recherche d'avant ; flèche suivant grisée au bout ;
- rayure, mesurée au pixel : croix et lettres sans jambage centrées entre les lignes 10 et 11 de
  la pastille ; nouvelle rayure ligne 11 (ancienne ligne 9) ;
- « petite.png » (300 × 200) : clic → 600 × 400, badge 200 %, curseur main ; clic → 300 × 200,
  plus de badge, loupe.

## Recherche par tags rapide à grande échelle (15/10/2026) — Backup v23

SPEC : SRCH-17 (nouvelle) livrée `[~]` ; CTX-13 et GEN-18 validés `[x]` ; IMP-51 reporté en
phase 4 ; SET-12 ajoutée (dossier des captures). Choix : D-027.

- SRCH-17 : la recherche par tags passe par un index en mémoire (ensemble des médias de chaque
  tag recherché, gardé et combiné en mémoire). Les tags ajoutés par + / − ou par le champ, les
  exclusions, les jokers et les filtres de type ne ralentissent plus la recherche, et changer de
  page ne refait plus la recherche. L'index suit automatiquement les ajouts et retraits de tags
  et de médias (compteur tenu par la base, schéma v4).
- Cause du blocage de 3 à 5 s vu par l'utilisateur : un filtre de type coché (Images…) avec
  2 tags ou plus faisait prendre à l'ancienne méthode 2,8 à 5 s (40 s à 100 000 médias).
- Tris « date ↑ » et « résolution ↑ » : deux index ; la page n'oblige plus à retrier toute la
  bibliothèque (≈ 150 ms → moins de 10 ms à 300 000 médias, avec ou sans recherche).

Vérifié dans la version compilée :
- résultats identiques à l'ancienne méthode (nombre, page, ordre des médias) : 250 recherches
  tirées au hasard sur « booru » (3 300 médias), 250 sur « 100k », 120 sur une base synthétique de
  300 000 médias (8,5 millions de liens, tags présents sur 50 à 99 % des médias) : tous les tris,
  types, exclusions, jokers, tags inexistants, pages au-delà de la fin ;
- durées de la recherche à 300 000 médias : 1re recherche avec des tags très lourds 40 à 240 ms
  (selon que le disque a déjà lu la base) au lieu de 0,25 à 1,1 s ; ensuite (autres combinaisons
  de ces tags, page suivante) 4 à 5 ms ; tri aléatoire 6 à 13 ms ; par poids 5 à 11 ms ; date ↑
  5 à 11 ms ;
- dans l'interface (« booru », filtre « Images », 5 tags lourds ajoutés un à un) : la recherche
  prend 6 à 8 ms (avant : 2,8 à 4 s), l'affichage complet 150 à 200 ms ;
- tag ajouté puis retiré à un média : la recherche en tient compte aussitôt (2 753 → 2 754 → 2 753) ;
- migration v4 sur des copies des bibliothèques de test (et de la base de 300 000).

## Menu de la fenêtre, Copier l'image, capture vidéo, fond d'écran, zoom, repli complet (15/10/2026) — Backup v22

Lot 3 de GEN-12 (dernier de l'étape 1). SPEC : CTX-13 livré `[~]` ; CTX-06, CTX-07 et CTX-11
complétés. Choix techniques : D-026.

- CTX-13 : clic droit sur la barre de titre (pas sur ses boutons) ou Alt + Espace : menu MyBoard
  Restaurer, Déplacer, Taille, Réduire, Agrandir, Fermer (Alt+F4), entrées grisées selon l'état de
  la fenêtre, comme celui de Windows ; Déplacer et Taille au clavier, comme dans Windows. Alt +
  Espace n'ouvre plus celui de Windows ; en plein écran, il n'ouvre rien.
- CTX-06 : Copier l'image (l'image elle-même, à coller dans Paint, une conversation…) ; Zoom ▸
  Défaut, 100 % (grisé si le défaut est déjà 100 %), 150 %, 200 %, 400 % ; Utiliser comme fond
  d'écran du bureau… (confirmation, « Oui » doré).
- CTX-07 : Enregistrer une capture d'écran… : l'image affichée au clic droit, taille réelle de la
  vidéo, sans rien de l'interface, en .jpg, fenêtre « Enregistrer sous » de Windows avec le nom
  « Screenshot_[nom]_[numéro de l'image]_JJ-MM-AA.jpg » ; Zoom ▸ comme les images.
- CTX-11 : Replier complètement : plus aucun tag de la catégorie (flèche vers la droite) ; un clic
  sur l'en-tête déplie tout, un nouveau clic revient aux 10 premiers.

Vérifié dans la version compilée (bibliothèques « booru » et « divers ») :
- Zoom ▸ 200 / 400 / 150 / 100 % : badge 200 %, 400 %, 150 %, 100 % ; Défaut : plus de badge ;
  vidéo : idem ; petite image : 100 % grisé, 200 % marche ;
- Copier l'image (JPEG 3475 × 2316) : le presse-papiers contient une image de 3475 × 2316 ;
- fond d'écran : confirmation affichée (« Oui » doré, entrée non rouge), puis « Annuler » : menu
  toujours ouvert. **Pas essayé jusqu'au bout** : cela aurait remplacé ton fond d'écran ;
- capture (vidéo à 4 images/s, en pause à 1,0 s) : nom proposé
  « Screenshot_12364051_4_15-10-26.jpg », fichier JPEG de 1280 × 904 (taille de la vidéo), image
  sans rien de l'interface ; fenêtre fermée sans enregistrer : rien d'écrit ;
- barre de titre : menu au point du clic, Restaurer / Agrandir / Réduire (état de la fenêtre
  relevé après chacun), entrées grisées selon l'état ; clic droit sur « Réduire » : rien ;
  vrai clavier : Alt + Espace → menu MyBoard sous le coin haut gauche, « Restaurer » choisi, menu
  de Windows absent, flèche bas saute les entrées grisées, Échap ferme ; Déplacer + flèche droite
  ×5 + Entrée : fenêtre déplacée de 55 px ; Taille + Échap : rien ne change ; en plein écran,
  Alt + Espace : aucun menu ; Fermer : l'application se ferme ;
- Replier complètement : catégorie vide, flèche tournée ; clic : tous les tags ; nouveau clic :
  les 10 premiers ; catégorie d'un seul tag : repliée puis rouverte d'un clic.

## Menus du clic droit des tags, vignettes, visionneuse, note et barre latérale (15/10/2026) — Backup v21

Lot 2 de GEN-12. SPEC : CTX-02 (testable maintenant), CTX-04 à CTX-12 et CTX-19 (nouvelle : pop-in
d'erreur) livrés `[~]` ; dans CTX-06, CTX-07 et CTX-11, les fonctions du lot 3 sont grisées en
attendant. Choix de l'utilisateur et détails : D-025.

- CTX-04 : tags (pastilles de la visionneuse, lignes de la barre latérale) : Copier le tag (forme
  `long_hair`), Retirer de cette image / vidéo / ce document / ce fichier audio (visionneuse) ;
  Renommer, Changer de catégorie ▸ (catégories en couleur, l'actuelle cochée), Masquer, Supprimer :
  grisés jusqu'au gestionnaire de tags.
- CTX-05 : vignette : Ouvrir, Copier le fichier, Ouvrir avec l'application par défaut, Afficher dans
  l'explorateur de fichiers, Copier le chemin du fichier ; favoris, dossier, sélection, suppression
  grisés.
- CTX-06 : image (clic droit sur l'image elle-même) : Copier le fichier, Plein écran / Quitter le
  plein écran, Copier le chemin, Ouvrir avec, Afficher dans l'explorateur, Imprimer, avec leurs
  raccourcis ; Copier l'image, Zoom ▸ et fond d'écran : lot 3.
- CTX-07 : vidéo : Lire / Pause, Couper / Rétablir le son, Lecture en boucle (cochée), Vitesse ▸,
  Plein écran, Copier le fichier, Copier le chemin, Ouvrir avec, Afficher dans l'explorateur, à
  l'image de la barre de lecture ; capture et Zoom ▸ : lot 3.
- CTX-08 : nom du fichier : Copier le nom, Copier le chemin du fichier, Afficher dans l'explorateur.
- CTX-09 / CTX-02 : note écrite : Modifier, Copier le texte, Effacer la note… (rouge, confirmation
  « Oui » rouge ; Échap ou le bouton 4 ferment la confirmation et laissent le menu).
- CTX-10 : lien d'une note : Ouvrir le lien, Copier le lien.
- CTX-11 : en-tête de catégorie : Déplier / Replier (aussi sur une catégorie sans dépliage, grisé) ;
  Replier complètement : lot 3.
- CTX-12 : termes de la recherche : Inclure / Exclure (le terme garde sa place), Copier le tag, Tout
  effacer ; Renommer, Changer de catégorie, Masquer grisés.
- CTX-19 : échec d'une action lancée depuis une vignette (fichier introuvable…) : pop-in avec le
  même contenu que dans la visionneuse, « Copier » (→ « Copié » 1,5 s) et « OK ».

Vérifié dans la version compilée (bibliothèque « booru », et une petite bibliothèque de test dont
j'ai supprimé l'unique fichier, une copie, pour CTX-19) :
- chaque menu ouvert au vrai point du clic, entrées et entrées grisées dans l'ordre de la SPEC ;
- vignette : Copier le chemin → chemin complet ; Ouvrir → visionneuse sur ce média ;
- image : Plein écran puis Quitter (barre de titre cachée puis revenue, libellé inversé) ; Copier le
  chemin ; clic droit sur le fond autour de l'image : rien ;
- nom du fichier : Copier le nom → « 12364066.jpg » ;
- pastille « sayonara lara » : Copier le tag → « sayonara_lara » ; Retirer → 89 → 88 pastilles
  (tag remis ensuite) ;
- vidéo : Pause (libellé devenu « Lire »), Couper le son, boucle décochée, Vitesse ▸ 1,5× : la
  barre de lecture affiche 1,5×, boucle décochée, puis tout remis ; flèche bas avec le sous-menu
  ouvert au survol : il se ferme, la sélection descend ;
- note : Copier le lien, Copier le texte, Modifier ; Effacer la note… : confirmation, Échap et
  bouton 4 la ferment en gardant le menu, « Oui » (rouge) efface la note et ferme tout ;
- barre latérale : Copier le tag « mon tag test » → « mon_tag_test » ; Déplier / Replier ;
  catégorie de 1 tag : menu avec « Déplier » grisé, curseur flèche ;
- termes « mon tag test | black souls » : Exclure → « −mon tag test | black souls » (même place),
  Inclure, Tout effacer ;
- CTX-19 : Ouvrir avec, Afficher dans l'explorateur et Copier le fichier sur le fichier supprimé :
  pop-in « … : échec / Erreur Windows 2 / Fichier introuvable : … / explication » ; Copier → bouton
  « Copié » et texte complet dans le presse-papiers, « Copier » 1,6 s après ; OK ferme.

## Menus du clic droit : base commune, curseurs, raccourcis du navigateur (15/10/2026) — Backup v20

Lot 1 de GEN-12 (menus du clic droit), en 3 lots. SPEC : GEN-12, GEN-13, GEN-17, GEN-18, CTX-01,
CTX-03 et CTX-18 (nouvelle : « Copier » sur un texte sélectionné, choix de l'utilisateur) livrés
`[~]` ; CTX-02 prêt, à tester au lot 2 (premier menu avec une confirmation). Choix : D-024.

- CTX-01 : le menu du navigateur (Retour, Actualiser, Enregistrer sous, Imprimer) ne s'ouvre plus
  nulle part, lecteur PDF compris ; un clic droit là où MyBoard n'a pas de menu n'ouvre rien.
  Menu maison commun, apparence du menu de tri, sans icônes : ouvert au point du clic (à gauche /
  au-dessus s'il manque la place), fermé par un clic ailleurs (qui ne fait rien d'autre), Échap,
  le bouton 4, la molette (sans défiler), un changement de page ou de fenêtre ; flèches + Entrée ;
  touche Menu ou Maj + F10 ; séparateurs comme Firefox (7 px sans réaction) ; sous-menus « ▸ » ;
  actions dangereuses en rouge avec confirmation (CTX-02 : Échap ou bouton 4 ferment la pop-in et
  gardent le menu, « Oui » rouge agit et ferme tout).
- CTX-03 : menu d'édition dans tous les champs de saisie (recherche, ajout de tag, tags par défaut,
  numéro de page, note en écriture) : Annuler, Couper, Copier, Coller, Supprimer, Tout
  sélectionner, grisés quand ils sont sans objet. Le champ garde sa sélection ; la note reste en
  écriture.
- CTX-18 : clic droit sur un texte sélectionné (nom du fichier, compteurs…) : « Copier ».
- GEN-13 : curseurs selon la règle commune : flèche par défaut (textes compris), main sur ce qui
  se clique (choix des listes déroulantes, curseur de la disposition…), barre « I » dans les
  champs, « interdit » sur les boutons grisés (y compris « Importer » et les boutons de la page
  d'import, qui montraient la flèche), flèche sur Réduire / Agrandir / Fermer et sur les flèches
  grisées de la barre de titre et de la pagination ; rond qui tourne pendant « Copier »,
  « Explorer », « Ouvrir avec » et quand une page de la grille tarde plus de 0,3 s.
- GEN-17 : nom et infos du fichier, compteurs, titres : sélectionnables à la souris, curseur flèche.
- GEN-18 : F5, Maj + F5, Ctrl + F5, Ctrl + P, Ctrl + F, F3, Ctrl + G, Ctrl + S et F7 ne font plus
  rien (page et lecteur PDF) ; Ctrl + R et Ctrl + Maj + R rechargent toujours ; Alt + ← / → =
  précédent / suivant de MyBoard.

Vérifié dans la version compilée (bibliothèques « booru » et « divers ») :
- vrai clic droit : grille, barre de titre, barre des filtres, lecteur PDF : aucun menu ; champ de
  recherche : menu d'édition au point du clic, Coller actif (texte dans le presse-papiers) ;
- menu d'édition, tout essayé : Couper (« abc def », « def » sélectionné → « abc », presse-papiers
  « def »), Coller, Annuler, Tout sélectionner, Copier, Supprimer ; flèches + Entrée ; une lettre
  tapée menu ouvert est ignorée ; numéro de page et note compris (la note reste ouverte, un clic
  ailleurs ferme seulement le menu) ;
- fermetures : Échap (le champ garde le focus), bouton 4, molette (la page ne défile pas), clic sur
  une vignette (menu fermé, visionneuse non ouverte ; le clic suivant l'ouvre) ;
- sélection du compteur → « Copier » → presse-papiers « 3 300 médias » ; clic droit hors de la
  sélection : rien ; Maj + F10 dans le champ : menu, première entrée choisie ;
- vrai clavier : F5, Maj + F5, Ctrl + F5, Ctrl + P, Ctrl + F, F3, Ctrl + G, Ctrl + S, F7 : ni
  rechargement, ni impression, ni fenêtre ; idem le curseur dans le PDF ; Alt + ← rouvre la
  dernière image, Alt + → la referme ; Ctrl + R recharge ;
- curseurs relevés élément par élément (grille, barre latérale, en-tête, barre de titre,
  visionneuse) ; sélection à la souris du compteur, des stats, des titres, du nom et des infos du
  fichier ; classe d'attente pendant « Copier » et pendant une page de grille ralentie ;
- menu de démonstration (accès de test temporaire, retiré) : séparateurs de 7 px, trait à 16 px
  des bords, clic dessus sans effet ; sous-menu à gauche près du bord droit ; menu ouvert dans le
  coin bas droit placé au-dessus et à gauche du point ; confirmation : Échap et bouton 4 la
  ferment en gardant le menu, « Oui » (rouge) agit et ferme tout.

## Commandes ancrées même en défilement rapide (14/10/2026) — Backup v19

SPEC : VIEW-34, VIEW-43 et NAV-05 validés `[x]` ; VIEW-42 corrigé `[~]` ; GEN-16 noté `[>]`
(nom du son dans le mélangeur de volume de Windows, reporté en phase 5).

- VIEW-42 : en faisant défiler très vite les médias (flèche maintenue), la barre de lecture et le
  bouton plein écran ne vibrent plus. La hauteur de la barre du bas était mesurée après
  l'affichage et arrivait une image en retard (écart de 20 à 48 px pendant 1 à 2 images, mesuré) :
  elle est maintenant transmise avant l'affichage, et remesurée dès que les tags arrivent. Un
  média sans tag ne décale plus l'ancrage de 6 px (hauteur d'une pastille gardée).

Vérifié dans la version compilée, position du bas de la commande relevée à chaque image :
- vidéos, appuis toutes les 40, 25 et 15 ms (plus vite que la touche maintenue), en fenêtre :
  barre de lecture toujours à 845 sur 1 387 images (avant : écarts de 20 à 48 px à presque chaque
  changement de média) ; en plein écran : 845 sur 422 images ;
- images, appuis toutes les 25 ms : bouton plein écran toujours à 853, en fenêtre et en plein
  écran ; bibliothèque « divers » : même place (813 → 853) ;
- inchangés : flèches (464 → 512), bouton rangé à côté de la flèche, barre dépliée en plein écran.

## Plein écran Mix_test, commandes ancrées, barre dépliée, bord haut (14/10/2026) — Backup v18

SPEC : VIEW-39, VIEW-40 et VIEW-41 validés `[x]` ; VIEW-34 (choix : Mix_test), VIEW-42, VIEW-43 et
NAV-05 livrés `[~]`. Choix : D-023.

- VIEW-34 : plein écran de la version « Mix_test » de `Backups/v16` (seul `fullscreen.rs` repris) :
  coin de la fenêtre immobile (pas de tremblement), pas de débordement du côté d'un écran voisin
  à droite ou en bas (pas de ligne), animations de Windows gardées. En plus : en sortant, le style
  « barre de titre » n'est remis qu'après la bascule (400 ms), ce qui supprime la bande de 8 px
  vue environ une sortie sur 20.
- VIEW-42 : barre de lecture des vidéos et bouton rond plein écran des images ancrés à la place
  « barre du bas repliée la plus épaisse » (3 lignes de tags + « Afficher plus »), en fenêtre
  comme en plein écran.
- VIEW-43 : plein écran, barre du bas dépliée : elle se cache quand la souris s'éloigne (un bouton
  cliqué ne la retient plus, seule la saisie d'un tag) ; affichée, elle reste tant que la souris
  est dessus ou à moins de 60 px de son bord haut ; les commandes flottantes glissent avec elle.
  « Afficher plus » ne prend plus le focus au clic (plus de cadre doré après F).
- NAV-05 : double-clic sur le bord haut de la fenêtre = agrandir (comme le bouton carré).

Vérifié dans la version compilée :
- Plein écran, MyBoard sur l'écran 1440p, fond blanc sur le 1080p voisin, 60 bascules filmées :
  aucun tremblement de 8 px (3 décalages de 1 px, des arrondis, comme les autres versions), aucune
  bande à la sortie (avant : 1 sur 40, puis 3 sur 60) ; 2 fois une ligne de 1 px pendant une
  image à l'entrée. Réduire puis rétablir : 19 images d'animation de Windows. MyBoard sur le
  1080p (écran voisin à gauche) : pas de tremblement ; la ligne de 2 px reste (limite connue).
- VIEW-42 : 10 vidéos (barre du bas de 123 à 171 px) : barre de lecture toujours de 801 à 845,
  en fenêtre et en plein écran ; 20 images : bouton rond toujours de 813 à 853.
- VIEW-43, image puis vidéo : clic sur « Afficher plus » (le focus reste sur la page), F, souris
  au milieu : barre cachée ; souris en bas : barre dépliée affichée, bouton plein écran / barre
  de lecture au-dessus d'elle ; souris en haut de la barre et à 40 px au-dessus : toujours
  affichée ; à 80 px : cachée ; « Réduire » puis souris au milieu : cachée ; saisie d'un tag :
  reste affichée, puis cachée une fois la saisie finie. Vidéo immobile 3,5 s : barres et curseur
  cachés. Rangement du bouton à côté de la flèche (VIEW-39) inchangé.
- NAV-05, à la vraie souris : curseur ↕ sur le bord haut ; double-clic → fenêtre agrandie ; tirer
  le bord haut redimensionne toujours ; double-clic sur le bord bas : comportement de Windows.

## Visionneuse — symétrie du bouton rangé, barre du bas stable, ouverture (14/10/2026) — Backup v17

SPEC : VIEW-39 (précision), VIEW-40 et VIEW-41 livrés `[~]`. Choix : D-022. Le plein écran
(VIEW-34) n'est **pas** dans ce commit : 4 versions à comparer dans `Backups/v16` (code et
programme de chacune ; mesures dans « new V2/Explications plein écran/Comparatif v16.txt »),
choix de l'utilisateur en attente. Le Workspace contient la version « Mix_test ».

- VIEW-39 : le bouton plein écran rangé à côté de la flèche droite a le même écart en haut et en
  bas (avant : 3 px / 4 px). Cause : la flèche était à un demi-pixel (Chrome la calait sur un
  pixel entier, pas le bouton rond) ; positions arrondies au pixel.
- VIEW-40 : en passant d'un média à l'autre, la barre du bas ne rétrécit plus le temps de lire les
  tags pour regrandir ensuite : les tags des médias voisins sont lus d'avance (comme leurs
  images), et si ceux du nouveau média ne sont pas encore là, la zone des tags garde sa hauteur.
- VIEW-41 : ouverture de la visionneuse : fond noir, barre du bas et boutons dès la première
  image ; seul le média apparaît en fondu avec un léger zoom (la galerie ne se voit plus).

Vérifié dans la version compilée :
- Bouton rangé, mesuré au pixel : flèche de 464 à 511, bouton de 468 à 507 : 4 px en haut, 4 px
  en bas, bords nets (avant : bord du bouton flou, 3 px / 4 px) ; flèche toujours à 464 → 512.
- Barre du bas suivie image par image (haut de la barre et nombre de tags) : 9 médias à 700 ms
  d'intervalle puis 9 à 150 ms : la barre a sa bonne hauteur dès la première image de chaque
  média. Tags rendus artificiellement lents (400 ms, appuis toutes les 250 ms) : la barre garde
  sa hauteur pendant l'attente (0 tag affiché), puis les tags apparaissent sans qu'elle bouge.
- Ouverture filmée à 60 i/s, 4 ouvertures : bande sous la barre et côtés à leur état final dès
  la première image (avant : 8 à 11 images, la galerie visible) ; seul le média évolue.
- Barre de lecture des vidéos : même place qu'avant (24 px au-dessus du bas de la scène) et
  toujours cliquable.

## Visionneuse — flèches ancrées, barre du bas dépliable, pastilles (13/10/2026) — Backup v15

SPEC : VIEW-38 et GEN-14 validés `[x]` ; VIEW-39 (avec sa précision du jour) et GEN-15 livrés
`[~]`. Choix : D-021. Le plein écran (VIEW-34) n'est **pas** dans ce commit : l'essai en cours
(`fullscreen.rs`, zéro tremblement mais une ligne de 2 px sur l'écran voisin) attend le choix de
l'utilisateur ; la sauvegarde v15 contient cet essai.

- VIEW-38 : hors plein écran, les flèches précédent / suivant restent à la place qu'elles ont avec
  une barre du bas d'une seule ligne de tags, quel que soit le média.
- VIEW-39 : barre du bas limitée à 3 lignes de tags ; au-delà, bouton « Afficher plus » (flèche
  en V) qui déplie la barre vers le haut, par-dessus le média (moitié de la visionneuse au plus,
  puis barre de défilement), et devient « Réduire ». Flèches, bouton plein écran et barre de
  lecture glissent avec elle s'ils sont atteints. Précision : si la barre dépliée ferait monter le
  bouton plein écran (images) à moins de 8 px de la flèche droite, il se range à 16 px à gauche
  de la flèche, à sa hauteur (croquis de l'utilisateur), puis revient à sa place au repli.
- GEN-14 : croix des pastilles de tags à gauche du texte (composant partagé : visionneuse, barre
  latérale et page Importer).
- GEN-15 : texte des pastilles remonté de 1 px de plus, centré sur la croix.

Vérifié dans la version compilée (écran 1920 × 1080, bibliothèques de test) :
- Flèches : 14 médias de suite (1 à 7 lignes de tags) : flèche toujours de 464 à 512 px.
- Dépliage : place réservée (171 px) et scène (837 px) inchangées, barre montée de 112 px, barre
  de lecture et flèches suivent, puis tout revient au repli.
- Bouton plein écran : image à 197 tags, barre montée de 308 px : bouton rangé à 16 px à gauche
  de la flèche droite, centré sur elle (même résultat en plein écran) ; retour à sa place au repli.
  Images moins taguées (barre montée de 28 et 56 px) : le bouton monte simplement. Dernier média
  (pas de flèche droite) : il monte sans se ranger.
- Pastilles, mesurées au pixel avec des lettres sans jambage : 1 px d'écart en haut et 1 px en
  bas par rapport à la croix, dans la visionneuse, la recherche et la liste de la barre latérale.

## NAV-04 — Barre de titre MyBoard, plein écran sans saccade (13/10/2026) — Backup v14

SPEC : VIEW-33 et VIEW-37 validés `[x]` ; menus du clic droit (GEN-12) et curseurs (GEN-13) notés,
à détailler ; NAV-04 et VIEW-34 livrés `[~]`. Choix : D-020.

- NAV-04 : la barre de titre de Windows est remplacée par celle de MyBoard (32 px, au-dessus de
  l'en-tête) : icône et « MyBoard », flèches précédent / suivant (= boutons 4 / 5 de la souris,
  grisées quand ils ne feraient rien), réduire / agrandir (« Niveau inférieur » quand agrandie) /
  fermer (rouge au survol). Toute la barre déplace la fenêtre ; double-clic = agrandir / rétablir ;
  aimantation en haut de l'écran et redimensionnement par les bords conservés. Toujours visible,
  visionneuse comprise (elle s'ouvre dessous) ; cachée en plein écran.
- La page défile dans la zone sous la barre de titre : la barre de défilement commence sous elle.
- VIEW-34 : plein écran géré par MyBoard : la fenêtre reste agrandie, seul son bas descend jusqu'en
  bas de l'écran (barre des tâches cachée) ; la mise en page bascule exactement quand la fenêtre
  change de taille.
- `scripts/bench-grid.mjs` mesure le défilement de la nouvelle zone (et celui de la fenêtre pour
  les versions d'avant).

Vérifié dans la version compilée (un seul écran 1920 × 1080, 60 Hz, depuis ce jour) :
- Barre : 1920 × 32 px en haut, en-tête dessous, logo de l'en-tête toujours au centre (960 px),
  barre de défilement sous la barre de titre ; menu burger sous l'en-tête.
- Boutons : « Niveau inférieur » → fenêtre 1600 × 960 puis « Agrandir » → agrandie ; « Réduire » →
  dans la barre des tâches. À la vraie souris : double-clic (rétablir puis agrandir), glisser la
  fenêtre agrandie (Windows la rétablit et la déplace), glisser en haut de l'écran (aimantation :
  agrandie), bord droit tiré (1616 → 1416 px de large).
- Flèches : Importer → ← → Bibliothèque → → → Importer ; visionneuse : ← ferme, ← rouvre, ← ferme
  (← grisée : plus rien), → rouvre, → ferme, → rouvre (→ grisée) — même chemin que les boutons 4 / 5.
- Plein écran filmé à 60 i/s, 6 passages : barre de lecture immobile sur 5, une image décalée de
  8 px sur le 6e (avant : 5 images décalées de 23 à 31 px à chaque passage) ; fenêtre 1920 × 1080,
  barre des tâches cachée, barre de titre cachée.
- Défilement : Page suivante et molette dans la grille ; visionneuse ouverte, rien ne défile
  derrière (molette, Page suivante, Espace).
- Fluidité, 100 000 médias, même écran à 60 Hz, version d'avant NAV-04 recompilée pour comparer :
  page suivante 81 / 93 / 165 / 220 / 365 ms avant, 82 / 97 / 164 / 231 / 382 ms après (4 à 30
  colonnes) ; changer de densité 709 contre 714 ms à 30 colonnes ; défilement 60 images/s dans les
  deux cas — pas de différence mesurable. Une image lente au défilement à 20 colonnes (50 à 67 ms)
  dans les deux versions.

## Phase 2 — Masquage en plein écran : badge du zoom, souris sur l'autre écran (13/10/2026) — Backup v13

SPEC : GRID-11 validé `[x]` ; VIEW-33 repasse `[~]` (correction) ; nouvelle demande VIEW-37.

- VIEW-33 : le badge du zoom (pourcentage) se cache maintenant avec les autres commandes après 3 s
  sans mouvement de la souris.
- VIEW-37 : vidéo en plein écran, la souris passe sur l'autre écran : tout se cache aussitôt, sans
  attendre 3 s (barre du bas comprise) ; tout revient dès que la souris revient et bouge (le retour
  utilise le mécanisme déjà en place pour le mouvement).

Vérifié dans la version compilée, avec le vrai curseur de Windows (fenêtre en plein écran sur
l'écran 1080p, vidéo zoomée) : après 3,6 s immobile, curseur, barre de lecture, badge du zoom,
croix et flèches cachés ; 0,3 s après le passage sur l'écran 1440p, tout est caché ; retour et
mouvement : tout réapparaît ; barre du bas affichée (souris en bas) puis souris sur l'autre écran :
cachée en 0,4 s.

## Phase 2 — Vignettes « nom seul » (13/10/2026) — Backup v12

SPEC : VIEW-35 et VIEW-36 validés `[x]` ; nouvelle demande GRID-11. Choix : D-019.

- GRID-11 : quand une vignette fait moins de ~2,2 cm à l'écran (18 colonnes sur l'écran 24"
  1080p, 22 sur le 27" 1440p, calcul automatique pour les autres écrans), le badge vidéo / GIF, le
  poids et les dimensions disparaissent ; au survol, le nom prend toute la largeur, agrandi au
  maximum sur une ligne ; un nom trop long garde la taille normale et finit par « … ».
- Nouvelle commande `screen_dpi` (densité réelle de l'écran de la fenêtre, lue auprès de Windows).

Vérifié dans la version compilée :
- Seuils : écran 1080p (93 points par pouce) 17 colonnes = 2,32 cm → normal, 18 colonnes = 2,18 cm
  → nom seul ; écran 1440p (108 points par pouce, fenêtre déplacée dessus : densité relue) 21 col.
  = 2,30 cm → normal, 22 col. = 2,19 cm → nom seul ; jusqu'à 30 colonnes.
- Survol : badges, poids et dimensions masqués ; « 12363315.mp4 » à ≈ 20 px dans le calque des
  infos au lieu de 12, entier ; nom de 20 caractères à 13,9 px, entier ; noms de 23 et 26
  caractères à 12 px, terminés par « … ».
- Fluidité (100 000 médias, écran 1080p, deux mesures) : revenue au niveau d'avant GRID-10
  (30 colonnes : changer de densité 656–664 ms contre 659, page suivante 360–365 ms contre 372,
  0 saccade à la seconde mesure).

## Phase 2 — Copier, raccourcis, vignettes denses (13/10/2026) — Backup v11

SPEC : VIEW-18 et VIEW-32 validés `[x]` ; nouvelles demandes VIEW-35, VIEW-36, GRID-10, SET-10
(paramètres, plus tard) ; SEL-05 mis à jour (remplacé par GRID-10 pour la taille). Choix : D-018.

- VIEW-35 : bouton « Copier » à gauche de « Ajouter aux favoris » : le fichier lui-même va dans le
  presse-papiers, comme Ctrl + C dans l'Explorateur ; « Copié » s'affiche 1,5 s (en plein écran, la
  barre du bas apparaît le temps de la confirmation) ; échec = message avec le code Windows.
- VIEW-36 : raccourcis Copier Ctrl+C, Favoris L, Dossier D, Explorer E, Ouvrir avec O, Imprimer I,
  Supprimer Suppr, affichés dans les bulles d'aide. Inactifs pendant une saisie ou une pop-in ;
  Ctrl+C copie le texte s'il y en a de sélectionné. Favoris, Dossier, Supprimer : avec leurs
  boutons, en phase 3.
- GRID-10 : badges vidéo / GIF, nom, poids et dimensions des vignettes réduits avec la vignette dès
  qu'elle fait moins de 150 px (≈ 15 colonnes en 1440p, ≈ 11 en 1080p), jusqu'à 30 colonnes : même
  disposition qu'en grand, plus rien ne se chevauche.

Vérifié dans la version compilée :
- Copier : presse-papiers = le fichier (chemin exact, accents compris), effet « copie », ancien
  contenu vidé ; « Copié » puis « Copier » après 1,5 s ; Ctrl+C en plein écran affiche la barre le
  temps du « Copié ».
- Raccourcis : E et O ouvrent l'Explorateur et l'application par défaut, I imprime (images) ;
  L, D, Suppr sans effet (phase 3) ; lettres tapées dans le champ de tag sans effet ; texte
  sélectionné + Ctrl+C = le texte est copié, pas le fichier.
- Vignettes : aucun nom coupé (≤ 12 caractères), badge toujours sur la ligne du nom, poids et
  dimensions sur une ligne, rien ne dépasse — de 10 à 30 colonnes en 1920 × 1080 et de 14 à 30
  colonnes en largeur 2560 simulée ; captures du survol à 15 et 30 colonnes.
- Fluidité (100 000 médias, écran 1080p, deux mesures) : page suivante et défilement identiques à
  avant (30 colonnes : 372–389 ms contre 372 ; 0 saccade) ; changer de densité un peu plus long
  aux fortes densités (20 → 30 colonnes d'un coup : 777 ms contre 659, ≈ +12 ms par cran).

## Phase 2 — Plein écran : même place sur l'écran, contour doré (13/10/2026) — Backup v10

SPEC : VIEW-31 et VIEW-33 validés `[x]` ; nouvelle demande VIEW-34 (bascule du plein écran sans
saccade), reportée à NAV-04 au choix de l'utilisateur ; NAV-04 confirmée juste après la phase 2.

- VIEW-32 : en plein écran, la barre de lecture ne descend plus de la hauteur de la barre des
  tâches de Windows (qui disparaît) : MyBoard lit la zone de travail de l'écran et la remonte
  d'autant. Elle reste au même endroit sur l'écran dans les deux modes.
- VIEW-18 : même règle pour le bouton rond des images ; il porte un contour doré tant que le plein
  écran est actif, et seulement à ce moment-là. Le contour de focus du navigateur, qui apparaissait
  au hasard (clic sur le bouton puis touche F), est retiré des boutons plein écran (images et vidéos).
- VIEW-34 (mesuré, pas corrigé) : écran filmé à 60 images/s pendant la bascule ; la saccade vient de
  la barre de titre de Windows (le haut de la fenêtre se déplace, WebView2 met 3 à 5 images à
  redessiner). Essai sans barre de titre : plus de mouvement, mais le plein écran devra être géré
  par MyBoard → NAV-04.

Vérifié dans la version compilée (écran 1080p) : barre de lecture à 793→837 px de l'écran en mode
normal, en plein écran et au retour (avant : 40 px plus bas en plein écran) ; bouton des images à
777→817 px dans les deux modes ; contour doré présent en plein écran (clic, touche F), absent après
F et après Échap ; bouton des vidéos sans contour après un clic puis F.

## Phase 2 — Barre de lecture flottante, curseurs (13/10/2026) — Backup v9

SPEC : VIEW-30 déplacé sous VIEW-29 et validé `[x]`, VIEW-19 et VIEW-29 validés `[x]` ; nouvelle
demande NAV-04 (barre de titre MyBoard avec flèches avant / arrière), prévue juste après la phase 2.

- VIEW-32 : barre de lecture vidéo flottante par-dessus la vidéo, centrée, ≈ 45 % de la largeur,
  bords arrondis, à la même hauteur à l'écran en plein écran ou non (la barre du bas ne la
  recouvre jamais).
- VIEW-18 : pour les images, le bouton plein écran reste le bouton rond, au même endroit en plein
  écran (flèches inversées) — plus de bande de barre de lecture.
- VIEW-33 : vidéo en plein écran, souris immobile 3 s (même en pause) : curseur, barre de lecture,
  flèches, croix et bouton des notes se cachent ; ils reviennent dès que la souris bouge.
- VIEW-31 : loupe / main / pointeur seulement au-dessus du média ; flèche normale sur le fond.

Vérifié dans la version compilée (écran 1080p) : barre de lecture 864 × 44 px centrée, à 165 px du
bas de la fenêtre en plein écran comme hors plein écran ; masquage après 3,6 s et retour au
mouvement ; curseurs mesurés sur le média et sur le fond (image, vidéo, vidéo zoomée) ; bouton des
images 40 × 40 px au même endroit dans les deux modes.

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
