// Menus du clic droit de la visionneuse (ordre et libellés de l'utilisateur) : image (CTX-06) et
// vidéo (CTX-07), ouverts sur le média lui-même ; nom du fichier (CTX-08). Raccourcis affichés :
// ceux de la visionneuse (lib/shortcuts.ts, touche F du plein écran, Espace). Les entrées sans
// action sont grisées jusqu'à leur phase (suppression : DEL).

import type { MediaItem } from "@/lib/api";
import type { MenuEntry } from "@/lib/contextMenu";
import { VIEWER_SHORTCUTS } from "@/lib/shortcuts";
import { isSilent, SPEEDS, speedLabel, usePlayer } from "@/stores/player";
import { useViewer } from "@/stores/viewer";
import { copyFile, copyName, copyPath, openFile, revealFile } from "./mediaActions";
import { printImage } from "./printMedia";

function fullscreenEntry(): MenuEntry {
  const { fullscreen, setFullscreen } = useViewer.getState();
  return { label: fullscreen ? "Quitter le plein écran" : "Plein écran", shortcut: "F", run: () => setFullscreen(!fullscreen) };
}

/** Paliers du zoom (ZOOM-10) : à venir. */
function zoomEntry(): MenuEntry {
  return { label: "Zoom", disabled: true, submenu: ["Défaut", "100 %", "150 %", "200 %", "400 %"].map((label) => ({ label })) };
}

const fileEntries = (item: MediaItem) => ({
  copy: { label: "Copier le fichier", shortcut: VIEWER_SHORTCUTS.copy.label, run: () => void copyFile(item) },
  path: { label: "Copier le chemin du fichier", run: () => copyPath(item) },
  open: { label: "Ouvrir avec l'application par défaut", shortcut: VIEWER_SHORTCUTS.open.label, run: () => openFile(item) },
  reveal: { label: "Afficher dans l'explorateur de fichiers", shortcut: VIEWER_SHORTCUTS.reveal.label, run: () => revealFile(item) },
  remove: { label: "Supprimer de la bibliothèque…", danger: true },
});

export function imageMenu(item: MediaItem): MenuEntry[] {
  const file = fileEntries(item);
  return [
    file.copy,
    { label: "Copier l'image" },
    "separator",
    fullscreenEntry(),
    zoomEntry(),
    "separator",
    file.path,
    file.open,
    file.reveal,
    { label: "Imprimer", shortcut: VIEWER_SHORTCUTS.print.label, run: () => void printImage(item) },
    { label: "Utiliser comme fond d'écran du bureau…" },
    "separator",
    file.remove,
  ];
}

/** Toujours à l'image de la barre de lecture au moment du clic droit. */
export function videoMenu(item: MediaItem, video: HTMLVideoElement): MenuEntry[] {
  const player = usePlayer.getState();
  const file = fileEntries(item);
  return [
    { label: video.paused ? "Lire" : "Pause", shortcut: "Espace", run: () => void (video.paused ? video.play() : video.pause()) },
    { label: isSilent(player) ? "Rétablir le son" : "Couper le son", run: player.toggleSound },
    { label: "Lecture en boucle", checked: player.loop, run: () => player.setLoop(!player.loop) },
    {
      label: "Vitesse",
      submenu: [...SPEEDS].reverse().map((speed) => ({ label: speedLabel(speed), checked: speed === player.speed, run: () => player.setSpeed(speed) })),
    },
    fullscreenEntry(),
    zoomEntry(),
    "separator",
    file.copy,
    { label: "Enregistrer une capture d'écran…" },
    file.path,
    file.open,
    file.reveal,
    "separator",
    file.remove,
  ];
}

export function fileNameMenu(item: MediaItem): MenuEntry[] {
  return [
    { label: "Copier le nom", run: () => copyName(item) },
    { label: "Copier le chemin du fichier", run: () => copyPath(item) },
    { label: "Afficher dans l'explorateur de fichiers", shortcut: VIEWER_SHORTCUTS.reveal.label, run: () => revealFile(item) },
  ];
}
