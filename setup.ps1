<#
.SYNOPSIS
    Setup MyBoard : cree .env, installe les dependances, genere le Prisma Client.
    A lancer UNE FOIS apres avoir clone le repo.
#>

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Yellow
Write-Host "  MyBoard - Setup" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow
Write-Host ""

# 1. Cree .env si absent
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "[1/3] .env cree a partir de .env.example" -ForegroundColor Green
    } else {
        Write-Host "[1/3] ERREUR : .env.example introuvable." -ForegroundColor Red
        Write-Host "      Cree .env manuellement avec : DATABASE_URL=file:../library/library.db" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[1/3] .env deja present, skip" -ForegroundColor Green
}

# 2. Verifie que Bun est installé
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "ERREUR : Bun n'est pas installe." -ForegroundColor Red
    Write-Host "Installe-le depuis https://bun.sh/ puis relance ce script." -ForegroundColor Red
    exit 1
}

# 3. Installe les dependances
Write-Host "[2/3] Installation des dependances (bun install)..." -ForegroundColor Cyan
bun install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR : bun install a echoue" -ForegroundColor Red
    exit $LASTEXITCODE
}

# 4. Genere le Prisma Client
Write-Host "[3/3] Generation du Prisma Client..." -ForegroundColor Cyan
bun run db:generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR : db:generate a echoue" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup termine !" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines etapes :" -ForegroundColor White
Write-Host "  1. Lance l'app :  bun run dev" -ForegroundColor White
Write-Host "  2. Ouvre http://localhost:3000 dans ton navigateur" -ForegroundColor White
Write-Host ""
Write-Host "Pour re-creer les miniatures (optionnel) :" -ForegroundColor DarkGray
Write-Host "  Dans un AUTRE terminal PowerShell (pendant que dev tourne) :" -ForegroundColor DarkGray
Write-Host "    curl.exe -X POST http://localhost:3000/api/seed" -ForegroundColor DarkGray
Write-Host "  IMPORTANT : utilise curl.exe (pas curl)" -ForegroundColor DarkGray
Write-Host "  PowerShell aliases curl vers Invoke-WebRequest" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Pour re-telecharger les 300 images Safebooru (optionnel, ~6 min) :" -ForegroundColor DarkGray
Write-Host "  bun run fetch:safebooru" -ForegroundColor DarkGray
Write-Host "  bun run db:push   (RESET la DB)" -ForegroundColor DarkGray
Write-Host "  curl.exe -X POST http://localhost:3000/api/seed" -ForegroundColor DarkGray
