# MyBoard — guide de développement

Application de bureau locale pour trier photos / vidéos / documents par tags (style booru).
Stack : **Tauri 2** (backend Rust + SQLite) + **React / TypeScript / Vite / Tailwind / shadcn**.

À lire avant de toucher au code. Les règles de travail avec l'utilisateur (langue, marques, livraisons, sécurité) sont
dans le `CLAUDE.md` du dossier de lancement de Claude Code (hors dépôt) ; ce fichier-ci ne garde que le technique.

Documents de référence :
- `docs/SPEC.md` — cahier des charges : toutes les demandes, avec un ID stable et un statut (fait foi).
- `docs/DECISIONS.md` — décisions d'architecture et leurs raisons (D-001…).
- `CHANGELOG.md` — ce qui a changé à chaque version livrée.
- Apparence de référence : l'ancienne interface v8 (captures archivées hors du dépôt ; la v8 elle-même est dans
  `Versions historiques`, en lecture seule).

## Règles de code

- **Apparence** : reproduire la v8 (thème sombre `#111214`, accent doré `#d9a94e`, jamais d'indigo / bleu vif, **aucun
  emoji** dans l'interface — icônes Lucide).
- Chaque zone d'interface porte un attribut `data-zone="zone.sous-zone"` (nom court, stable, en français) — c'est
  ainsi que l'utilisateur désigne les éléments dans ses retours.
- **Pas de duplication** : on modifie le composant partagé, on ne le recopie pas.
- Fichiers courts et lisibles (viser < 300 lignes ; découper au-delà).
- Aucune erreur de typage ou de compilation ignorée (`npx tsc --noEmit -p .`, `cargo clippy`) ; aucune dépendance
  inutilisée. Jamais de formateur automatique (pas de prettier : le projet garde ses lignes longues).
- Commentaires en français, brefs, qui expliquent le *pourquoi*.
- Toute opération multiple en base = **une transaction**. Compteurs tenus par la base, jamais recalculés à la main côté
  application.
- Performance (D-008) : grille virtualisée, aucun effet coûteux par vignette, cocher une vignette ne redessine qu'elle,
  mesurer sur 10k–100k médias.
- Code compatible Windows d'abord (chemins, commandes) ; ne jamais supposer Linux.
- Superpositions : après tout changement de `z-index` ou de position, vérifier chaque élément superposé de la même zone
  (menu burger, en-tête, haut de la grille, menus du clic droit, pop-ins, visionneuse).

**Bases communes à appliquer à tout nouvel élément** (principes GEN et CTX gardés `[~]` dans la SPEC) :
- menus du clic droit maison (CTX-01, CTX-02, CTX-03, CTX-18) ; chaque nouvelle section reçoit ses menus à sa création,
  entrées pas encore disponibles grisées (CTX-16) ;
- curseurs (GEN-13) ; textes d'information sélectionnables, classe `select-text` (GEN-17) ;
- toute nouvelle pop-in : `onEnter`, `data-principale` (GEN-20), aucun mot coupé (GEN-22), ≤ 80 % de la fenêtre (GEN-25) ;
- toujours pouvoir revenir en arrière (GEN-21) ; toute zone qui défile à part : `overscroll-behavior: contain` (GEN-24) ;
- raccourcis : tous dans `src/lib/shortcuts.ts`, lettres des mots anglais, affichés dans les bulles et les menus ;
- visionneuse : tout nouvel élément flottant va dans `KEEP_SHOWN` (`src/components/viewer/viewerChrome.ts`, VIEW-48).

## Commandes

Depuis le Workspace (Rust : `cargo` est dans `%USERPROFILE%\.cargo\bin`) :

- `npm install` — dépendances de l'interface (une fois, puis à chaque changement de `package.json`).
- `npm run tauri dev` — lance l'application en développement (rechargement automatique de l'interface).
- `npm run tauri build -- --no-bundle` — version finale : `src-tauri\target\release\myboard.exe`.
- Compilation de vérification (sans toucher à l'exe de l'utilisateur) :
  `CARGO_TARGET_DIR="$(pwd -W)/src-tauri/target/verif" npm run tauri build -- --no-bundle > <journal> 2>&1`
  (≈ 8 min ; résultat dans `src-tauri\target\verif\release\myboard.exe`).
- `npx tsc --noEmit -p .` — vérification des types TypeScript ; dans `src-tauri` : `cargo check`, `cargo clippy`.
- `.\scripts\fetch-ffmpeg.ps1` (PowerShell) — ffmpeg fourni (IMP-49, D-070) : télécharge la version épinglée,
  vérifie son empreinte SHA-256 et la range dans `src-tauri\target\release\ffmpeg` (à côté de myboard.exe ;
  `-Destination <dossier>` pour un autre exe, `-Archive <zip>` pour une archive déjà téléchargée). Jamais dans Git.
  Ordre de recherche de MyBoard : `MYBOARD_FFMPEG`, ffmpeg du PC s'il est complet, copie fournie, ffmpeg du PC incomplet.
