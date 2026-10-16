# MyBoard — Cahier des charges

> **Document de référence unique** : tout ce que l'application doit faire.
> Il remplace le flowchart, les fichiers `modif_UI*.txt`, le BACKLOG Python et le worklog GLM.
> Une demande = un identifiant stable (`ZONE-NN`). On ne renumérote jamais : une demande
> abandonnée passe en `[-]`, elle n'est pas effacée.

## Comment lire ce document

**Statuts**

| Marque | Sens |
|---|---|
| `[ ]` | à faire |
| `[~]` | en cours |
| `[x]` | fait **et validé par l'utilisateur** (Claude ne coche jamais seul) |
| `[?]` | à préciser avec l'utilisateur avant de coder |
| `[>]` | reporté à une phase ultérieure |
| `[-]` | abandonné (raison indiquée) |

**`(v8 ✓)`** = comportement déjà validé par l'utilisateur dans la version GLM v8 → à reproduire à l'identique.

**Sources** : `FC` flowchart · `R1` modif_UI.txt · `R2` modifUI-UX2.txt · `R3` modifUIUX3.txt ·
`R4` modifUI-UX4.txt · `IDEES` « UI-UX Ideas to do after » · `BUG` bugs_alreadysent.txt ·
`PY` PROJECT_STATE/BACKLOG de la version Python · `D` décision prise avec Claude (date) ·
`T1` « txt post-test/Précisions - problèmes 1.txt » (retours du test de la phase 1) ·
`T2` « txt post-test/Précisions - problèmes 2.txt » (retours du test de la phase 2).
Les fichiers sources sont dans `Versions historiques/` (lecture seule).

**Phases de développement** (détail dans `docs/DECISIONS.md`) :
1 Socle · 2 Visionneuse + tags + recherche · 3 Favoris, dossiers, sélection, suppression ·
4 Options d'import · 5+ Doublons, paramètres, scanner, IA…

---

## GEN — Principes généraux

