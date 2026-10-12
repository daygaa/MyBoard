# MyBoard — règles de travail pour Claude

Application de bureau locale pour trier photos / vidéos / documents par tags (style booru).
Stack : **Tauri 2** (backend Rust + SQLite) + **React / TypeScript / Vite / Tailwind / shadcn**.

Documents de référence (à lire avant toute tâche) :
- `docs/SPEC.md` — cahier des charges : toutes les demandes, avec un ID stable et un statut.
- `docs/DECISIONS.md` — décisions d'architecture et leurs raisons.
- `CHANGELOG.md` — ce qui a changé à chaque version livrée.
- `docs/reference-ui/` — captures de l'ancienne interface v8 (apparence à reproduire ; non versionné).

## L'utilisateur

- Francophone : toujours répondre en français et expliquer simplement (débutant en code,
  mais avec de bonnes bases techniques). Définir tout terme technique utilisé.
- Teste tout personnellement sous **Windows 10**. A quitté l'IA précédente parce qu'elle
  sautait des demandes, en inventait et faisait des modifications non demandées.

## Règles de travail (non négociables)

1. **Faire exactement ce qui est demandé.** Pas de modification non sollicitée. Si je repère
   autre chose à corriger, je le **propose**, je ne le fais pas.
2. **Chaque demande a un ID** (`ZONE-NN` dans `docs/SPEC.md`). Une nouvelle demande → nouvelle
   ligne dans SPEC (sans renuméroter). Demande ambiguë → je pose la question avant de coder.
3. **Ne jamais annoncer « corrigé » sans l'avoir vérifié** réellement sous Windows
   (compilation + lancement + vérification du comportement). Si je n'ai pas pu vérifier, je le dis.
4. **Statuts SPEC** : je passe une demande en `[~]` quand je la livre ; **seul l'utilisateur la
   passe en `[x]`** après son test.
5. **Compte rendu** à chaque livraison : liste de chaque ID traité → fait / pas fait / partiel,
   et comment le tester.
6. **Après chaque tâche livrée** : mettre à jour `CHANGELOG.md`, commit Git (message en
   français citant les IDs), puis sauvegarde :
   `powershell -File "..\backup.ps1" -Label "<résumé court>"` (crée `Backups/vX`).

## Données et sécurité

- **Ne jamais modifier, déplacer ni supprimer les fichiers médias de l'utilisateur** sans
  demande explicite. Les tests sur ses vrais fichiers (C: et D:) se font en lecture seule.
- `../../Versions historiques/` est en **lecture seule** (référence uniquement).
- Dépôt GitHub **public** (`daygaa/MyBoard`) : jamais de médias, de base de données, de
  captures contenant des images tierces, ni de secrets dans Git (voir `.gitignore`).
- Jamais de `push --force` sur `main` sans accord explicite. La branche `old_GLM` ne se touche pas.

## Règles de code

- **Apparence** : reproduire la v8 (thème sombre `#111214`, accent doré `#d9a94e`, jamais
  d'indigo / bleu vif, **aucun emoji** dans l'interface — icônes Lucide).
- Chaque zone d'interface porte un attribut `data-zone="zone.sous-zone"` (nom court, stable,
  en français) — c'est ainsi que l'utilisateur désigne les éléments dans ses retours.
- **Pas de duplication** : on modifie le composant partagé, on ne le recopie pas.
- Fichiers courts et lisibles (viser < 300 lignes ; découper au-delà).
- Aucune erreur de typage ou de compilation ignorée ; aucune dépendance inutilisée.
- Commentaires en français, brefs, qui expliquent le *pourquoi*.
- Toute opération multiple en base = **une transaction**. Compteurs tenus par la base, jamais
  recalculés à la main côté application.
- Performance (D-008) : grille virtualisée, aucun effet coûteux par vignette, cocher une
  vignette ne redessine qu'elle, mesurer sur 10k–100k médias.
- Code compatible Windows d'abord (chemins, commandes) ; ne jamais supposer Linux.

## Commandes

Depuis le Workspace (Rust : `cargo` est dans `%USERPROFILE%\.cargo\bin`) :