- Bibliothèque de test (DEV-02, avec tags DEV-04), dans `src-tauri` :
  `cargo run --release --example gen_test_library -- "<dossier vide>" 100000` ;
  ajouter les tags à une bibliothèque générée qui n'en a pas : `… -- "<dossier>" --tags-seulement`.
- Banque de test Danbooru (DEV-03) : `node scripts/fetch-booru-bank.mjs "<dossier>" [3000] [200] [100]`
  (images, vidéos, GIF + un JSON par média ; relancer reprend où on s'était arrêté).
- Import de tags depuis des JSON (DEV-01), en PowerShell depuis le Workspace :
  `.\scripts\import-tags-json.ps1 -Dossier "<dossier des .json>" -Donnees "<dossier de données>"`
  (ou variable `MYBOARD_DATA_DIR` ; la vraie bibliothèque n'est jamais choisie par défaut).
- Mesure de fluidité (D-008), deux modes :
  - `node scripts/bench-grid.mjs "<dossier de la bibliothèque de test>"` — fenêtre placée par Windows, fluidité en
    images/s (mesures de la phase 1 en 2560×1440 à 180 Hz) ;
  - `node scripts/bench-grid.mjs "<dossier>" --ecran 1920x1080` — fenêtre forcée sur l'écran 1920×1080 (DEV-05) ;
    ajoute la colonne « images ratées ». Sous Windows 10, la fenêtre suit le rythme de l'écran PRINCIPAL (180 Hz) même
    posée sur l'écran à 60 Hz (mesuré le 12/10).
- Pilotage de la fenêtre pour vérifier (clics, clavier, captures) : `node scripts/cdp.mjs …` (voir l'en-tête du
  fichier). Le glisser-déposer natif ne peut pas être simulé : à faire tester.

## Variables d'environnement

- `MYBOARD_DATA_DIR` — autre dossier de données (défaut `%LOCALAPPDATA%\MyBoard`). Toujours l'utiliser pour les
  tests : la bibliothèque réelle de l'utilisateur ne doit pas être polluée.
- `MYBOARD_FFMPEG` — chemin de ffmpeg (dossier ou `.exe`) pour les essais : pris avant tout autre (IMP-49).
- `MYBOARD_SANS_FFMPEG` (tests uniquement, IMP-49) — `1` : MyBoard fait comme si ffmpeg était absent ; `pc` : le
  ffmpeg du PC est ignoré (seule la copie fournie sert). À retirer avec l'installateur (IMP-77).
- `WEBVIEW2_USER_DATA_FOLDER` / `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333` — profil WebView2
  séparé et port de débogage (pilotage et captures pendant les tests). Cette variable REMPLACE les réglages du moteur
  de `tauri.conf.json` : toujours les redonner.
- `MYBOARD_MONITOR` (tests uniquement, DEV-05) — écran où s'ouvre la fenêtre, par sa définition (`1920x1080`) ou son
  nom Windows (`DISPLAY1`). Sans la variable, rien ne change.

## Données d'essai

`new V2\échantillon test SFW\MyBoard-test\` (DEV-06, DEV-07) : bases d'essai, fichiers d'essai et lanceurs. Attention :
ce dossier est DANS l'échantillon ; réimporter « échantillon test SFW » avec ses sous-dossiers importerait aussi
`MyBoard-test` et `BooruScrap - 3k demo`. Le détail (rôle de chaque base et de chaque dossier) est dans l'inventaire
privé `docs/suivi/donnees-test.md` (hors dépôt).

## Structure

`src-tauri/src` (Rust : `db/`, `import/`, `thumbs/`, `media/` (visionneuse, protocole `media://`), `library.rs`,
`library_check/`, `search.rs`, `tags.rs`, `tag_jobs.rs`, `ffmpeg.rs`, `display.rs` (densité réelle de l'écran),
`fullscreen.rs` (plein écran sans barre de titre Windows), `window_border.rs` (double-clic sur le bord haut de la
fenêtre), `webview_settings.rs` (menu et raccourcis du navigateur coupés), `clipboard_text.rs` (texte du
presse-papiers), `system_menu.rs` (menu de la fenêtre, Alt + Espace), `test_screen.rs`) · `src/` (React :
`components/{layout,library,import,search,tags,tagmanager,folders,notes,viewer,ui}`, `stores/`, `hooks/`, `lib/`).