- [~] **GEN-01** Application de bureau **locale**, hors ligne, Windows en priorité (Tauri 2). `D 11/10`
- [~] **GEN-02** L'interface reprend **l'apparence de la v8** (couleurs, disposition, composants). Seuls la plomberie, le découpage du code et les performances changent. `D 11/10` — Phase 1 : en-tête, menu, barre latérale, grille, filtres, import ; phase 2 : visionneuse, recherche, tags de la barre latérale, tags par défaut.
- [~] **GEN-03** Thème sombre froid `#111214`, accent doré `#d9a94e`, **pas d'indigo ni de bleu vif**. `PY`
- [~] **GEN-04** **Aucun emoji** dans l'interface : icônes uniquement (Lucide). `PY`
- [~] **GEN-05** Pied de page collé en bas de la fenêtre. `R1`
- [~] **GEN-06** Interface en français.
- [~] **GEN-07** Fluidité à grande échelle : bibliothèque de **100 000+ médias**, grille **sans lag jusqu'à 30 colonnes**. L'utilisateur a 100k+ fichiers réels (C: SSD, D: HDD) pour tester. `R2 R3 R4 D 11/10` — Phase 1 : mesuré sur 100 000 médias (CHANGELOG, D-014).
- [~] **GEN-08** Chaque zone de l'interface porte un **nom court et stable** (attribut `data-zone`, ex. `visionneuse.barre-tags`) pour que l'utilisateur puisse la désigner dans ses retours sans copier de classes HTML. Remplace la demande « nettoyer les noms des div ». `R1 R2 D 11/10`
- [~] **GEN-09** Marges et alignements cohérents au pixel près (pas de décalages de 1–2 px). `R1` — 13/10 : texte des pastilles de tags 1 px trop bas, corrigé (`T2`, capture « Screen 1 »).
- [~] **GEN-10** Les pop-ins de confirmation sont des fenêtres de l'application (style maison), jamais les boîtes natives du navigateur. `R1` — Phase 2 : pop-in « Créer un nouveau tag ».
- [~] **GEN-11** Icône de l'application = le logo MyBoard doré (barre des tâches, coin de la fenêtre, fichier .exe). `D 12/10`
- [~] **GEN-12** **Menus du clic droit** sur les différents éléments de l'application. Détails à donner par l'utilisateur après NAV-04. `D 13/10` — Précisé 15/10 : plan validé (base commune maintenant, puis menus des nouveaux éléments à chaque phase) ; détail dans la section **CTX** (menus du clic droit). En 3 lots (15/10) : 1) base commune (CTX-01 à CTX-03, CTX-18), 2) menus CTX-04 à CTX-12, 3) barre de titre CTX-13 et nouvelles fonctions. Lots 1, 2 et 3 livrés le 15/10.
- [~] **GEN-13** **Curseurs au survol** de certains éléments de l'application. Détails à donner par l'utilisateur après NAV-04. `D 13/10` — Précisé 15/10 (plan validé, code sur le feu vert de l'utilisateur) : règle commune pour que les nouveaux éléments aient le bon curseur. **Flèche** sur tout ce qui n'est pas cliquable : fonds, textes d'information (nom et poids du fichier, compteurs de l'en-tête, nombre de résultats, titres), zones vides, barres de défilement, barre de titre, fond de la visionneuse ; ces textes restent sélectionnables (GEN-17). **Main** sur tout ce qui est cliquable : boutons, vignettes, pastilles de tags et leur croix, lignes de tags (+, −, nom) et en-têtes de catégories, pagination, filtres, tri et ses choix, disposition, cases à cocher et leur texte, logo, menu burger, flèches de la barre de titre, boutons de la visionneuse (croix, flèches, plein écran, note, actions de la barre du bas, « Afficher plus », ouverture externe), liens des notes, commandes de la barre de lecture (lecture, volume, vitesse, boucle, progression, curseur de volume), choix des listes déroulantes, boutons des pop-ins ; **sauf** Réduire / Agrandir / Fermer de la barre de titre : flèche, comme Windows. **Barre « I »** dans les champs de saisie (recherche, saisie d'un tag, numéro de page, renommage) et sur la note (affichée ou en écriture). **Interdit** sur les éléments grisés (déjà le cas, « Imprimer » d'une vidéo compris), **mais pas** sur les flèches assombries de la barre de titre et de la pagination. **Main ouverte / fermée** sur un média zoomé, loupe de nouveau une fois dézoomé (fonctionnement actuel, confirmé le 15/10). **Loupe** sur une image qui peut grandir, petites images comprises (ZOOM-10). **Caché** : vidéo en plein écran, souris immobile 3 s. **Flèche + rond qui tourne** seulement pendant les petites attentes (« Ouvrir avec », « Explorer », « Copier » d'un gros fichier, page de la grille qui met plus de 0,3 s), jamais pendant un import. **Redimensionner** : bords de la fenêtre (Windows). Fichiers glissés depuis l'Explorateur : toute la fenêtre accepte le dépôt, pas de curseur « interdit ». — 16/10 : confirmé par l'utilisateur comme **base commune** (GEN-12), laissé ouvert : règle à suivre pour toute la suite de la production.
- [x] **GEN-14** Pastilles de tags : la **croix est à gauche du texte** (et non plus à droite, où sa place dépendait de la longueur du tag), dans la visionneuse et dans la barre latérale de la bibliothèque. `D 13/10`
- [~] **GEN-15** Pastilles de tags : le **texte remonte de 1 px** de plus, pour être centré sur la croix (lettres sans jambage, comme « a », « e », « o » : même écart en haut et en bas de la croix). `D 13/10`
- [>] **GEN-16** Nom du **son de l'application dans le mélangeur de volume** de Windows : « **MyBoard** » (et son icône) au lieu de « MSEDGEWEBVIEW2 ». Pas de réglage simple : le son est produit par les processus de WebView2 ; il faudrait passer par l'interface audio de Windows pour renommer leur session à chaque lecture (plusieurs étapes, résultat incertain). Reporté en phase 5 (finitions). `D 14/10`
- [~] **GEN-17** Les **textes d'information restent sélectionnables** à la souris pour être copiés : nom et poids du fichier, compteurs de l'en-tête, nombre de résultats, titres… (avec le curseur flèche, GEN-13). Clic droit sur une sélection : « Copier » (CTX-18). `D 15/10` — 16/10 : confirmé par l'utilisateur comme **base commune** (GEN-12), laissé ouvert : règle à suivre pour toute la suite de la production.
- [x] **GEN-18** **Raccourcis du navigateur** sans objet dans une application : désactivés : F5, Maj + F5, Ctrl + F5 (recharger), Ctrl + P (imprime la page entière), Ctrl + F, F3, Ctrl + G (recherche dans la page), Ctrl + S (enregistrer la page), F7 (navigation au clavier dans le texte) ; F12 et Ctrl + Maj + I ne marchent déjà plus dans la version finale. **Gardés** : Ctrl + R et Ctrl + Maj + R (recharger). **Alt + ← / Alt + →** : précédent / suivant de MyBoard (comme les boutons 4 / 5 de la souris et les flèches de la barre de titre), convention de l'Explorateur Windows. `D 15/10` (NAV-04)

## CTX — Menus du clic droit

Demandes de l'utilisateur du 15/10 (GEN-12). Ordre des entrées = ordre donné par l'utilisateur ;
« ‖ » = séparateur. Les entrées dont la fonction n'existe pas encore sont **affichées grisées et
inactives** (comme les boutons « bientôt » de la visionneuse) et s'activent avec leur phase.

- [~] **CTX-01** **Base commune.** Le menu du navigateur (vu le 14/10 : Retour, Actualiser, Enregistrer sous, Imprimer) est supprimé partout ; un clic droit là où MyBoard n'a pas de menu n'ouvre rien. **Apparence** : comme le menu de tri de la grille (fond sombre, coins arrondis, ombre), **sans icônes** ; le raccourci éventuel en gris à droite. **Séparateurs** comme ceux de Firefox (« Screen 10 », « Screen 11 ») : trait gris de 1 px qui ne touche pas les bords du menu (≈ 16 px de retrait de chaque côté chez Firefox), 3 px vides au-dessus et en dessous : ces 7 px ne réagissent pas (survol sans effet, un clic ne ferme pas le menu). Ouverture à l'endroit du clic, décalée pour rester dans la fenêtre ; fermeture : clic ailleurs (sans autre effet), Échap, bouton 4 de la souris, molette, changement de page, passage à une autre fenêtre ; un clic droit ailleurs ouvre le menu du nouvel endroit ; clavier : flèches, Entrée, Échap, touche Menu ou Maj + F10. Sous-menus « ▸ » au survol, à droite (à gauche s'il n'y a pas la place). Raccourci clavier affiché à droite **seulement là où il fonctionne**. Actions dangereuses en **rouge**, en dernier, avec confirmation dont le bouton « Oui » est rouge. Libellés qui s'inversent selon l'état (Lire / Pause, Couper / Rétablir le son, Déplier / Replier). `D 15/10` (GEN-12, GEN-10) — 16/10 : confirmé par l'utilisateur comme **base commune** (GEN-12), laissé ouvert : règle à suivre pour toute la suite de la production.
- [x] **CTX-02** **Confirmation ouverte depuis un menu** : Échap ou le bouton 4 de la souris ferment la pop-in et **laissent le menu ouvert** ; confirmer exécute l'action et ferme tout. `D 15/10` (GEN-10)
- [~] **CTX-03** **Champs de texte** (recherche, saisie d'un tag, numéro de page, note en écriture…) : menu d'édition classique : Annuler · Couper · Copier · Coller · Supprimer · Tout sélectionner (grisés quand ils sont sans objet). `D 15/10` — 16/10 : confirmé par l'utilisateur comme **base commune** (GEN-12), laissé ouvert : règle à suivre pour toute la suite de la production.
- [x] **CTX-04** **Tags** (pastilles de la visionneuse, lignes de tags de la barre latérale) : Copier le tag · Renommer… · Changer de catégorie ▸ (catégories avec leur couleur, l'actuelle cochée) · Retirer de cette image / cette vidéo / ce document / ce fichier audio (selon le type : un GIF est une image, un PDF ou un Word un document ; pastilles de la visionneuse) ‖ Masquer de la recherche / Ne plus masquer de la recherche ‖ Supprimer le tag… (rouge ; confirmation « Supprimer « x » ? Il sera retiré de N médias. », « Oui » rouge). Renommer : pop-in du style de « Créer un tag » ; si le nom existe déjà : pop-in « [tag Y] existe déjà et X médias y sont attachés, voulez-vous les fusionner ? » (« Oui » rouge). Masquer : le tag n'est plus proposé dans les recherches ni affiché dans la barre latérale, mais reste visible sur les médias : dans la visionneuse, en **gris clair et en dernier**, quelle que soit sa catégorie. « Retirer de… » est gardé même si la croix le fait déjà, pour qu'on ne le confonde pas avec « Supprimer le tag ». **Renommer, changer de catégorie, masquer et supprimer ne sont pas avancés** (choix du 15/10) : grisés jusqu'au gestionnaire de tags ; « Copier le tag » et « Retirer de… » marchent tout de suite (confirmé le 15/10). « Copier le tag » copie la forme enregistrée, avec « _ » (« long_hair ») : elle se colle telle quelle dans une recherche (choix du 15/10). `D 15/10` (TAGM-04, TAGM-05, VIEW-23, SRCH-10, SRCH-12)
- [x] **CTX-05** **Vignette de la grille** : Ouvrir · Copier le fichier ‖ Ajouter aux favoris · Ajouter à un dossier ▸ (dossiers créés + « Créer un dossier », grisé) · Sélectionner (coche la vignette et passe en mode sélection, comme le bouton « Sélectionner ») ‖ Ouvrir avec l'application par défaut · Afficher dans l'explorateur de fichiers · Copier le chemin du fichier ‖ Supprimer de la bibliothèque… (rouge ; confirmation, « Oui » rouge). Aucun raccourci affiché (ils ne marchent pas dans la grille). Grisés jusqu'à leur phase : favoris, dossiers, sélection, suppression. `D 15/10` (VIEW-35, FAV-01, FOLD-01, SEL-01, DEL-01, DEL-04)
- [x] **CTX-06** **Visionneuse, image** (clic droit sur l'image elle-même ; rien sur le fond autour, choix du 15/10) : Copier le fichier · Copier l'image (l'image elle-même, à coller dans Paint, une conversation…) ‖ Plein écran / Quitter le plein écran · Zoom ▸ (Défaut = ajusté, ou 100 % si l'image est plus petite que la zone · 100 % (grisé si le défaut est déjà 100 %) · 150 % · 200 % · 400 %) ‖ Copier le chemin du fichier · Ouvrir avec l'application par défaut · Afficher dans l'explorateur de fichiers · Imprimer · Utiliser comme fond d'écran du bureau… (si possible ; confirmation, ni l'entrée ni le « Oui » en rouge) ‖ Supprimer de la bibliothèque… (rouge ; confirmation, « Oui » rouge ; grisé jusqu'à la suppression). Lot 3 : Copier l'image, Zoom, fond d'écran ajoutés. `D 15/10` (VIEW-17, VIEW-18, VIEW-35, VIEW-36, ZOOM-09, ZOOM-10, DEL-01)
- [x] **CTX-07** **Visionneuse, vidéo** (clic droit sur la vidéo elle-même, comme CTX-06 ; toujours synchronisé avec la barre de lecture) : Lire / Pause · Couper le son / Rétablir le son · Lecture en boucle (case cochée) · Vitesse ▸ (×2 · ×1.5 · ×1.25 · ×1 · ×0.75 · ×0.5, comme la barre de lecture) · Plein écran / Quitter le plein écran · Zoom ▸ (comme les images) ‖ Copier le fichier · Enregistrer une capture d'écran… · Copier le chemin du fichier · Ouvrir avec l'application par défaut · Afficher dans l'explorateur de fichiers ‖ Supprimer de la bibliothèque… (rouge ; confirmation, « Oui » rouge ; grisé jusqu'à la suppression). **Capture** : l'image de la vidéo au moment du clic, dans sa résolution réelle, sans rien de l'interface (extraite par ffmpeg si c'est plus simple et plus léger), en .jpg, puis fenêtre « Enregistrer sous » de Windows ; nom « Screenshot_[nom du fichier sans extension]_[numéro de l'image]_JJ-MM-AA.jpg » (tirets dans la date : « / » est interdit dans un nom de fichier Windows ; validé le 15/10). Lot 3 : capture (numéro de l'image = temps × images par seconde de la vidéo) et Zoom ajoutés. `D 15/10` (VIEW-29, VIEW-18, VIEW-35, ZOOM-08, DEL-01)
- [x] **CTX-08** **Nom du fichier** (barre du bas de la visionneuse) : Copier le nom · Copier le chemin du fichier · Afficher dans l'explorateur de fichiers. `D 15/10`
- [x] **CTX-09** **Note** écrite : Modifier · Copier le texte ‖ Effacer la note… (rouge ; confirmation, « Oui » rouge). En cours d'écriture : menu d'édition (CTX-03). `D 15/10` (VIEW-19, VIEW-45)
- [x] **CTX-10** **Lien dans une note** : Ouvrir le lien · Copier le lien. `D 15/10` (VIEW-19)
- [x] **CTX-11** **En-tête d'une catégorie** (barre latérale) : Déplier / Replier (une seule entrée qui s'inverse) · Replier complètement (plus aucun tag de la catégorie affiché, même les 10 premiers ; un clic sur l'en-tête déplie alors tout, un nouveau clic revient aux 10 premiers). Lot 3 : « Replier complètement » ajouté (flèche de l'en-tête tournée vers la droite). `D 15/10` (SRCH-15)
- [x] **CTX-12** **Termes de la recherche** (pastilles sous le champ de recherche de la barre latérale) : Inclure dans la recherche / Exclure de la recherche (une entrée qui s'inverse selon l'état du terme) ‖ Copier le tag · Renommer… · Changer de catégorie ▸ ‖ Masquer de la recherche / Ne plus masquer de la recherche ‖ Tout effacer (vide la recherche). Renommer, changer de catégorie et masquer : grisés jusqu'au gestionnaire de tags, comme CTX-04. `D 15/10` (SRCH-12, CTX-04, TAGM-04, TAGM-05)
- [x] **CTX-13** **Barre de titre** : le menu de Windows (Restaurer, Déplacer, Taille, Réduire, Agrandir, Fermer Alt + F4) ne s'ouvre plus au clic droit depuis NAV-04, mais Alt + Espace l'ouvre toujours. Choix du 15/10 : **menu maison** (apparence CTX-01) avec les **mêmes actions** que celui de Windows, ouvert par le clic droit sur la barre de titre **et par Alt + Espace** (qui n'ouvre plus celui de Windows). Si c'est impossible ou que ça pose problème : rétablir le vrai menu de Windows au clic droit (option 2). Livré : option 1 (pas sur les boutons de la barre ; en plein écran, la barre de titre étant cachée, Alt + Espace n'ouvre rien). `D 15/10` (NAV-04)
- [>] **CTX-14** **Page Importer** : menus à définir quand la page d'import sera réellement développée. Idées du 14/10 : sur un fichier de la liste : Retirer de la liste · Afficher dans l'explorateur de fichiers ; sur une erreur : Copier le message · Afficher dans l'explorateur de fichiers. `D 15/10` (IMP-41, IMP-51)
- [>] **CTX-15** **Pastilles des tags par défaut** de la page Importer (tags pas encore posés sur des médias) : menu à décider avec la page d'import (même menu que les tags, ou seulement « Retirer »). `D 15/10` (IMP-30, CTX-04)
- [>] **CTX-16** **Sections pas encore faites** : chacune reçoit ses menus du clic droit au moment de sa création (rappel dans la liste de livraison de chaque phase) : Paramètres (SET), Favoris (FAV), Dossiers (FOLD, menu ⋮ de FOLD-02), Gestionnaire de tags (TAGM-04), Sélection multiple (SEL, menu ⋮ de SEL-03), Doublons (DUP)… `D 15/10`
- [-] **CTX-17** Fond de la grille et page vide : **pas de menu** (choix du 15/10). Pas de menu non plus sur les boutons simples : pagination, filtres, barres, barre de lecture, en-tête, pied de page, menu burger. `D 15/10`
- [~] **CTX-18** **Texte sélectionné** hors champ de saisie (nom du fichier, compteurs, titres… GEN-17) : clic droit **sur la sélection** → menu « Copier » (Ctrl+C) ; il passe avant le menu de l'élément (ex. nom du fichier, CTX-08). Ailleurs, rien ne change. `D 15/10` (CTX-01, GEN-17) — 16/10 : confirmé par l'utilisateur comme **base commune** (GEN-12), laissé ouvert : règle à suivre pour toute la suite de la production.
- [x] **CTX-19** **Échec d'une action lancée hors de la visionneuse** (menu d'une vignette : fichier introuvable, disque débranché…) : pop-in d'erreur maison, même contenu que le message de la visionneuse (VIEW-28 : action, code d'erreur Windows, message, explication), boutons « OK » et « Copier » (copie tout le contenu ; « Copié » s'affiche comme sur le bouton « Copier » de la visionneuse). `D 15/10` (CTX-05, VIEW-28, VIEW-35)

## LIB — Bibliothèque et stockage

- [~] **LIB-01** Par défaut, les médias sont **référencés sur place** : l'application indexe les fichiers là où ils sont, sans les copier. `D 11/10`
- [>] **LIB-02** Option dans les paramètres : **importer dans la bibliothèque gérée** (copie dans `originals/<2 hex>/<reste>.<ext>`, 256 sous-dossiers par hash). `D 11/10` `PY`
- [~] **LIB-03** Détection des doublons exacts par empreinte du contenu (hash) : un fichier déjà indexé n'est pas ré-ajouté, même renommé. `PY FC`
- [x] **LIB-04** Les tags sont liés au média (identifiant interne), jamais au nom de fichier. `PY`
- [?] **LIB-05** Comportement quand un fichier référencé est **déplacé, renommé ou supprimé hors de l'application** (signaler « fichier introuvable », retrouver automatiquement par hash lors d'un nouveau scan…). → Q-01
- [~] **LIB-06** **Petites miniatures** (~320 px, format WebP) générées **en arrière-plan après l'import**, stockées sur le SSD ; l'import n'attend pas leur génération, elles apparaissent au fur et à mesure. `D 11/10` (Q-02, D-011) — Phase 1 : rangées dans `thumbs.db` (D-014).
- [~] **LIB-07** Base de données et miniatures sur un disque rapide (SSD) même si les médias sont sur HDD. `D 11/10`
- [~] **LIB-08** Sauvegarde simple : copier le dossier de données de l'application suffit. `PY` — Phase 1 : copier `%LOCALAPPDATA%\MyBoard`, application fermée.
- [~] **LIB-09** **Grands aperçus** (~640 px) pour les densités 4–6 colonnes, **générés à la demande** : la petite miniature s'affiche immédiatement puis est remplacée par le grand aperçu ; un aperçu n'est demandé que si la vignette reste visible ~150 ms ; les demandes des vignettes sorties de l'écran sont annulées ; génération en arrière-plan sans jamais bloquer l'interface. `D 11/10` (D-011)
- [~] **LIB-10** Cache des grands aperçus **de taille limitée** : les moins récemment utilisés sont supprimés en premier. `D 11/10` — Phase 1 : limite 1 Go (D-015).
- [>] **LIB-11** Paramètres du cache : taille maximale, bouton « Vider le cache », emplacement. `D 11/10`
- [~] **LIB-12** **Miniatures 128 px** pour les grilles denses (à partir de 16 colonnes) : décodage plus rapide, sans perte visible. `D 12/10` (D-015)

## IMP — Import

### Sélection des fichiers
- [~] **IMP-01** Importer **un ou plusieurs fichiers** via la fenêtre de sélection Windows. `FC R2`
- [~] **IMP-02** Importer **un dossier** via la fenêtre de sélection Windows (bouton distinct « Importer un dossier » qui fonctionne réellement). `FC R2 R3 R4`
- [~] **IMP-03** Glisser-déposer de fichiers **et** de dossiers (récursif). `FC R1` (v8 ✓)
- [~] **IMP-04** Option « Importer le contenu des sous-dossiers ». `FC`
- [~] **IMP-05** Formats acceptés : images, vidéos, audio, + PDF, PowerPoint/Slides, Excel/Sheets. Les autres fichiers sont ignorés (avec compteur « X fichiers ignorés »). `R1`
- [ ] **IMP-06** Lecture adaptée au disque : en parallèle sur SSD, séquentielle sur HDD. `D 11/10`
- [~] **IMP-07** Documents Word acceptés en plus de IMP-05 : `.doc`, `.docx`, `.odt` (les `.txt` restent ignorés). `D 11/10`

### Aperçu avant import
- [ ] **IMP-10** Liste des fichiers sélectionnés **sous** la barre d'actions, avec miniature d'aperçu, nom, poids, format. `R1` (v8 ✓)
- [ ] **IMP-11** Liste plafonnée à 100 aperçus + texte « et X supplémentaires » + bouton « voir plus » (+100 par clic). `R2` (v8 ✓)
- [ ] **IMP-12** Rester fluide même avec 10 000 – 100 000 fichiers sélectionnés. `R1`
- [?] **IMP-13** Réutiliser les miniatures déjà calculées par l'explorateur Windows si c'est possible et plus rapide. `FC`

### Options
- [ ] **IMP-20** « Compresser les images » + curseur de qualité **20–95**. `R1` (v8 ✓)
- [ ] **IMP-21** « Convertir les images en : [menu] » — JPG (défaut), PNG, WebP, puis JFIF, AVIF, HEIF. Compression et conversion **cumulables** (la qualité s'applique au format cible). `R1` (v8 ✓)
- [ ] **IMP-22** « Convertir les vidéos en : [menu] » — MP4 standard (H.264, défaut), MP4 H.265, WebM, AV1. `R1` (v8 ✓)
- [ ] **IMP-23** Bulle ⓘ à côté du menu vidéo, textes exacts : MP4 standard « Conseillé - Compatibilité totale » · MP4 H.265 « Meilleure compression, nécessite une extension HEVC pour les lecteurs Windows » · WebM « Meilleure compression, compatible sur navigateur mais pas sur les lecteurs Windows » · AV1 « Compression maximale, lent à encoder, peu de compatibilité disponible ». `R3`
- [ ] **IMP-24** « Qualité vidéo » : **curseur à 5 crans** Minimale / Basse / Moyenne (défaut) / Haute / Maximale. `R2` (v8 ✓)
- [ ] **IMP-25** Compression vidéo : conserver la résolution et le nombre d'images par seconde ; images : conserver la résolution. Moteur : ffmpeg (voir IMP-48 / IMP-49). `FC R2`
- [~] **IMP-26** Pas d'option « Générer miniatures » (toujours actif). `R1`
- [?] **IMP-27** Avec le référencement sur place (LIB-01), où vont les fichiers **convertis / compressés** ? (remplacer l'original, créer un fichier à côté, ou réservé au mode bibliothèque gérée LIB-02). → Q-03
- [>] **IMP-28** Option « Supprimer les originaux » (n'a de sens qu'en mode bibliothèque gérée). `FC`
- [ ] **IMP-29** Les réglages par défaut des options viennent des Paramètres (SET-05). `FC`

### Tags par défaut
- [~] **IMP-30** Éditeur placé sous la grille des cartes d'options : [champ texte] → [menu catégorie à droite] → Entrée ou bouton « Ajouter » → **badge coloré** selon la catégorie, sous le champ. `R1` (v8 ✓) — Avancé en phase 2 (`D 12/10`) : placé sous l'encadré de dépôt tant que les cartes d'options n'existent pas (phase 4) ; les tags sont ajoutés à tous les fichiers de l'import, y compris ceux déjà présents dans la bibliothèque.
- [x] **IMP-31** Les espaces deviennent automatiquement des `_`. Autocomplétion avec les tags existants (même moteur que la barre latérale) ; choisir un tag existant ignore le menu catégorie (il a déjà la sienne). `R1` — Avancé en phase 2 (`D 12/10`).
- [ ] **IMP-52** **Liste des suggestions des tags par défaut** : elle s'ouvre sous le champ, placé bas dans la page, et dépasse du bas de la fenêtre (vu le 16/10, déjà le cas avant SRCH-25). L'ouvrir **vers le haut** quand la place manque en dessous. Noté le 16/10, à faire plus tard. `D 16/10` (IMP-31, SRCH-25)

### Déroulement
- [~] **IMP-40** La progression s'affiche **dans** la barre d'actions d'import (cachée au repos), au-dessus de la liste des fichiers. `R2` (v8 ✓)
- [~] **IMP-41** Progression : barre 0–100 % globale, fraction « X / Y », et pendant une compression : barre du fichier en cours + sa miniature + son nom. `FC` — Phase 1 : barre globale + « X / Y » + nom du fichier en cours ; barre et miniature du fichier en compression : phase 4.
- [>] **IMP-51** Bouton pour **vider les fichiers choisis** dans la zone d'import (repartir de zéro). `D 15/10` — Reporté en phase 4 (choix de l'utilisateur, 15/10).
- [~] **IMP-42** Boutons **Pause** et **Arrêter**. `IDEES` — Phase 1 : « Arrêter » fait (avancé à ta demande, `D 11/10`) ; « Pause » plus tard.
- [ ] **IMP-43** Annuler (avec confirmation) arrête proprement : supprime les fichiers résiduels, aucun processus ne reste en arrière-plan. `FC`
- [~] **IMP-44** Le bouton « Importer » est bloqué une fois l'import terminé (jusqu'à une nouvelle sélection). `IDEES`
- [ ] **IMP-45** Pop-in de fin : « X importés sur Y », nombre d'erreurs + noms des fichiers en erreur ; si compression : taux moyen %, place gagnée, poids avant/après, détail images/vidéos au survol. `FC`
- [~] **IMP-46** Les vidéos importées ont une miniature. `R2 R3 R4`
- [ ] **IMP-47** Un fichier converti s'affiche avec sa **vraie extension** (nom affiché mis à jour). `R4`
- [~] **IMP-48** Pendant le développement : utiliser le **ffmpeg installé sur le PC**, détecté de façon fiable sous Windows (PATH et emplacements connus), avec un message clair s'il est absent. `D 11/10` (D-012)
- [>] **IMP-49** Version finale : **ffmpeg fourni avec l'application** (téléchargement du binaire uniquement avec l'accord de l'utilisateur, au moment venu). `D 11/10` (D-007, D-012)
- [~] **IMP-50** Après un import, l'encadré de dépôt revient à son état de départ (plus de chemin affiché ni de résumé du choix précédent). `T1`

## GRID — Page d'accueil et grille

- [~] **GRID-01** Bibliothèque vide : message d'accueil spécifique (« Bienvenue… commencez par importer ») + bouton Importer fonctionnel. Recherche sans résultat : message distinct. `R1` (v8 ✓)
- [~] **GRID-02** Densité **4 à 30 colonnes, limites fixes** quelle que soit la résolution d'écran ; les vignettes s'adaptent en largeur. `R1` (v8 ✓)
- [~] **GRID-03** Bouton « Disposition » : préréglages + curseur ; aucun texte explicatif sous le curseur. `R1` (v8 ✓)
- [~] **GRID-04** Ctrl + molette change la densité (comme l'explorateur Windows). `FC`
- [~] **GRID-05** Nombre de médias par page **adapté à la densité** : 50 à 4 colonnes → 500 à 30 colonnes. `R1` (v8 ✓)
- [~] **GRID-06** **Aucun lag** en changeant de densité ni à 30 colonnes (voir GEN-07). `R2 R3 R4`
- [~] **GRID-07** Changer de filtre ou de tri ne réinitialise pas la densité / le nombre par page. `BUG`
- [~] **GRID-08** Vignette : pas de badge d'extension, pas d'icône plein écran, pas de mini-tags. Restent : badge durée vidéo, badge GIF, étoile favori, case de sélection, infos au survol (nom, poids, dimensions). `R1` (v8 ✓) — Phase 1 : badges durée et GIF, infos au survol ; étoile et case de sélection : phase 3.
- [~] **GRID-09** Au survol d'une vignette, le badge durée (vidéo) ou GIF remonte sur la ligne du nom de fichier : il ne cache plus les dimensions. `T1`
- [~] **GRID-10** Grilles denses (problème vu depuis la phase 1) : à partir de ≈ 15 colonnes, le texte et les badges des vignettes se gênent (nom coupé « .mp » au lieu de « .mp4 », badge vidéo remonté, poids sur 2 lignes, dimensions coupées — captures « Screen 4 » et « Screen 5 »). Badge vidéo / GIF, nom, poids, dimensions — et plus tard l'étoile favori et la case de sélection — sont **réduits progressivement jusqu'à 30 colonnes** pour que tout reste visible. Réduction **selon la largeur réelle de la vignette** (choix de l'utilisateur) : elle commence dès que la vignette devient trop étroite pour tout afficher (≈ 15 colonnes sur l'écran 1440p, ≈ 11 sur le 1080p), même disposition qu'en grand, juste plus petite. Remplace la réduction de 25 % de SEL-05. `D 13/10`
- [x] **GRID-11** Étape suivante de GRID-10, pour les vignettes encore plus petites (à partir de **18 colonnes sur l'écran 24" 1080p** et **22 colonnes sur l'écran 27" 1440p**, jusqu'à 30) : le badge vidéo / GIF, le poids et les dimensions sont **masqués** ; au survol, le **nom** prend toute la largeur de la vignette et s'agrandit au maximum, jusqu'en bas de l'ancienne ligne poids / dimensions — sur **une seule ligne**, aussi grand que possible pour tenir en entier ; un nom trop long garde la taille normale et finit par « … ». Seuil = **taille réelle de la vignette à l'écran** (≈ 2,2 cm de large, densité réelle de l'écran lue auprès de Windows) : mêmes 18 et 22 colonnes sur ces écrans, adaptation automatique aux autres (4K…). `D 13/10`

## PAGE — Pagination

- [~] **PAGE-01** Pagination en haut et en bas de la grille : numéros autour de la page courante, flèches précédent/suivant, champ « aller à la page », impossible d'aller à une page inexistante. `FC`
- [~] **PAGE-02** Ctrl + ← / → change de page. `FC` (v8 ✓)
- [~] **PAGE-04** La page active reste toujours au **centre exact de la fenêtre** (alignée avec le logo), dans les paginations du haut et du bas ; les pages précédentes à sa gauche, les suivantes à sa droite. `D 12/10`
- [-] **PAGE-03** ~~Menu 50/100/200/500/1000 par page~~ → remplacé par GRID-05. `R1`

## FILT — Filtres et tri

- [~] **FILT-01** Filtres par type (Images, Vidéos, Audio, Documents…) **à sélection multiple** (ex. Images + Vidéos). `R2`
- [~] **FILT-02** Filtres et tri sont **totalement indépendants du système de tags** : jamais de `type:` / `order:` en interne, jamais de pastille de tag pour eux. `R3 R4`
- [x] **FILT-03** Changer de filtre ne retire jamais les tags recherchés. `R3`
- [~] **FILT-04** Tris : récents / anciens, **poids** + / −, **taille (résolution)** + / −, nombre de tags + / −, aléatoire. Pas de « favoris » dans le menu de tri. `FC IDEES`
- [~] **FILT-05** Tri par **date de création** du fichier (en plus de la date d'import). `FC`
- [~] **FILT-06** Le tri et les filtres sont **mémorisés** (retour de la visionneuse, redémarrage). `R2`
- [~] **FILT-07** Corriger : le filtre revient parfois tout seul sur « Tout » ; médias non affichés tant qu'on ne change pas de filtre. `BUG`
- [~] **FILT-08** Ouvrir le menu de tri (ou tout menu déroulant) ne décale pas l'interface de quelques pixels. `T1`

## SRCH — Recherche et barre latérale des tags

- [x] **SRCH-01** Barre de recherche dans la barre latérale (plus de barre de recherche dans l'en-tête). Entrée ou bouton pour lancer. `FC R2`
- [x] **SRCH-02** Plusieurs tags = **ET** (tous présents). `FC`
- [x] **SRCH-03** Exclusion d'un tag avec `-tag`. `FC`
- [x] **SRCH-04** Joker `tag*` (commence par). `D` (bug GLM : plantait)
- [x] **SRCH-05** Tag avec espace : s'écrit avec `_` (`la_mer`). `FC`
- [x] **SRCH-06** Autocomplétion dès la première lettre (tags existants). `FC`
- [x] **SRCH-07** Termes actifs affichés en pastilles sous la barre de recherche (et uniquement là). `R2`
- [~] **SRCH-10** La barre latérale affiche **les tags présents sur les médias de la page affichée**, chacun avec le **nombre total de médias de la bibliothèque** qui le portent. Valable sur l'accueil, dans une recherche, dans les favoris et dans un dossier. `FC BUG R4 D 11/10`
- [x] **SRCH-11** Tags groupés par catégorie, chaque catégorie avec sa couleur, dans l'ordre défini (TAGM). `FC`
- [x] **SRCH-12** Clic sur un tag = lancer la recherche sur ce tag ; bouton « + » = l'ajouter à la recherche ; bouton « − » = l'exclure. `FC` (v8 ✓)
- [x] **SRCH-13** Compteurs **toujours exacts** (aucune dérive après imports / suppressions / ré-imports). `R3 R4`
- [x] **SRCH-14** Mise à jour **en temps réel** de la barre latérale quand on ajoute ou retire un tag (y compris depuis la visionneuse) : 52 → 51 au retrait, etc. `R2 R3 R4`
- [x] **SRCH-15** Barre latérale : **10 tags au plus par catégorie** ; le nom de la catégorie est un bouton qui déplie la liste complète vers le bas, un nouveau clic la replie sur les 10 premiers. `T2`
- [x] **SRCH-16** Tag **exclu** de la recherche (pastille rayée) : le trait de la rayure n'est pas centré sur le texte et la croix grise à sa gauche (1 ou 2 px trop haut). `D 15/10` — 15/10 : trait dessiné au centre de la croix ; d'abord sur la ligne de pixels sous le centre exact, jugé 1 px trop bas par l'utilisateur, puis sur la ligne au-dessus.
- [x] **SRCH-17** **Recherche à plusieurs tags rapide à grande échelle** (60 000 à 300 000 médias, tags présents sur 80 % des médias), en ajoutant des tags par +/− ou par le champ. Mesuré le 15/10 : bibliothèque de test (3 300 médias) : 6 à 14 ms dans la base, 125 à 160 ms jusqu'à l'affichage, sans allongement d'un tag à l'autre ; base synthétique de 300 000 médias : 0,25 à 1,1 s par recherche avec la méthode actuelle (refaite à chaque changement de page), qui augmente avec chaque tag très utilisé (de façon linéaire, pas exponentielle). Choix de l'utilisateur (15/10) : **index en mémoire** (pour chaque tag recherché, ensemble de ses médias gardé en mémoire et combiné en moins de 1 ms ; nombre de résultats et pages sans refaire la recherche ; mis à jour automatiquement par la base). Vu une fois par l'utilisateur, non reproduit après relance : recherche bloquée 3 à 5 s (pastille grise, curseur d'attente), toutes les réponses de MyBoard en attente ; pas reproduit en pleine charge ni pendant « Déplacer » / « Taille ». **Cause trouvée** : avec un filtre de type coché (Images…) et 2 tags ou plus, l'ancienne méthode prenait 2,8 à 5 s sur la bibliothèque de test (40 s à 100 000 médias) ; corrigé par l'index (6 à 8 ms). Livré le 15/10 (D-027). `D 15/10`
- [x] **SRCH-18** **Pastilles de la recherche qui débordent** (barre latérale) : avec plusieurs termes (+ / −), les pastilles passent sur 2, 3, 4… lignes et poussent la liste des tags vers le bas à chaque ligne. Il faut toujours voir les termes actifs sans que la liste bouge. Choix du 15/10 (après d'autres idées proposées : pastilles dans le champ, au-dessus de la grille, résumé + survol) : **1 ligne de pastilles + « +N »** dont le **survol** déplie les autres **par-dessus la liste** (même fonctionnement que la barre du bas de la visionneuse en plein écran : apparition à l'approche, disparition quand la souris s'éloigne). **Place réservée** : la ligne « Tout effacer » (SRCH-19) et la ligne de pastilles gardent leur place même sans recherche, la liste ne bouge jamais. `D 15/10` (SRCH-07) — Précisé 15/10 : le « +N » est **collé au bord droit** de la ligne de pastilles (les pastilles partent de la gauche), loin de « Tout effacer » centré ; dépliage quand la souris arrive à **16 px** du « +N », repli quand elle s'éloigne de plus de 16 px de la zone dépliée ; cette marge ne doit rendre inaccessible aucune autre action (catégories de tags…). — Testé par l'utilisateur (16/10) : l'aspect ne lui plaît pas vraiment (ligne vide sans recherche, 2 pastilles visibles le plus souvent, parfois 3), sans autre solution en vue. Demandé le 16/10 : le dépliage se déclenche à l'approche de **toute la ligne de pastilles**, pas seulement du « +N » (16 px à gauche, à droite et en dessous ; **pas au-dessus** : passer sur « Tout effacer » ne déplie rien) ; sans recherche, **texte gris discret** « Aucun tag dans la recherche » dans la ligne ; 1re pastille coupée par « … » : **bulle** de Windows avec le nom complet au survol (comme SRCH-22).
- [x] **SRCH-19** Bouton **« Tout effacer »** des termes de la recherche : sur **sa propre ligne, juste au-dessus des pastilles** (aujourd'hui : à la fin des pastilles) ; place réservée (SRCH-18). `D 15/10` (SRCH-07) — Précisé 15/10 : **centré** sur sa ligne ; sans recherche, visible mais **grisé**.
- [x] **SRCH-20** Champ de recherche de la barre latérale, **plusieurs tags tapés d'un coup** (« tag1 tag_2 tag3… » avant Entrée) : les suggestions ne s'affichent aujourd'hui que pour le 1er mot ; elles doivent **réapparaître après chaque espace** et porter sur le mot en cours. `D 15/10` (SRCH-06)
- [x] **SRCH-21** Suggestions du champ de recherche de la **barre latérale seulement** (pas l'ajout de tag de la visionneuse) : boutons **+ et −** à **gauche** de chaque suggestion (comme les lignes de tags). Choix du 15/10 (inverse du fonctionnement actuel) : **clic sur le nom** (ou Entrée sur la suggestion choisie au clavier) = **écrit le tag dans le champ**, à la place du mot en cours (la recherche part avec Entrée ou le bouton de recherche) ; **+ / −** = **ajoute tout de suite** le tag (inclus / exclu) **à la recherche en cours**, sans autre confirmation ; seul ce tag part : le mot en cours est effacé du champ, les autres mots tapés y restent (choix du 15/10). `D 15/10` (SRCH-06, SRCH-12, SRCH-20) — Précisé 15/10 : le tag écrit dans le champ est **suivi d'un espace** (la liste se ferme ; on tape le tag suivant ou Entrée).
- [x] **SRCH-22** **Noms longs dans les suggestions** (aujourd'hui coupés en « xxxx… », la liste étant trop étroite) : la liste s'élargit jusqu'au **double** de sa largeur d'origine ; si ça ne suffit pas, le nom passe sur **2 lignes** ; au-delà, coupé à 2 lignes par « … ». **Toutes les listes** (barre latérale, ajout de tag de la visionneuse, tags par défaut de l'import : un seul composant, choix du 15/10). `D 15/10` (SRCH-06) — Précisé 16/10 : un nom coupé par « … » montre au survol la **bulle de Windows** avec le nom complet (seulement s'il est coupé).
- [x] **SRCH-23** **Effet visuel au survol** des suggestions (barre latérale **et** ajout de tag de la visionneuse) : aujourd'hui invisible (même gris que le fond de la liste). Choix du 15/10 : **fond gris plus clair** (comme le survol des lignes de tags de la barre latérale), le nom garde la couleur de sa catégorie. `D 15/10` (SRCH-06, VIEW-21)
- [x] **SRCH-24** **Entrée ou le bouton de recherche lancent une nouvelle recherche** avec les tags tapés dans le champ, et eux seuls. Bug vu par l'utilisateur (16/10) : ils s'ajoutaient à la recherche en cours, comme le bouton « + ». Les boutons + / − (lignes de tags, suggestions) ajoutent toujours à la recherche en cours. `D 16/10` (SRCH-01, SRCH-12, SRCH-21)
- [x] **SRCH-25** **Liste des suggestions sans barre de défilement** (barre latérale, visionneuse ; même composant pour l'import) : la barre de défilement ne servait pratiquement à rien. La hauteur de la liste suit ses suggestions (10 au plus, de 10 noms d'une ligne à 10 noms de 2 lignes) : toutes sont toujours affichées, sans barre de défilement. `D 16/10` (SRCH-06, SRCH-22, VIEW-21)

## VIEW — Visionneuse

### Ouverture, fermeture, navigation
- [x] **VIEW-01** Clic sur une vignette = visionneuse plein écran (image au niveau de zoom « ajusté »). `FC`
- [x] **VIEW-02** Fermer : Échap, bouton croix, clic sur le fond (hors image, non zoomé — voir ZOOM-05). `R1 R2`
- [~] **VIEW-03** **Bouton 4 de la souris** (retour) = même action qu'Échap tant qu'Échap a une action (visionneuse, dialogue, mode sélection) ; sinon retour arrière normal. `R1 R2 R3 R4`
- [x] **VIEW-04** Précédent / suivant (flèches écran et clavier) **sans couture entre les pages**. `R1` (v8 ✓)
- [x] **VIEW-05** En fermant, la grille affiche **la page du média regardé** (dès le 1er média d'une nouvelle page, sans décalage). `R1 R2`
- [x] **VIEW-06** Le défilement de la page derrière est bloqué pendant la visionneuse. `R1` (v8 ✓)
- [x] **VIEW-07** Aucun blocage de l'interface par une fenêtre de dialogue invisible (bug critique v5). `R2`

### Barre d'informations (bas)
- [x] **VIEW-10** Nom du fichier, date de création, poids, dimensions, durée (vidéo). `FC`
- [~] **VIEW-11** Bouton « Ajouter aux favoris » (étoile, dorée si favori). `R1` (v8 ✓) — Phase 2 : bouton visible mais grisé « bientôt » (`D 12/10`) ; actif en phase 3.
- [x] **VIEW-12** Pas de bouton « Télécharger ». `R1`
- [x] **VIEW-13** Bouton « Ouvrir dans l'explorateur » (sélectionne le fichier). `FC R1`
- [~] **VIEW-14** Bouton « Supprimer » (rouge) avec pop-in de confirmation maison. `FC R1` (v8 ✓) — Phase 2 : bouton visible mais grisé « bientôt » (`D 12/10`) ; actif en phase 3 (après Q-04).
- [~] **VIEW-15** Bouton « Ajouter à un dossier ». `IDEES` — Phase 2 : bouton visible mais grisé « bientôt » (`D 12/10`) ; actif en phase 3.
- [-] **VIEW-16** ~~Ouvrir dans l'app Photos de Windows~~ → doublon / contradiction avec VIEW-24. `FC PY`
- [~] **VIEW-17** Imprimer (grisé pour une vidéo). `FC PY` — Avancé en phase 2 (`D 13/10`) : imprime **le média lui-même**, jamais la page de l'application. — 13/10 : le panneau « Imprimer » de WebView2 passe légèrement sous la barre de titre de la fenêtre (placement décidé par WebView2, pas par MyBoard) ; gardé à la demande de l'utilisateur plutôt que la fenêtre d'impression classique de Windows.
- [x] **VIEW-18** Plein écran total (masque bordures et barre des tâches, barres réapparaissant au survol). `FC` — Avancé en phase 2 (`D 13/10`) : la barre du bas réapparaît au survol et disparaît quand la souris en sort ; en plein écran, la croix en haut à droite, Échap et le bouton 4 de la souris **quittent le plein écran** (ils retrouvent leur rôle normal ensuite). — Précisé 13/10 : la barre du bas apparaît un peu **avant** que la souris l'atteigne et disparaît un peu après qu'elle en soit sortie (zone tampon) ; le bouton plein écran quitte le haut à droite : **vidéos** = tout à droite de la barre de lecture (à droite de la boucle), **images** = au même endroit, en bas à droite de la scène au-dessus de la barre du bas ; en plein écran il prend une icône aux flèches inversées (vers l'intérieur) et sert à en sortir ; la **touche F** ouvre et ferme le plein écran (images et vidéos) ; en plein écran, la **croix** quitte le plein écran **et** la visionneuse (Échap et le bouton 4 quittent seulement le plein écran). — Précisé 13/10 (suite) : pour les images, en plein écran, le bouton reste le **bouton rond** habituel (flèches inversées), au même endroit — jamais de bande de barre de lecture. — Précisé 13/10 (suite 2) : le bouton rond des images porte un **contour doré tant que le plein écran est actif**, et seulement à ce moment-là ; il ne descend pas en plein écran (même règle que VIEW-32).
- [x] **VIEW-19** Zone « Notes » (texte libre par média). `FC` — Avancé en phase 2 (`D 13/10`) : bouton discret (icône de note autocollante) en haut à gauche de la visionneuse, sous le badge du zoom ; il ouvre une petite zone de texte ; les liens collés sont cliquables ; enregistrement automatique ; Échap ferme la note (puis, de nouveau, la visionneuse). — Précisé 13/10 : un clic en dehors de la note la ferme (comme Échap) ; Entrée termine l'écriture et affiche la note « écrite » (Maj + Entrée = retour à la ligne) ; bouton rond du même style que la croix en haut à droite (accents et point dorés gardés), aligné avec elle en haut à gauche ; le badge du zoom passe juste en dessous.
- [x] **VIEW-35** Bouton « **Copier** » dans la barre du bas, à gauche de « Ajouter aux favoris » : copie **le fichier lui-même**, comme Ctrl + C sur un fichier sélectionné dans l'Explorateur Windows (on le colle ensuite dans un dossier, une conversation…). Confirmation brève (« Copié », ~1,5 s), aussi après le raccourci ; échec = message d'erreur VIEW-28. `D 13/10`
- [x] **VIEW-36** **Raccourcis clavier** des boutons de la barre du bas : Copier `Ctrl+C` · Ajouter aux favoris `L` · Ajouter à un dossier `D` · Explorer `E` · Ouvrir avec `O` · Imprimer `I` · Supprimer `Suppr`. Le plein écran reste sur `F` (VIEW-18), d'où `L` pour les favoris (« like », comme l'app Photos de Windows). Raccourci affiché dans la bulle d'aide de chaque bouton ; personnalisables plus tard (SET-10). Favoris, Dossier, Supprimer : actifs avec leurs boutons (phase 3). `D 13/10` — Modifié 16/10 (choix de l'utilisateur) : **Ajouter aux favoris passe de `L` à `S`** (« Star » : l'icône du bouton est une étoile, convention de Gmail) ; `L` devient la boucle des vidéos (« Loop », VIEW-47), en vue de la traduction anglaise (FUT-08).

### Tags dans la visionneuse
- [x] **VIEW-20** Champ d'ajout de tag placé **le plus à gauche possible**, juste à droite des infos du fichier. `R2 R3 R4`
- [x] **VIEW-21** Le menu d'autocomplétion s'ouvre **au-dessus** du champ. `R1` (v8 ✓) — Précisé 13/10 (`T2`) : dans la visionneuse, ordre inversé, le tag le plus utilisé **en bas** (près du champ) ; la barre latérale garde son ordre.
- [x] **VIEW-22** Tag inexistant : proposer de le créer en choisissant sa catégorie. `R1` (v8 ✓)
- [x] **VIEW-23** Tags du média en pastilles colorées, retirables ; clic sur une pastille = recherche de ce tag. `R1` (v8 ✓)
- [x] **VIEW-46** **Pop-in « Créer un nouveau tag »** (VIEW-22) avec un nom long : aujourd'hui le nom dépasse de la pop-in sur la droite. Le nom passe à la ligne dans la largeur de la pop-in (**pas d'élargissement**), **2 lignes au plus**, puis « … » ; coupé, il montre au survol la bulle de Windows avec le nom complet (comme SRCH-22). La pop-in grandit **vers le haut** (pas moitié en haut, moitié en bas) : les boutons restent à leur place habituelle. `D 16/10` (VIEW-22, SRCH-22)
- [~] **VIEW-47** **Raccourcis du lecteur vidéo** (oubli de VIEW-29) : `M` couper / rétablir le son ; `<` ralentir et `>` accélérer d'un palier (0,5× · 0,75× · 1× · 1,25× · 1,5× · 2×, convention de YouTube ; sur AZERTY, une seule touche à gauche du W, Maj pour `>`) ; `L` activer / désactiver la boucle (« Loop »). À chaque appui, **badge bref** (même style que le badge du zoom) : « Son coupé » / « Son rétabli », « 1,25× », « Boucle activée » / « Boucle désactivée » ; il s'affiche même quand les commandes sont cachées (souris immobile, plein écran). Raccourcis affichés dans le **menu du clic droit** de la vidéo (comme « Espace », « F ») et dans les bulles d'aide de la barre de lecture. `D 16/10` (VIEW-29, VIEW-36, CTX-07, ZOOM-09) — Demandé le 16/10 après test : les badges de **vitesse** (seulement eux) restent affichés **2 s** ; le libellé de vitesse de la barre de lecture garde **toujours la largeur des vitesses à 3 chiffres** (0,75× et 1,25×), pour que le volume et la barre de progression ne bougent plus d'une vitesse à l'autre.
- [~] **VIEW-48** **Commandes gardées à l'écran sous la souris** (vidéo en plein écran, VIEW-33) : tant que la souris est sur la barre de lecture, dans le menu des vitesses, sur un bouton (notes, flèche gauche / droite, croix) ou sur la barre du bas (et ses listes ouvertes vers le haut), les commandes ne disparaissent pas après 3 s ; le fonctionnement normal reprend dès que la souris sort de ces éléments. `D 16/10` (VIEW-33, VIEW-18, VIEW-29, VIEW-39)

### Ouverture externe et lecture des vidéos
- [x] **VIEW-24** Bouton « Ouvrir avec l'application par défaut » (comme un double-clic dans l'Explorateur Windows) : vidéo illisible dans MyBoard, documents Word / Excel / PowerPoint, ou simplement voir le fichier dans son logiciel habituel. `D 12/10` — Fonctionne pour les images ; à tester / développer pour les autres types de fichiers (`D 13/10`).
- [>] **VIEW-25** Vidéo que WebView2 ne sait pas lire (HEVC sans l'extension Microsoft, AVI Xvid / DivX, WMV, MPEG-2, ProRes, son PCM ou AC-3…) : **conversion à la volée en H.264** par ffmpeg pendant la lecture, l'original n'est jamais modifié. Phase 4 (mêmes briques que IMP-22 / IMP-25). En attendant : message clair + bouton VIEW-24. `D 12/10`
- [x] **VIEW-26** Lecteur vidéo comme la v8 : lecture automatique, en boucle, avec le son ; un bouton du lecteur permet de **désactiver la boucle**. `D 12/10`
- [~] **VIEW-27** Bouton 4 de la souris après la fermeture de la visionneuse : il la **rouvre sur la dernière image vue** si rien d'autre n'a été fait depuis (pas de changement de page, de recherche, de filtre, ni d'autre média ouvert). Séquence : Import → Bibliothèque → image X → bouton 4 = ferme → bouton 4 = rouvre X → bouton 4 = ferme → bouton 4 = page d'Import (pas de va-et-vient sans fin). `T2`
- [~] **VIEW-28** Si « Ouvrir dans l'explorateur » ou « Ouvrir avec l'application par défaut » échoue : message d'erreur avec le **code d'erreur Windows** et une explication en clair. `D 13/10`
- [x] **VIEW-29** **Lecteur vidéo personnalisé** aux couleurs de MyBoard (à la place des commandes de WebView2) : lecture / pause (clic sur la vidéo et touche Espace), barre de progression cliquable avec le temps au survol, temps écoulé / durée, volume + muet (volume retenu d'une vidéo à l'autre ; curseur de volume **continu**, sans crans — précisé 13/10), boucle (VIEW-26), vitesse 0,5× à 2×, **image par image** vidéo en pause (touche `,` `?` = reculer, touche `;` `.` = avancer). `T2 D 13/10`
- [x] **VIEW-30** **Bouton 5 de la souris** (avance) : exact inverse du bouton 4 (VIEW-03, VIEW-27). Il refait dans l'autre sens tout le chemin du bouton 4 — ex. … b4 ferme → b4 rouvre X → b4 ferme → b4 Import, puis b5 = Bibliothèque → b5 = rouvre X → b5 = ferme → b5 = rouvre X → b5 = plus rien ; un b5 juste après un b4 annule ce b4. Tout s'efface si on fait autre chose (page, recherche, filtre, autre média ouvert). `D 13/10`
- [x] **VIEW-31** Curseur : la loupe (image) ou la main (vidéo zoomée) **seulement au-dessus du média** ; sur le fond en damier (dont le clic ferme la visionneuse), flèche normale. `D 13/10`
- [x] **VIEW-32** Barre de lecture vidéo **flottante** : détachée de la barre du bas, posée par-dessus la vidéo, centrée, moins large (≈ 45 % de la largeur), bords arrondis, près du bas de la scène ; **même hauteur à l'écran en plein écran ou non** (juste au-dessus de l'endroit où apparaît la barre du bas, qui ne la recouvre jamais) ; le bouton plein écran des images suit la même règle. `D 13/10` (croquis « Screen 3 ») — Précisé 13/10 (suite) : « même hauteur » = même endroit **sur l'écran** ; en plein écran, la barre des tâches de Windows disparaît et la barre ne doit pas descendre d'autant.
- [x] **VIEW-33** Vidéo en plein écran : après **3 s sans mouvement de la souris** (même en pause), le curseur, la barre de lecture, les flèches, la croix et le bouton des notes se cachent ; ils réapparaissent dès que la souris bouge. `D 13/10` — Corrigé 13/10 : le badge du zoom (pourcentage) restait affiché ; il se cache maintenant avec le reste.
- [x] **VIEW-37** Vidéo en plein écran : quand la souris **sort de l'écran** (passe sur un second écran), le masquage de VIEW-33 se fait **tout de suite**, sans attendre les 3 s ; tout réapparaît normalement dès que la souris revient et bouge. La barre du bas (VIEW-18) se cache aussi, la souris l'ayant quittée. `D 13/10`
- [x] **VIEW-38** Visionneuse hors plein écran : les **flèches précédent / suivant sont ancrées** à la place qu'elles ont quand le média n'a aucun tag (barre du bas d'une seule ligne de tags) ; elles ne montent ni ne descendent plus selon l'épaisseur de la barre du bas, et ne tremblent plus en passant d'un média à l'autre. `D 13/10`
- [x] **VIEW-39** Barre du bas de la visionneuse : **3 lignes de tags au plus** ; s'il y en a davantage, un bouton « **Afficher plus** » (même flèche en V que les catégories de la barre latérale) au centre d'une 4ᵉ ligne. Il déplie la barre **vers le haut, par-dessus le média** (le média ne rapetisse pas), jusqu'à la **moitié de la hauteur** de la visionneuse au plus, avec une barre de défilement si les tags ne tiennent pas ; le bouton reste en bas au centre et devient « **Réduire** » (flèche inversée). Si le menu déplié atteint les flèches, le bouton plein écran ou la barre de lecture, ils **glissent avec lui** puis reviennent à leur place à la fermeture. Avec 2 ou 3 lignes de tags, la barre pousse le média comme aujourd'hui (choix de l'utilisateur). `D 13/10` — Précisé 13/10 : quand la barre dépliée ferait monter le **bouton plein écran** (images) jusqu'à la **flèche droite** (écart minimal), il ne passe plus derrière elle : il se range **à côté de la flèche**, à sa hauteur, et la suit si elle monte (croquis « Screen 6 » : à gauche de la flèche, la flèche touchant le bord droit). — Précisé 14/10 : à gauche, confirmé par l'utilisateur ; rangé, le bouton rond doit avoir **le même écart en haut et en bas** par rapport à la flèche (mesuré par l'utilisateur : 3 px en haut, 4 px en bas).
- [x] **VIEW-40** Barre du bas de la visionneuse : en passant (flèches) à un média dont les tags ne sont pas encore chargés, la barre ne **rétrécit plus le temps du chargement** pour regrandir ensuite (74 px mesurés par l'utilisateur sur son écran : le média sautait deux fois). Elle a tout de suite sa bonne hauteur ; les seuls changements restants sont ceux voulus (VIEW-39 : 1 à 3 lignes de tags). `D 14/10`
- [x] **VIEW-41** Ouverture de la visionneuse : le **fond noir, la barre du bas et les boutons sont là dès la première image** (la galerie ne se voit plus derrière pendant l'ouverture, ni par transparence ni en bordure) ; **seul le média** garde son apparition en fondu avec un léger zoom. `D 14/10`
- [x] **VIEW-42** **Barre de lecture des vidéos et bouton rond plein écran des images ancrés** à la place qu'ils ont quand la barre du bas repliée est la plus épaisse (3 lignes de tags + « Afficher plus »), en fenêtre comme en plein écran : ils ne montent ni ne descendent plus d'un média à l'autre selon le nombre de lignes de tags. Ils glissent toujours avec la barre dépliée (VIEW-39). `D 14/10` — Testé par l'utilisateur (14/10) : en faisant défiler très vite les médias (flèche droite maintenue, vidéo « Screen Record 1 »), la barre de lecture et le bouton plein écran **vibrent** (ils descendent et remontent légèrement) avant de se caler. Corrigé : la hauteur de la barre du bas arrivait une image en retard (écart de 20 à 48 px pendant 1 à 2 images, mesuré) ; et un média sans tag décalait l'ancrage de 6 px.
- [x] **VIEW-44** **Fond de la visionneuse** : noir, ou au moins gris très sombre, au lieu du damier (le damier devient un choix des préférences, SET-11). Teinte : l'utilisateur essaiera noir pur et gris très sombre au moment de la modification. Bug lié, vu par l'utilisateur sans pouvoir le reproduire : sur les vidéos en plein écran, le fond devient **parfois noir** au lieu du damier — à examiner après GEN-12 et GEN-13. Livré le 15/10 : fond uni ; deux versions à comparer dans `Backups/v24` (« Noir » #000000, « Gris-tres-sombre » #0d0e12, la teinte la plus foncée du damier) ; choix de l'utilisateur (15/10) : **gris très sombre** (#0d0e12). Bug du fond noir : non reproduit ; à surveiller avec le gris. `D 15/10`
- [x] **VIEW-45** **Bouton « Effacer la note »** : icône de poubelle **rouge** (la même que le bouton « Supprimer » de la barre du bas), dans le coin **haut droit** de la zone de note (capture « Screen 13 ») ; même confirmation que « Effacer la note » (CTX-09, « Oui » rouge). Grisé quand la note est vide. `D 15/10` (VIEW-19, CTX-09)
- [x] **VIEW-43** Plein écran avec la **barre du bas dépliée** (images et vidéos) : elle se cache quand la souris s'éloigne, comme repliée. Avant : après un clic sur « Afficher plus » (bouton qui gardait le focus, d'où le cadre doré après F), elle restait affichée jusqu'au clic suivant, empêchait parfois le masquage après 3 s, et le bouton plein écran / la barre de lecture passaient derrière elle. Elle apparaît par la même zone en bas de l'écran ; affichée, elle reste tant que la souris est dessus ou à moins de 60 px de son bord haut ; cachée, elle reste dépliée ; les commandes flottantes glissent avec elle. Seule la saisie d'un tag la garde affichée. `D 14/10`
- [x] **VIEW-34** Passage en plein écran et retour **sans saccade** : aujourd'hui la barre de lecture et les boutons sautent vers le haut (ou le bas) pendant 1 à 5 images avant d'arriver à leur place, très visible en appuyant plusieurs fois sur F. `D 13/10` — Mesuré le 13/10 (écran filmé à 60 i/s) : en entrant, +31 px pendant 2 images puis +23 px pendant 3 images ; en sortant, +8 px pendant 1 image puis −23 px pendant 2 images. Cause : Windows retire / remet sa barre de titre, le haut de la fenêtre se déplace, et WebView2 met 3 à 5 images à redessiner la page (Windows montre l'ancienne image décalée en attendant). **Reporté à NAV-04** (choix de l'utilisateur, 13/10) plutôt qu'un masquage des boutons pendant la bascule. — Livré avec NAV-04 (13/10) : sans barre de titre Windows, le haut de la fenêtre ne bouge plus ; filmé sur 6 passages : barre de lecture immobile sur 5, une seule image décalée de 8 px sur le dernier. — Testé par l'utilisateur (13/10) : l'interface ne saute plus, mais environ 1 fois sur 10 le **média lui-même tremble** pendant l'entrée ou la sortie du plein écran (très visible en appuyant plusieurs fois sur F). — 14/10 : l'essai du 13/10 (zéro tremblement mais une ligne de 2 px sur le bord de l'écran voisin) n'est pas validé ; pistes demandées : A (fenêtre agrandie sans débordement de 8 px) puis B (sans l'ombre de Tauri), puis un mélange. B est impossible (Tauri n'ajoute aucune ombre en plein écran : la ligne est la bordure de Windows). **4 versions à comparer** dans `Backups/v16` (code + programme, mesures dans « new V2/Explications plein écran/Comparatif v16.txt ») : Piste_A_R-Ldepop+A (tremble), Essai_8-L+A (ligne), Piste_A-SansL_SansA (ni ligne ni tremblement, mais sans les animations de Windows), Mix_test (ni ligne ni tremblement avec l'écran voisin à droite, animations gardées ; ligne si l'écran voisin est à gauche). — Choix du 14/10 : **Mix_test** (les animations de Windows ne peuvent pas être recréées) ; la bande de 8 px vue environ 1 fois sur 20 à la sortie est supprimée (style « barre de titre » remis après la bascule). Reste, rarement, une ligne de 1 px pendant une image à l'entrée ; avec l'écran voisin à gauche ou au-dessus, la ligne de 2 px reste pendant le plein écran.

## ZOOM — Zoom de la visionneuse (façon wikifeet) — (v8 ✓ sauf mention)

- [x] **ZOOM-01** Niveau minimal « ajusté » : `min(largeur écran / largeur image, hauteur écran / hauteur image)`, plafonné à 1 (une petite image reste en taille réelle).
- [x] **ZOOM-02** Zoom maximal **×4**. `R3`
- [x] **ZOOM-03** Molette : zoom **continu** (`échelle + delta/600`), ancré sous le curseur, lissé image par image.
- [x] **ZOOM-04** Tant qu'un axe de l'image tient dans l'écran, l'image reste centrée sur cet axe ; dès qu'il dépasse, le zoom suit le curseur sur cet axe ; on ne peut jamais sortir de l'image. Au dézoom, chaque axe se recentre dès qu'il rentre dans l'écran. `R2 5.5`
- [x] **ZOOM-05** Clic sur l'image (sans glisser, seuil 3 px) : ajusté → taille réelle **centrée sur le point cliqué** ; zoomé → retour à « ajusté » centré. Clic sur le fond gris : si zoomé → dézoom ; si non zoomé → fermer. (Un double clic sur le fond = dézoom puis fermeture.) `R2 5.3 5.4`
- [x] **ZOOM-06** Glisser pour se déplacer, uniquement si zoomé.
- [~] **ZOOM-07** Animation 200 ms uniquement pour le clic (pas pour molette / glisser) ; badge « 1.50× » affiché quand zoomé. — Texte du badge : voir ZOOM-09.
- [x] **ZOOM-08** Même zoom sur les vidéos (lecteur vidéo personnalisé). `R2 5.7` — Avancé en phase 2 (`D 13/10`, VIEW-29) : molette, glisser et ×4 comme les images ; **clic sur la vidéo = lecture / pause** ; Échap revient à la taille d'origine, puis un nouvel Échap ou un clic hors de la vidéo ferme la visionneuse.
- [~] **ZOOM-09** Le badge du zoom affiche le **pourcentage de la taille réelle** de l'image (13 %… 100 % = taille réelle… 400 %), au lieu de l'échelle « 0.30× ». `T2 D 13/10`
- [x] **ZOOM-10** **Petites images** (affichées à 100 % parce qu'elles sont plus petites que la zone) : un clic les zoome à **200 %**, un nouveau clic les ramène à 100 % (aujourd'hui, le clic ne fait rien) ; la loupe reste affichée sur elles (GEN-13). `D 15/10`

## SEL — Sélection multiple et actions groupées

- [ ] **SEL-01** Bouton « Sélection multiple » ; **Échap** quitte le mode (comme « Terminer »). `R1 R2` (v8 ✓)
- [ ] **SEL-02** Menu **⋮** juste à droite de « Tout sélectionner », dans le même bloc ; pas de texte d'aide en bas. `R2` (v8 ✓)
- [ ] **SEL-03** Menu ⋮ : Supprimer (confirmation avec le nombre) · Ajouter aux favoris · Ajouter au dossier ▸ (liste + « Créer un dossier ») · **Ajouter des tags à la sélection** · **Sélectionner tous les résultats** (toutes les pages de la vue courante : accueil, recherche, favoris ou dossier). `R1 IDEES`
- [ ] **SEL-04** La sélection est conservée en changeant de page ; « Tout » sur la page Y **ajoute** à la sélection existante. `R1` (v8 ✓)
- [ ] **SEL-05** Case de sélection 24×24 alignée avec l'étoile favori (coin opposé) ; ~~les deux réduites de 25 % à partir de 20 colonnes~~ → réduites progressivement avec la vignette (GRID-10, décidé le 13/10). `R2` (v8 ✓)
- [ ] **SEL-06** **Sélection par cliquer-glisser** (rectangle, comme l'explorateur Windows). `R2`
- [ ] **SEL-07** Barre d'actions du bas pour ajouter / retirer des tags à la sélection. `R1` (v8 ✓)

## DEL — Suppression

- [ ] **DEL-01** Les médias **disparaissent de l'écran à l'instant du clic** sur « Supprimer ». `R2 R3 R4`
- [ ] **DEL-02** Suppression réelle en arrière-plan, rapide, faible usage processeur (300 médias : quasi instantané). `R2`
- [ ] **DEL-03** La suppression **reprend au redémarrage** si l'application est fermée en cours (aucun média « bloqué » masqué mais non supprimé). `R2`
- [?] **DEL-04** Avec le référencement sur place (LIB-01) : « Supprimer » retire-t-il seulement le média de la bibliothèque, ou supprime-t-il aussi le fichier du disque (corbeille Windows ?) ? La case « Conserver les fichiers sur le disque » (centrée verticalement) doit être redéfinie en conséquence. `R2 R3` → Q-04

## FAV — Favoris

- [ ] **FAV-01** Favoris = **système dédié** (comme un dossier), pas un tag ; une seule source de vérité. `R2 R3 R4`
- [ ] **FAV-02** Vue « Favoris » = interface normale filtrée sur les favoris, toutes les fonctions disponibles. `FC`
- [ ] **FAV-03** L'étoile se met à jour **partout en temps réel** (vignette ↔ visionneuse). `R1 R2 R3 R4`

## FOLD — Dossiers (anciennement « groupes »)

- [ ] **FOLD-01** Dossiers manuels, indépendants des tags ; nommés « Dossiers » dans l'interface. `R1 R2` (v8 ✓)
- [ ] **FOLD-02** Dans le menu burger, menu ⋮ par dossier : Renommer · Masquer · Supprimer (confirmation). Survol lisible (même effet que « Supprimer »). `R2 R3`
- [ ] **FOLD-03** Retirer un ou plusieurs médias d'un dossier. `IDEES`
- [ ] **FOLD-04** Page d'un dossier avec la barre latérale des tags (SRCH-10) et la recherche à l'intérieur du dossier. `R2` (v8 ✓)
- [>] **FOLD-05** Gestionnaire de dossiers (réafficher les dossiers masqués, etc.). `R2`

## TAGM — Tags, catégories et gestionnaire de tags

- [~] **TAGM-01** Catégories = **données** (table en base, avec nom, couleur, ordre), pas figées dans le code. `D 11/10` — Phase 1 : table en base ; phase 2 : nom, couleur et ordre lus en base par l'interface.
- [~] **TAGM-02** Catégories initiales : Safebooru (général, artiste, personnage, copyright, méta) **et** flowchart (personnes, date, lieu). `D 11/10` `FC` — Phase 1 : 8 catégories créées en base (ordre et couleurs : TAGM-03).
- [x] **TAGM-03** Ordre d'affichage et couleurs des catégories. Ordre « personnelles en premier » : Personnes, Lieu, Date, Copyright, Personnage, Artiste, Général, Méta. Couleurs « convention booru » (palette B) : Personnes `#f9a8d4`, Lieu `#5eead4`, Date `#e7d7b0`, Copyright `#d48cf5`, Personnage `#4ade80`, Artiste `#f87171`, Général `#7dd3fc`, Méta `#fb923c`. `D 12/10` (Q-05)
- [ ] **TAGM-04** Page « Gestionnaire de tags » : voir tous les tags, filtrer, renommer, changer de catégorie, supprimer (confirmation avec nombre de médias), masquer. `R2` (v8 ✓ partiel)
- [ ] **TAGM-05** Tag **masqué** : n'apparaît plus dans les suggestions, mais une recherche explicite fonctionne toujours. `FC`
- [>] **TAGM-06** Créer des catégories personnalisées depuis le gestionnaire. `D 11/10`
- [x] **TAGM-07** Un tag créé n'importe où est enregistré et proposé partout ensuite. `FC`
- [ ] **TAGM-08** Gestionnaire de tags : bouton « **Supprimer les tags non utilisés** » (tags associés à 0 média, qui ne sont jamais supprimés automatiquement). `T2`

## NAV — En-tête et menu burger

- [~] **NAV-01** Logo au **centre** de l'en-tête, centré **horizontalement et verticalement** ; clic = accueil. `R2 R3 R4` — Corrigé le 12/10 (`T1`) : centré sur la fenêtre (il l'était sur l'en-tête, décalé de 5 px).
- [~] **NAV-02** Menu burger dépliant (à gauche). Ordre : **Bibliothèque** (accueil) · Importer · Favoris · Gestionnaire de tags · Dossiers (liste + « Nouveau ») · … · **Paramètres en dernier**, même style que les autres. `FC R1 R2 IDEES` — Phase 1 : ordre en place ; Favoris, Gestionnaire, Dossiers, Paramètres grisés « bientôt ».
- [~] **NAV-03** Statistiques (images / vidéos / tags) dans l'en-tête. (v8 ✓)
- [~] **NAV-04** **Barre de titre MyBoard** à la place de celle de Windows, aux couleurs de l'application : titre, **flèches précédent / suivant à droite du titre** (même effet que les boutons 4 / 5 de la souris, VIEW-03, VIEW-27, VIEW-30, toujours visibles même visionneuse ouverte), réduire / agrandir / fermer, déplacement de la fenêtre, double-clic pour agrandir ; aimantation et redimensionnement par les bords de Windows à conserver. Prévue juste après la validation de la phase 2, comme tâche séparée (recommandation de Claude, à confirmer). `D 13/10` — Précisé 13/10 : timing confirmé par l'utilisateur (juste après la phase 2). Inclut **VIEW-34** : plein écran de la visionneuse **sans aucun mouvement** de la barre de lecture et des boutons. Essai du 13/10 : sans la barre de titre de Windows, le haut de la fenêtre ne bouge plus pendant la bascule (barre de lecture immobile, mesuré), mais le plein écran de Tauri ne couvre alors plus la barre des tâches (fenêtre agrandie restée à 1040 px) : MyBoard devra gérer lui-même son plein écran. — Choix du 13/10 : **barre fine séparée** (32 px) au-dessus de l'en-tête actuel, inchangé ; titre « **MyBoard** » seul (icône dorée) ; flèches **grisées** quand le bouton 4 / 5 ne ferait rien ; bouton Fermer **rouge** au survol, comme Windows ; la visionneuse s'ouvre sous la barre (cachée en plein écran). Le menu du clic droit de Windows sur la barre de titre (Restaurer, Déplacer…) disparaît : à traiter avec GEN-12. La page défile désormais dans la zone sous la barre (la barre de défilement commence sous la barre de titre).
- [x] **NAV-05** **Double-clic sur le bord haut** de la fenêtre (curseur ↕, fenêtre non agrandie) : agrandissement classique, comme le bouton carré, au lieu de l'agrandissement en hauteur seulement de Windows. Le curseur ↕ et le redimensionnement en tirant ce bord restent ; le bord bas garde le comportement de Windows (choix de l'utilisateur). `D 14/10`
- [x] **NAV-06** **Les recherches comptent dans l'historique** : aujourd'hui, une recherche par tag (clic sur une pastille de la visionneuse, recherche dans la barre latérale…) grise les flèches précédent / suivant (barre de titre, boutons 4 / 5 de la souris), comme si l'historique était effacé. Chaque recherche doit être une étape : on revient en arrière ou en avant entre les recherches. `D 15/10` (NAV-04, VIEW-27, VIEW-30, SRCH-12)
- [x] **NAV-07** **Flèches précédent / suivant et liste des suggestions** : bug vu par l'utilisateur (16/10) : pendant que la liste des suggestions d'un champ de tag est affichée, la flèche « précédent » de la barre de titre s'allumait même sans historique, et « suivant » se grisait tout en restant utilisable. La liste ne compte plus pour la navigation : les flèches et les boutons 4 / 5 de la souris l'ignorent (retour / avance, fermeture de la visionneuse) ; seule Échap la ferme d'abord (choix du 16/10). `D 16/10` (NAV-04, NAV-06, VIEW-03, VIEW-30)

## SET — Paramètres (phase ultérieure sauf mention)

- [>] **SET-01** Thème de couleurs (plusieurs thèmes, import de thèmes ?). `FC PY`
- [>] **SET-02** Langue de l'application. `FC`
- [>] **SET-03** Format d'heure 12 h / 24 h. `FC`
- [>] **SET-04** Format de date. `FC`
- [>] **SET-05** Réglages par défaut de compression / conversion de la fenêtre d'import. `FC`
- [>] **SET-06** Mode de bibliothèque (référencement sur place / bibliothèque gérée, LIB-02). `D 11/10`
- [>] **SET-07** Ordre des catégories de tags au choix : préréglages (« personnelles en premier » par défaut, « petites catégories d'abord »…) et mode « personnalisé » où l'on fait glisser verticalement les pastilles de couleur des catégories pour les réordonner. `D 12/10`
- [>] **SET-08** Section « Préférences » des paramètres : lecture en boucle des vidéos activée ou non par défaut (voir VIEW-26). `D 12/10`
- [>] **SET-09** Préférences : « **Toujours afficher en taille réelle** » — la visionneuse ouvre toutes les photos à 100 % par défaut (au lieu de « ajusté »). `D 13/10`
- [>] **SET-10** **Paramètres > Raccourcis** : les raccourcis de la barre du bas de la visionneuse (VIEW-36) sont personnalisables. `D 13/10`
- [>] **SET-11** **Paramètres > Préférences : fond de la visionneuse au choix** parmi plusieurs (noir, gris sombre, damier gardé de côté…). `D 15/10` (VIEW-44)
- [>] **SET-12** **Captures d'écran des vidéos** (CTX-07) : paramètre pour **choisir le dossier** où elles sont enregistrées, et une **case à cocher** pour les enregistrer directement dans ce dossier, **sans ouvrir la fenêtre « Enregistrer sous »**. `D 15/10` (CTX-07)

## DUP — Doublons (phase ultérieure)

- [>] **DUP-01** Détection des quasi-doublons (photo retouchée, redimensionnée…) par empreinte visuelle. `PY`
- [>] **DUP-02** Page « Doublons » : chaque image à côté de ses doublons ; ouverture en grand pour comparer, flèches pour passer d'un doublon à l'autre. `FC`
- [>] **DUP-03** Case sous chaque image pour choisir lesquelles garder ; bouton « Supprimer les images restantes » (grisé si rien de sélectionné) + confirmation. `FC`
- [>] **DUP-04** Bouton rouge « Supprimer tous les doublons » + confirmation. `FC`
- [>] **DUP-05** **Après un import, proposer de supprimer du disque les doublons détectés.** Les fichiers comptés comme doublons pendant l'import (même contenu qu'un média déjà dans la bibliothèque, à un autre emplacement, LIB-03) ne sont pas ajoutés, mais restent aujourd'hui dans leurs dossiers. En fin d'import, MyBoard en montre la liste et propose de supprimer ces copies du disque (elles disparaissent alors aussi de l'Explorateur de fichiers) ; le média de la bibliothèque est gardé. Toujours avec confirmation. À préciser en phase 5 : choix fichier par fichier ou tout d'un coup, corbeille de Windows ou suppression définitive. `D 16/10` (LIB-03, DUP-03, DUP-04)

## FUT — Fonctions futures

- [>] **FUT-01** Scanner : import direct depuis le scanner de l'imprimante (Windows Image Acquisition). `FC PY`
- [>] **FUT-02** Tags automatiques par IA (WD tagger / JoyTag / CLIP) avec file de validation manuelle. `PY`
- [>] **FUT-03** Reconnaissance de personnes (étiquetage manuel puis suggestions). `PY`
- [>] **FUT-04** Exporter un fichier avec son nom d'affichage ; renommer le nom d'affichage. `PY`
- [>] **FUT-05** Échanges PC ↔ mobile (app compagnon). `résumé GLM`
- [>] **FUT-06** Portage macOS / Linux. `PY`
- [>] **FUT-07** Pools / collections ordonnées, recherche avancée. `PY`
- [>] **FUT-08** **Traduction de toute l'application en anglais**, un jour (souhait de l'utilisateur, 16/10). Les raccourcis choisis depuis suivent les mots anglais (`L` = Loop, `S` = Star). `D 16/10` (VIEW-36, VIEW-47, SET-10)

## DEV — Outils de développement (hors version finale)

- [~] **DEV-01** Commande PowerShell d'import de tags depuis des fichiers JSON (format Safebooru) : on indique le dossier des `.json` ; pour chaque `ABC.json`, les tags sont ajoutés au média `ABC.*` de la bibliothèque. Idempotente (relancer ne crée pas de doublons ni de compteurs faux). `R1 R4` — Précisé 12/10 : chaque tag reçoit sa vraie catégorie quand le JSON la fournit (banque DEV-03).
- [~] **DEV-02** Générateur de bibliothèque de test (10 000 – 100 000 entrées) pour mesurer la fluidité. `D 11/10`
- [~] **DEV-03** Banque de test « grandeur nature » téléchargée depuis Danbooru, uniquement « rating:g » (tout public) : ~3 000 images en pleine résolution, ~200 vidéos, ~100 GIF, chacun avec un JSON (tags **et** catégories). Rangée dans `new V2\échantillon test SFW\BooruScrap - 3k demo`, hors du dépôt Git. `D 12/10`
- [~] **DEV-04** Le générateur (DEV-02) ajoute des tags tirés d'une banque de 100 à 1 000 mots, répartis de façon réaliste : certains sur 50–80 % de la bibliothèque, d'autres sur une dizaine de médias seulement. `D 12/10`
- [~] **DEV-05** Variable réservée aux tests `MYBOARD_MONITOR` : la fenêtre s'ouvre sur l'écran choisi (le 1920×1080 C24F390 pendant les tests de Claude). Mesure de fluidité adaptée à un écran 60 Hz (images ratées) ; l'ancienne mesure (écran principal 2560×1440 à 180 Hz, images/s) reste disponible telle quelle. Fonctionnement documenté dans `CLAUDE.md`. `D 12/10`
- [~] **DEV-06** Bibliothèques de test rangées dans `new V2\échantillon test SFW\MyBoard-test` (dossier visible par l'utilisateur, créé par lui) au lieu de `%LOCALAPPDATA%\MyBoard-test` (redirigé en secret par l'application Claude). `D 13/10`

---

## Questions ouvertes

| ID | Question | Statut |
|---|---|---|
| Q-01 | Fichier référencé déplacé / renommé / supprimé hors de l'app : que faire ? | ouverte |
| Q-02 | Miniatures : à l'import, à la demande, ou hybride ? taille ? nettoyage du cache ? | **résolue 11/10** : hybride → LIB-06, LIB-09 à LIB-11, D-011 |
| Q-03 | Conversion / compression avec le référencement sur place : où écrire le résultat ? | ouverte |
| Q-04 | « Supprimer » avec le référencement sur place : retirer de la bibliothèque seulement, ou aussi le fichier ? | ouverte |
| Q-05 | Ordre et couleurs des 8 catégories initiales | **résolue 12/10** → TAGM-03, SET-07 |
