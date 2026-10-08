<#
.SYNOPSIS
    Importe des tags depuis des fichiers JSON sidecar vers la DB MyBoard.

.DESCRIPTION
    Pour chaque fichier ABC.json trouvé dans le chemin spécifié, cherche un
    média ABC.jpg (ou .png, .webp...) dans la DB et attache les tags du JSON.
    Idempotent : si le tag est déjà attaché, il est ignoré silencieusement.

    Utile pour déboguer/tester quand on a importé des médias SANS leurs tags
    (ex: via drag-drop direct) et qu'on veut réinjecter les tags a posteriori.

.PARAMETER Path
    Chemin vers un dossier contenant des .json, OU un fichier .json unique.

.EXAMPLE
    .\scripts\import-tags-json.ps1 -Path "C:\Users\vous\Images\jsons_safebooru"

.EXAMPLE
    .\scripts\import-tags-json.ps1 -Path "C:\chemin\vers\ABC.json"

.EXAMPLE
    .\scripts\import-tags-json.ps1 "C:\dossier\jsons"  # Path est positionnel

.NOTES
    Prérequis : Bun installé (https://bun.sh) + dépendances installées
    (bun install). Le serveur dev n'a PAS besoin de tourner.

    Le script se connecte directement à library/library.db via Prisma.
    La variable d'environnement DATABASE_URL est lue depuis .env.
#>

param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$Path
)

$ErrorActionPreference = "Stop"

# Résout le chemin en absolu
$resolvedPath = (Resolve-Path -Path $Path -ErrorAction SilentlyContinue).Path
if (-not $resolvedPath) {
    Write-Error "Chemin introuvable : $Path"
    exit 1
}

# Vérifie qu'on est bien à la racine du projet (package.json présent)
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $projectRoot "package.json"))) {
    Write-Error "Ce script doit être lancé depuis la racine du projet MyBoard (dossier contenant package.json)."
    Write-Host "  Dossier actuel : $projectRoot"
    Write-Host "  Lancer : cd $projectRoot ; .\scripts\import-tags-json.ps1 -Path `"$Path`""
    exit 1
}

Write-Host "MyBoard — Import de tags depuis JSON sidecar" -ForegroundColor Yellow
Write-Host "  Chemin  : $resolvedPath"
Write-Host "  Projet  : $projectRoot"
Write-Host ""

# Lance le script Bun
Set-Location $projectRoot
bun run scripts/import-tags-json.ts $resolvedPath

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Import terminé avec succès." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Error "L'import a échoué (code $LASTEXITCODE)."
    exit $LASTEXITCODE
}
