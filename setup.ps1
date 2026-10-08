<#
.SYNOPSIS
    Setup MyBoard — crée .env, installe les dépendances, génère le Prisma Client.
    À lancer UNE FOIS après avoir cloné le repo.

.DESCRIPTION
    Ce script :
    1. Crée le fichier .env à partir de .env.example (s'il n'existe pas déjà)
    2. Lance `bun install` pour installer les dépendances
    3. Lance `bun run db:generate` pour générer le Prisma Client
    4. Affiche les prochaines étapes

.EXAMPLE
    .\setup.ps1
#>

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  MyBoard — Setup" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

# 1. Crée .env si absent
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "[1/3] .env créé à partir de .env.example" -ForegroundColor Green
    } else {
        Write-Host "[1/3] ERREUR : .env.example introuvable. Crée .env manuellement avec DATABASE_URL=file:../library/library.db" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[1/3] .env déjà présent, skip" -ForegroundColor Green
}

# 2. Vérifie que Bun est installé
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "ERREUR : Bun n'est pas installé." -ForegroundColor Red
    Write-Host "Installe-le depuis https://bun.sh/ puis relance ce script."
    exit 1
}

# 3. Installe les dépendances
Write-Host "[2/3] Installation des dépendances (bun install)..." -ForegroundColor Cyan
bun install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR : bun install a échoué" -ForegroundColor Red
    exit $LASTEXITCODE
}

# 4. Génère le Prisma Client
Write-Host "[3/3] Génération du Prisma Client..." -ForegroundColor Cyan
bun run db:generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR : db:generate a échoué" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup terminé !" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines étapes :" -ForegroundColor White
Write-Host "  1. Lance l'app :  bun run dev" -ForegroundColor White
Write-Host "  2. Ouvre http://localhost:3000 dans ton navigateur" -ForegroundColor White
Write-Host ""
Write-Host "Pour re-créer les miniatures (optionnel) :" -ForegroundColor DarkGray
Write-Host "  Dans un AUTRE terminal PowerShell (pendant que bun run dev tourne) :" -ForegroundColor DarkGray
Write-Host "    curl.exe -X POST http://localhost:3000/api/seed" -ForegroundColor DarkGray
Write-Host "  (note : utilise curl.exe, pas curl — PowerShell aliases curl vers Invoke-WebRequest)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Pour re-télécharger les 300 images Safebooru (optionnel, ~6 min) :" -ForegroundColor DarkGray
Write-Host "  bun run fetch:safebooru" -ForegroundColor DarkGray
Write-Host "  bun run db:push   # ⚠️ RESET la DB" -ForegroundColor DarkGray
Write-Host "  curl.exe -X POST http://localhost:3000/api/seed" -ForegroundColor DarkGray
