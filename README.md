# MyBoard

Application de bureau **locale** pour trier ses photos, vidéos et documents par **tags**,
à la manière des image boards « booru » (Safebooru, Danbooru, Hydrus Network) —
sans dossiers, sans cloud, sur son propre PC.

> **État : réécriture en cours (phase 0 — fondations).** L'ancienne version web (Next.js,
> écrite avec GLM 5.2) est conservée sur la branche [`old_GLM`](https://github.com/daygaa/MyBoard/tree/old_GLM).

## Technologies

- [Tauri 2](https://tauri.app/) — application de bureau légère ; le travail lourd est fait en **Rust**.
- **SQLite** — base de données locale (index, tags, favoris, dossiers).
- **React + TypeScript + Vite + Tailwind CSS + shadcn/ui** — interface.
- **ffmpeg** — miniatures et conversion des vidéos (fourni avec l'application).

## Documentation

- [`docs/SPEC.md`](docs/SPEC.md) — cahier des charges complet.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — choix d'architecture et leurs raisons.
- [`CHANGELOG.md`](CHANGELOG.md) — historique des versions.

## Lancer l'application

_Les instructions arriveront avec la phase 1 (socle)._
