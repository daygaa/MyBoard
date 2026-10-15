# Historique des versions

Format : une entrée par tâche livrée, la plus récente en haut. Les IDs renvoient à `docs/SPEC.md`.
La colonne « Backup » renvoie au dossier `Backups/vX` correspondant.

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
