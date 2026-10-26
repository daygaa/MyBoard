# Historique des versions

Format : une entrée par tâche livrée, la plus récente en haut. Les IDs renvoient à `docs/SPEC.md`.
La colonne « Backup » renvoie au dossier `Backups/vX` correspondant.

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
