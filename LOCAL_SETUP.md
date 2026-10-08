# MyBoard — Guide de lancement local

## ⚡ Démarrage rapide (Windows PowerShell)

```powershell
# 1. Clone le repo (déjà fait si tu lis ça)
git clone https://github.com/daygaa/MyBoard.git
cd MyBoard

# 2. Setup automatique (crée .env, installe les deps, génère Prisma)
.\setup.ps1

# 3. Lance l'app
bun run dev
```

Ouvre http://localhost:3000 dans ton navigateur. C'est prêt.

> ⚠️ La **toute 1ère requête** prend ~15-20s (Next.js compile la page la 1ère fois). C'est normal. Les suivantes sont instantanées.

---

## 📋 Détails des étapes (si setup.ps1 ne marche pas)

### 1. Prérequis : installer Bun

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
```powershell
bun --version
```

### 2. Créer le fichier .env

Le fichier `.env` est **volontairement exclu du repo** (sécurité — il contient le chemin de la DB). Crée-le à partir du template :

```powershell
Copy-Item .env.example .env
```

Ou crée-le manuellement avec ce contenu :
```
DATABASE_URL="file:../library/library.db"
```

> Le chemin est **relatif** au fichier `prisma/schema.prisma`. `../library/library.db` = remonte d'un niveau (de `prisma/` à la racine) puis entre dans `library/`. Ça marche sur Windows, macOS et Linux sans modification.

### 3. Installer les dépendances

```powershell
bun install
```

Ça télécharge toutes les dépendances (Next.js, Prisma, shadcn/ui, sharp, etc.).
Compte ~1-2 minutes la première fois.

### 4. Générer le Prisma Client

```powershell
bun run db:generate
```

Cela génère le client Prisma à partir du schéma. À faire après chaque `bun install` ou si tu modifies `prisma/schema.prisma`.

### 5. Lancer l'app

```powershell
bun run dev
```

Ouvre http://localhost:3000.

---

## ⚠️ Important : re-créer les médias (premier lancement)

Pour réduire la taille du repo Git, les dossiers suivants sont **vides** :
- `library/originals/` (les médias originaux)
- `library/thumbs/` (les miniatures)
- `demo_assets/safebooru/` (les 300 images Safebooru)

**La DB `library/library.db` contient déjà les 315 médias + 1838 tags**, mais les fichiers image correspondants ne sont pas sur disque. Les miniatures n'afficheront donc rien tant que tu n'as pas re-seedé.

### Option A — Re-télécharger les 300 images Safebooru (complet, recommandé)

```powershell
# 1. Re-télécharge les images Safebooru (~6-8 min)
bun run fetch:safebooru

# 2. RESET la DB (écrase les données existantes — nécessaire pour re-seed propre)
bun run db:push

# 3. Démarre le serveur
bun run dev

# 4. Dans un AUTRE terminal PowerShell (pendant que dev tourne) :
curl.exe -X POST http://localhost:3000/api/seed
```

> ⚠️ **IMPORTANT — PowerShell et curl** : utilise `curl.exe` (le vrai curl), pas `curl`. PowerShell aliases `curl` vers `Invoke-WebRequest` qui ne comprend pas `-X POST`. Si tu tapes `curl -X POST ...`, tu auras l'erreur `Impossible de trouver un paramètre correspondant au nom « X »`.

Tu auras les 315 médias (15 démo originales + 300 Safebooru) avec leurs 1838 tags.

### Option B — Juste les 15 images démo (rapide)

```powershell
bun run dev
# Dans un autre terminal :
curl.exe -X POST http://localhost:3000/api/seed
```

Tu auras juste les 15 images démo (chat, fleur, montagne, plage, portrait + variantes). Suffisant pour tester l'UI.

### Option C — Réimporter tes propres médias

Lance l'app, va sur http://localhost:3000/import, et drag-drop tes propres fichiers. La DB se remplira au fur et à mesure.