- `npm install` — dépendances de l'interface (une fois, puis à chaque changement de `package.json`).
- `npm run tauri dev` — lance l'application en développement (rechargement automatique de l'interface).
- `npm run tauri build -- --no-bundle` — version finale : `src-tauri\target\release\myboard.exe`.
- `npx tsc` — vérification des types TypeScript ; dans `src-tauri` : `cargo check`, `cargo clippy`.
- Bibliothèque de test (DEV-02, avec tags DEV-04), dans `src-tauri` :
  `cargo run --release --example gen_test_library -- "<dossier vide>" 100000` ;
  ajouter les tags à une bibliothèque générée qui n'en a pas : `… -- "<dossier>" --tags-seulement`.
- Banque de test Danbooru (DEV-03) : `node scripts/fetch-booru-bank.mjs "<dossier>" [3000] [200] [100]`
  (images, vidéos, GIF + un JSON par média ; relancer reprend où on s'était arrêté). Déjà
  téléchargée dans `new V2\échantillon test SFW\BooruScrap - 3k demo`.
- Import de tags depuis des JSON (DEV-01), en PowerShell depuis le Workspace :
  `.\scripts\import-tags-json.ps1 -Dossier "<dossier des .json>" -Donnees "<dossier de données>"`
  (ou variable `MYBOARD_DATA_DIR` ; la vraie bibliothèque n'est jamais choisie par défaut).
- Mesure de fluidité (D-008), deux modes :
  - `node scripts/bench-grid.mjs "<dossier de la bibliothèque de test>"` — mode d'origine : la
    fenêtre s'ouvre là où Windows la place, fluidité en images/s (mesures de la phase 1 en
    2560×1440 à 180 Hz) ;
  - `node scripts/bench-grid.mjs "<dossier>" --ecran 1920x1080` — fenêtre forcée sur l'écran
    1920×1080 (DEV-05) ; ajoute la colonne « images ratées ». Sous Windows 10, la fenêtre suit
    le rythme de l'écran PRINCIPAL (180 Hz) même posée sur l'écran à 60 Hz (mesuré le 12/10).
- Pilotage de la fenêtre pour vérifier (clics, clavier, captures) : `node scripts/cdp.mjs …`
  (voir l'en-tête du fichier). Le glisser-déposer natif ne peut pas être simulé : à faire tester.

Variables d'environnement utiles :
- `MYBOARD_DATA_DIR` — autre dossier de données (défaut `%LOCALAPPDATA%\MyBoard`). Toujours
  l'utiliser pour les tests : la bibliothèque réelle de l'utilisateur ne doit pas être polluée.
- `MYBOARD_FFMPEG` — chemin de ffmpeg (dossier ou `.exe`) si la détection automatique échoue.
- `WEBVIEW2_USER_DATA_FOLDER` / `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`
  — profil WebView2 séparé et port de débogage (pilotage et captures pendant les tests).
- `MYBOARD_MONITOR` (tests uniquement, DEV-05) — écran où s'ouvre la fenêtre, par sa définition
  (`1920x1080`) ou son nom Windows (`DISPLAY1`). Sans la variable, rien ne change.

**Attention (sessions Claude Code, 12/10/2026)** : l'application Claude est une application du
Microsoft Store ; ce que ses commandes écrivent dans `%LOCALAPPDATA%` est redirigé vers
`%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Local\`. Les bibliothèques de test
`MyBoard-test` y sont donc réellement rangées, invisibles à l'adresse habituelle pour
l'utilisateur et pour l'Explorateur. Tester « Ouvrir dans l'explorateur » sur des fichiers du
Bureau, pas sur des fichiers de ce dossier.

Structure : `src-tauri/src` (Rust : `db/`, `import/`, `thumbs/`, `media/` (visionneuse, protocole
`media://`), `library.rs`, `search.rs`, `tags.rs`, `ffmpeg.rs`, `test_screen.rs`) ·
`src/` (React : `components/{layout,library,import,search,tags,viewer,ui}`, `stores/`, `hooks/`, `lib/`).
