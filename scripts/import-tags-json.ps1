# Import de tags depuis des fichiers JSON (DEV-01) — outil de test, hors version finale.
#
# Pour chaque ABC.json du dossier (et de ses sous-dossiers), les tags sont ajoutés au média
# ABC.* de la bibliothèque. Relancer ne crée ni doublon ni compteur faux.
#
# Exemples (depuis le Workspace) :
#   .\scripts\import-tags-json.ps1 -Dossier "C:\...\BooruScrap - 3k demo" -Donnees "$env:LOCALAPPDATA\MyBoard-test\booru"
#   $env:MYBOARD_DATA_DIR = "$env:LOCALAPPDATA\MyBoard-test\booru"; .\scripts\import-tags-json.ps1 -Dossier "C:\..."
# Le dossier de données doit être indiqué (paramètre -Donnees ou variable MYBOARD_DATA_DIR) :
# la vraie bibliothèque n'est jamais choisie par défaut.

param(
    [Parameter(Mandatory = $true)] [string] $Dossier,
    [string] $Donnees = $env:MYBOARD_DATA_DIR
)

if (-not $Donnees) {
    Write-Error "Indiquez la bibliothèque à modifier : -Donnees `"<dossier de données>`" (ou la variable MYBOARD_DATA_DIR)."
    exit 1
}
if (-not (Test-Path -LiteralPath $Dossier)) {
    Write-Error "Dossier introuvable : $Dossier"
    exit 1
}

$cargo = Join-Path $env:USERPROFILE ".cargo\bin\cargo.exe"
Push-Location (Join-Path $PSScriptRoot "..\src-tauri")
try {
    & $cargo run --release --quiet --example import_tags_json -- $Donnees $Dossier
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
