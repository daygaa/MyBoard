# ffmpeg fourni avec MyBoard (IMP-49, D-070) : télécharge la version épinglée ci-dessous, vérifie son empreinte
# SHA-256, puis range ffmpeg.exe, ffprobe.exe, leurs bibliothèques (DLL), la licence et le lien vers le code source
# dans un dossier « ffmpeg » à côté de myboard.exe. ffmpeg n'est jamais dans Git (dépôt public ; GitHub refuse les
# fichiers de plus de 100 Mo). MyBoard prend d'abord le ffmpeg du PC s'il est complet, sinon cette copie.
#
# Exemples (depuis le Workspace) :
#   .\scripts\fetch-ffmpeg.ps1
#       -> src-tauri\target\release\ffmpeg (à côté de la version finale)
#   .\scripts\fetch-ffmpeg.ps1 -Destination "src-tauri\target\verif\release\ffmpeg"
#   .\scripts\fetch-ffmpeg.ps1 -Archive "C:\...\archive-deja-telechargee.zip"
# L'archive téléchargée est gardée dans src-tauri\target\ffmpeg-archive (pas retéléchargée ensuite).
# Si BtbN retire un jour cette version datée : choisir une version récente sur la page des versions, puis changer
# $Nom, $Publication et $Empreinte ci-dessous (l'empreinte est affichée sur la page de GitHub).

param(
    [string[]] $Destination = @("src-tauri\target\release\ffmpeg"),
    [string] $Archive = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"   # la barre de progression ralentit beaucoup le téléchargement

# Version épinglée : ffmpeg 8.1.3 (branche 8.1), variante « partagée » (ffmpeg et ffprobe partagent leurs DLL :
# environ 200 Mo au lieu de 331 Mo pour la variante statique, même vitesse et mêmes encodeurs, mesuré le 12/11).
$Publication = "autobuild-2026-11-11-12-39"
$Nom = "ffmpeg-n8.1.3-35-gf1acb0a266-win64-gpl-shared-8.1"
$Empreinte = "7098a8ad33754db0bc908b452dda45e424bc27f4b2afd0a896b658805d338abc"
$Depot = "https://github.com/FFmpeg-Builds/FFmpeg-Builds"   # ancien nom : github.com/BtbN/FFmpeg-Builds
$Commit = "f1acb0a2666c78d92688f4c3d2803a132f5590f6"
$Url = "$Depot/releases/download/$Publication/$Nom.zip"

$Workspace = Split-Path -Parent $PSScriptRoot
$Cache = Join-Path $Workspace "src-tauri\target\ffmpeg-archive"
New-Item -ItemType Directory -Force -Path $Cache | Out-Null

function Get-Sha256([string] $Path) { (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant() }

# 1. L'archive : celle indiquée, sinon celle du cache, sinon téléchargée.
if ($Archive) {
    $Zip = (Resolve-Path -LiteralPath $Archive).Path
} else {
    $Zip = Join-Path $Cache "$Nom.zip"
    if (-not (Test-Path -LiteralPath $Zip)) {
        Write-Host "Téléchargement de $Nom.zip (environ 86 Mo)…"
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $Part = "$Zip.part"
        try {
            Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Part
        } catch {
            Write-Error "Téléchargement impossible ($Url) : $($_.Exception.Message). Si la version a été retirée, voir l'en-tête du script."
        }
        if ((Get-Sha256 $Part) -ne $Empreinte) {
            Remove-Item -LiteralPath $Part
            Write-Error "Empreinte SHA-256 différente : archive refusée (rien n'a été installé)."
        }
        Move-Item -LiteralPath $Part -Destination $Zip
    }
}

# 2. Empreinte vérifiée à chaque fois (une archive du cache ou indiquée peut être abîmée ou être une autre).
$Lue = Get-Sha256 $Zip
if ($Lue -ne $Empreinte) {
    Write-Error "Empreinte SHA-256 différente ($Lue au lieu de $Empreinte) : archive refusée (rien n'a été installé)."
}
Write-Host "Empreinte SHA-256 vérifiée : $Empreinte"

# 3. Décompression dans le cache (dossier refait à chaque fois).
$Extrait = Join-Path $Cache "extrait"
if (Test-Path -LiteralPath $Extrait) { Remove-Item -LiteralPath $Extrait -Recurse -Force }
Expand-Archive -LiteralPath $Zip -DestinationPath $Extrait
$Bin = Join-Path $Extrait "$Nom\bin"
$Licence = Join-Path $Extrait "$Nom\LICENSE.txt"
# ffplay (lecteur) n'est pas utilisé par MyBoard : pas copié.
$Fichiers = @(Get-ChildItem -LiteralPath $Bin -File | Where-Object { $_.Name -ne "ffplay.exe" })
if (-not ($Fichiers.Name -contains "ffmpeg.exe") -or -not ($Fichiers.Name -contains "ffprobe.exe")) {
    Write-Error "Archive inattendue : ffmpeg.exe ou ffprobe.exe manque dans $Bin."
}

$Source = @"
ffmpeg fourni avec MyBoard
==========================

Version : $Nom (ffmpeg 8.1.3, commit $Commit)
Compilation : $Depot (publication $Publication, variante « gpl-shared »)
Archive : $Url
Empreinte SHA-256 de l'archive : $Empreinte

Licence : ffmpeg est compilé ici avec des bibliothèques sous licence GPL (x264, x265…) ; l'ensemble est distribué sous
la licence GNU GPL version 3 (texte complet : LICENSE.txt, dans ce dossier).

Code source de cette version exacte :
- ffmpeg : https://github.com/FFmpeg/FFmpeg/tree/$Commit
  (dépôt officiel : https://git.ffmpeg.org/gitweb/ffmpeg.git/commit/$Commit)
- scripts de compilation, avec la version de chaque bibliothèque utilisée : $Depot/tree/$Publication

MyBoard lance ffmpeg et ffprobe seulement sur des fichiers du PC (aucune connexion réseau).
"@

# 4. Rangement : seuls les fichiers de ffmpeg sont remplacés dans chaque dossier « ffmpeg ».
foreach ($Dossier in $Destination) {
    $Cible = if ([IO.Path]::IsPathRooted($Dossier)) { $Dossier } else { Join-Path $Workspace $Dossier }
    New-Item -ItemType Directory -Force -Path $Cible | Out-Null
    foreach ($F in $Fichiers) { Copy-Item -LiteralPath $F.FullName -Destination (Join-Path $Cible $F.Name) -Force }
    Copy-Item -LiteralPath $Licence -Destination (Join-Path $Cible "LICENSE.txt") -Force
    [IO.File]::WriteAllText((Join-Path $Cible "SOURCE.txt"), ($Source -replace "`r?`n", "`r`n"), (New-Object Text.UTF8Encoding $true))
    $Taille = (Get-ChildItem -LiteralPath $Cible -File | Measure-Object Length -Sum).Sum / 1MB
    Write-Host ("ffmpeg rangé dans {0} ({1:N0} Mo)" -f $Cible, $Taille)
}