---

## 🔧 Commandes utiles

| Commande | Action |
|---|---|
| `bun run dev` | Démarre le serveur dev sur port 3000 |
| `bun run lint` | Vérifie la qualité du code (ESLint) |
| `bun run db:push` | Recrée/synchronise le schéma DB (**⚠️ reset les données**) |
| `bun run db:generate` | Régénère le Prisma Client (à faire après `bun install`) |
| `bun run fetch:safebooru` | Télécharge 300 images taguées depuis Safebooru |
| `curl.exe -X POST http://localhost:3000/api/seed` | Importe les images de démo en DB |

> **Note PowerShell** : utilise toujours `curl.exe` et non `curl` (alias PowerShell → Invoke-WebRequest).

---

## 📁 Structure du projet

```
MyBoard/
├── .env                    ← Créé par setup.ps1 (à partir de .env.example)
├── .env.example            ← Template du .env (committed)
├── setup.ps1               ← Script de setup automatique (Windows)
├── package.json            ← Scripts dev/lint/db:push/fetch:safebooru
├── prisma/schema.prisma    ← Schéma DB (Media, Tag, MediaTag, Group, MediaGroup, AppMeta)
├── library/                ← Bibliothèque gérée par l'app
│   ├── library.db          ← Base SQLite (315 médias + 1838 tags)
│   ├── originals/          ← Médias originaux (vides au début, re-créés via seed)
│   └── thumbs/             ← Miniatures (vides au début, re-créées via seed)
├── demo_assets/            ← Images de démo (source pour tester l'import)
│   ├── *.jpg               ← 15 images démo originales
│   └── safebooru/          ← 300 images Safebooru (re-téléchargeables via fetch:safebooru)
├── src/                    ← Code source de l'app
│   ├── app/                ← Pages Next.js (page.tsx, import/, groups/, api/)
│   ├── components/board/    ← Composants UI (Header, MediaGrid, LightboxViewer, etc.)
│   ├── components/import/   ← Composants page import
│   ├── components/ui/       ← shadcn/ui (60+ composants)
│   └── lib/                ← Libs partagées (shared.ts, search.ts, storage.ts, etc.)
├── scripts/                ← Scripts utilitaires
│   ├── fetch-safebooru.ts  ← Télécharge 300 images Safebooru
│   └── import-tags-json.ts  ← Importe des tags depuis JSON sidecar
└── LOCAL_SETUP.md          ← Ce fichier
```

---

## 🐛 Problèmes courants

### "Environment variable not found: DATABASE_URL"

Le fichier `.env` n'existe pas. Crée-le :
```powershell
Copy-Item .env.example .env
```

Puis relance `bun run db:generate` et `bun run dev`.

### "curl : Impossible de trouver un paramètre correspondant au nom « X »"

PowerShell aliases `curl` vers `Invoke-WebRequest`. Utilise `curl.exe` à la place :
```powershell
curl.exe -X POST http://localhost:3000/api/seed
```

### "Port 3000 déjà utilisé"

Un autre process tourne dessus.
```powershell
# Windows (PowerShell)
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### "Prisma Client not generated"

```powershell
bun run db:generate
```

### "Les miniatures ne s'affichent pas"

Tu n'as pas re-seedé. Voir section "⚠️ Important : re-créer les médias" ci-dessus.

### "Hydration error" / erreurs React

Clear le cache Next.js :
```powershell
Remove-Item -Recurse -Force .next
bun run dev
```

---

## 💾 Sauvegarder ta bibliothèque

Pour sauvegarder, copie simplement le dossier `library/` (ou au minimum
`library/library.db`). C'est un backup complet : les médias originaux + les
miniatures + tous les tags + les groupes.

---

## 📞 Support

Si tu rencontres un souci, vérifie d'abord la section "Problèmes courants" ci-dessus.
Le fichier `worklog.md` à la racine contient l'historique complet du développement.
