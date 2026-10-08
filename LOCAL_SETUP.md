# MyBoard — Guide de lancement local

Ce guide suppose que tu as téléchargé le workspace complet et extrait les
fichiers/dossiers sur ta machine. Voici comment lancer l'app en local.

## ⚠️ Important : re-créer les médias (premier lancement)

Pour réduire la taille du téléchargement, les dossiers suivants ont été vidés :
- `library/originals/` (les 343 médias originaux, 100 Mo)
- `library/thumbs/` (les 343 miniatures, 11 Mo)
- `demo_assets/safebooru/` (328 images Safebooru, 98 Mo)

**La DB `library/library.db` contient toujours les 343 entrées + 2204 tags**,
mais les fichiers image correspondants ne sont plus sur disque. Les miniatures
n'afficheront donc rien tant que tu n'as pas re-seedé.

### Option A — Re-télécharger les 328 images Safebooru (recommandé)

```bash
# 1. Re-télécharge les images Safebooru (~6-8 min)
bun run fetch:safebooru

# 2. Reset la DB et re-seed (hash + thumb + tags pour chaque image)
#    Sur Windows PowerShell :
bun run db:push    # recrée le schema (écrase les données existantes)
#    Puis démarre le serveur :
bun run dev
#    Dans un autre terminal, lance le seed :
curl -X POST http://localhost:3000/api/seed
```

Tu auras les 343 médias (15 démo originales + 328 Safebooru) avec leurs 2204 tags.

### Option B — Juste les 10 images démo (rapide, ~1 Mo)

```bash
bun install
bun run db:push    # reset DB
bun run dev
# Dans un autre terminal :
curl -X POST http://localhost:3000/api/seed
```

Tu auras juste les 10 images démo originales (chat, fleur, montagne, plage,
portrait en 2 variantes) avec ~13 tags. Suffisant pour tester l'UI.

### Option C — Réimporter tes propres médias

Lance l'app, va sur http://localhost:3000/import, et drag-drop tes propres
fichiers. La DB se remplira au fur et à mesure.

## 1. Prérequis

Tu as besoin de **[Bun](https://bun.sh/)** (runtime JavaScript, plus rapide que
Node.js, installé en une commande). Alternative : Node.js 20+.

### Installer Bun

**Windows (PowerShell) :**
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```
Redémarre ton terminal après.

**macOS / Linux :**
```bash
curl -fsSL https://bun.sh/install | bash
```

Vérifie :
```bash
bun --version
```

### (Optionnel) ffmpeg — pour les miniatures vidéo + transcodage

Si tu veux importer des vidéos et générer leurs miniatures / les transcoder,
installe ffmpeg :
- **Windows** : [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) → télécharge
  "ffmpeg-git-full.7z", extrais, et ajoute le dossier `bin` au PATH.
- **macOS** : `brew install ffmpeg`
- **Linux** : `sudo apt install ffmpeg`

Vérifie :
```bash
ffmpeg -version
```

## 2. Installation des dépendances

Ouvre un terminal **dans le dossier du projet** (là où se trouve `package.json`),
puis :

```bash
bun install
```

Ça télécharge toutes les dépendances (Next.js, Prisma, shadcn/ui, sharp, etc.).
Compte ~1-2 minutes la première fois.

## 3. Préparation de la base de données

La base SQLite est dans `library/library.db`. Elle est créée automatiquement au
premier lancement, mais il faut d'abord "pousser" le schéma Prisma :

```bash
bun run db:push
```

Ça crée les tables `Media`, `Tag`, `MediaTag`, `Group`, `MediaGroup`, `AppMeta`
dans `library.db`. Idempotent : tu peux le relancer sans casser tes données.

> **Note** : le fichier `.env` contient `DATABASE_URL=file:../library/library.db`
> (chemin relatif). Ça marchera sur n'importe quelle machine.

## 4. Lancer l'app

```bash
bun run dev
```

Tu devrais voir :
```
▲ Next.js 16.x (Turbopack)
- Local:        http://localhost:3000
✓ Ready in 1.3s
```

Ouvre **http://localhost:3000** dans ton navigateur.

> ⚠️ La **toute première requête** sur `http://localhost:3000/` prend ~15-20s
> (Next.js compile la page à la volée la 1ère fois). C'est normal. Les requêtes
> suivantes sont instantanées.

## 5. Importer les images de démo (voir section "Important" en haut)

Voir la section "⚠️ Important : re-créer les médias" au début de ce fichier.

## 6. Vérifier que tout marche

- Page browse : http://localhost:3000/
- Page import : http://localhost:3000/import
- Page groupes : http://localhost:3000/groups (si tu en crées)
- Stats : http://localhost:3000/api/stats
- Tags : http://localhost:3000/api/tags

## 7. Commandes utiles

| Commande | Action |
|---|---|
| `bun run dev` | Démarre le serveur dev sur port 3000 |
| `bun run lint` | Vérifie la qualité du code (ESLint) |
| `bun run db:push` | Recrée/synchronise le schéma DB |
| `bun run db:reset` | Réinitialise la DB (⚠️ efface les données) |
| `bun run fetch:safebooru` | Télécharge 300 images taguées depuis Safebooru |
| `bun run scripts/import-tags-json.ts "dossier"` | Importe des tags depuis JSON sidecar |
| `curl -X POST http://localhost:3000/api/seed` | Importe les images de démo en DB |

## 8. Où sont mes fichiers ?

```
ton-projet/
├── library/                    ← Bibliothèque gérée par l'app
│   ├── library.db              ← Base SQLite (tags, index, catalogue)
│   ├── originals/<2hex>/       ← Médias originaux (shardés par hash)
│   └── thumbs/<2hex>/          ← Miniatures JPEG
├── demo_assets/                ← Images de démo (source factice pour tester l'import)
│   ├── chat.jpg, fleur.jpg, …  ← Démo originale (10 images)
│   └── safebooru/              ← Images téléchargées depuis Safebooru (328)
├── prisma/schema.prisma        ← Schéma de la base
├── src/                        ← Code source de l'app
├── scripts/                    ← Scripts utilitaires
│   ├── fetch-safebooru.ts      ← Télécharge 300 images Safebooru
│   ├── import-tags-json.ts     ← Importe des tags depuis JSON sidecar
│   └── import-tags-json.ps1    ← Wrapper PowerShell
└── package.json
```

> ⚠️ `library/` est **géré par l'app** : ne renomme, déplace ni supprime rien
> à la main dans ce dossier. Pour reset : supprime `library/library.db` (et
> éventuellement `library/originals` + `library/thumbs`), puis `bun run db:push`
> + re-seed.

## 9. Problèmes courants

**"Port 3000 déjà utilisé"** : un autre process tourne dessus.
```bash
# Linux/macOS
lsof -i:3000
kill -9 <PID>

# Windows (PowerShell)
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

**"Prisma Client not generated"** :
```bash
bun run db:generate
```

**"Les miniatures ne s'affichent pas"** : tu n'as pas re-seedé. Voir section
"⚠️ Important" en haut de ce fichier.

## 10. Sauvegarder ta bibliothèque

Pour sauvegarder, copie simplement le dossier `library/` (ou au minimum
`library/library.db`). C'est un backup complet : les médias originaux + les
miniatures + tous les tags + les groupes.
