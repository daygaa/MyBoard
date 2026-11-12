# MyBoard

Application de bureau **locale** pour trier ses photos, vidéos et documents par **tags**, à la manière des image
boards « booru » (Safebooru, Danbooru, Hydrus Network) — sans cloud, sur son propre PC. Les médias restent à leur
place : MyBoard les indexe sans jamais les modifier (sauf si on le lui demande à l'import : compression, conversion).

> **État (novembre 2026)** : phases 0 à 4 livrées — bibliothèque, visionneuse, tags, recherche, menus, puis options
> d'import. Prochaine étape : phase 5. L'ancienne version web (Next.js, écrite avec GLM 5.2) est conservée sur la
> branche [`old_GLM`](https://github.com/daygaa/MyBoard/tree/old_GLM).

## Ce que fait MyBoard

- **Bibliothèque** : grille rapide même avec 100 000 médias (images, vidéos, GIF, PDF, sons), tris, favoris, dossiers,
  sélection multiple, vérification des fichiers disparus ou sur un disque débranché.
- **Visionneuse** : images, vidéos, GIF animés, PDF et sons ; zoom, plein écran, navigation au clavier.
- **Tags** : catégories, synonymes et parents (un tag peut en entraîner d'autres), gestionnaire de tags avec
  corbeille, tags masqués, import et export.
- **Recherche** : barre avec suggestions, combinaisons de tags, historique.
- **Import** : liste des fichiers avant l'import avec aperçus, tags par défaut, compression et conversion des images
  et des vidéos (encodeur au choix), paires de fichiers, pause / reprise / annulation, bilan de fin.
- **ffmpeg fourni** : miniatures et conversions des vidéos sans rien installer.

## Technologies

- [Tauri 2](https://tauri.app/) — application de bureau légère ; le travail lourd est fait en **Rust**.
- **SQLite** — base de données locale (index, tags, favoris, dossiers).
- **React + TypeScript + Vite + Tailwind CSS + shadcn/ui** — interface.
- **ffmpeg** (version « partagée » de BtbN, licence GPL) — miniatures et conversion des vidéos.

## Documentation

- [`docs/SPEC.md`](docs/SPEC.md) — cahier des charges complet : chaque demande a un identifiant et un statut.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — choix d'architecture et leurs raisons.
- [`docs/DEV.md`](docs/DEV.md) — guide de développement : commandes, variables d'environnement, structure, règles de
  code.
- [`CHANGELOG.md`](CHANGELOG.md) — historique des versions.

## Compiler et lancer

Prérequis (Windows 10/11) : [Node.js](https://nodejs.org/) 22+, [Rust](https://rustup.rs/) (MSVC), les « Build Tools »
C++ de Visual Studio, WebView2 (déjà présent sous Windows).

```bash
npm install
npm run tauri dev                      # développement
npm run tauri build -- --no-bundle     # version finale : src-tauri\target\release\myboard.exe
```

Puis, en PowerShell, pour placer ffmpeg à côté de `myboard.exe` (téléchargement d'une version épinglée, empreinte
SHA-256 vérifiée) :

```powershell
.\scripts\fetch-ffmpeg.ps1
```

Les données de MyBoard (base + miniatures) sont rangées dans `%LOCALAPPDATA%\MyBoard` ; la variable `MYBOARD_DATA_DIR`
permet d'en utiliser une autre (bibliothèques de test).
