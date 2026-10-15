// Menus du clic droit de la visionneuse (ordre et libellés de l'utilisateur) : image (CTX-06) et
// vidéo (CTX-07), ouverts sur le média lui-même ; nom du fichier (CTX-08). Raccourcis affichés :
// ceux de la visionneuse (lib/shortcuts.ts, touche F du plein écran, Espace). Les entrées sans
// action sont grisées jusqu'à leur phase (suppression : DEL).

import type { MediaItem } from "@/lib/api";
import type { MenuEntry } from "@/lib/contextMenu";
import { VIEWER_SHORTCUTS } from "@/lib/shortcuts";
import { isSilent, SPEEDS, speedLabel, usePlayer } from "@/stores/player";
import { useViewer } from "@/stores/viewer";
import { copyFile, copyImage, copyName, copyPath, openFile, revealFile, saveFrame, setWallpaper } from "./mediaActions";
import { printImage } from "./printMedia";

function fullscreenEntry(): MenuEntry {
  const { fullscreen, setFullscreen } = useViewer.getState();
  return { label: fullscreen ? "Quitter le plein écran" : "Plein écran", shortcut: "F", run: () => setFullscreen(!fullscreen) };
}

/** Commandes du zoom de la visionneuse (useZoom). */
export type ZoomControls = { zoomTo: (scale: number | "fit") => void; fitIsFullSize: boolean };

/** Paliers du zoom : « Défaut » (ajusté, ou 100 % pour une image plus petite que la zone) ; 100 %
 *  grisé quand le défaut l'est déjà. */
function zoomEntry(zoom: ZoomControls): MenuEntry {
  const step = (label: string, scale: number) => ({ label, run: () => zoom.zoomTo(scale) });
  return {
    label: "Zoom",
    submenu: [
      { label: "Défaut", run: () => zoom.zoomTo("fit") },
      { ...step("100 %", 1), disabled: zoom.fitIsFullSize },
      step("150 %", 1.5),
      step("200 %", 2),
      step("400 %", 4),
    ],
  };
}

const fileEntries = (item: MediaItem) => ({
  copy: { label: "Copier le fichier", shortcut: VIEWER_SHORTCUTS.copy.label, run: () => void copyFile(item) },
  path: { label: "Copier le chemin du fichier", run: () => copyPath(item) },
  open: { label: "Ouvrir avec l'application par défaut", shortcut: VIEWER_SHORTCUTS.open.label, run: () => openFile(item) },
  reveal: { label: "Afficher dans l'explorateur de fichiers", shortcut: VIEWER_SHORTCUTS.reveal.label, run: () => revealFile(item) },
  remove: { label: "Supprimer de la bibliothèque…", danger: true },
});

export function imageMenu(item: MediaItem, zoom: ZoomControls): MenuEntry[] {
  const file = fileEntries(item);
  return [
    file.copy,
    { label: "Copier l'image", run: () => copyImage(item) },
    "separator",
    fullscreenEntry(),
    zoomEntry(zoom),
    "separator",
    file.path,
    file.open,
    file.reveal,
    { label: "Imprimer", shortcut: VIEWER_SHORTCUTS.print.label, run: () => void printImage(item) },
    {
      label: "Utiliser comme fond d'écran du bureau…",
      confirm: { title: "Utiliser comme fond d'écran ?", message: "Cette image remplacera le fond d'écran actuel du bureau de Windows." },
      run: () => setWallpaper(item),
    },
    "separator",
    file.remove,
  ];
}

/** Toujours à l'image de la barre de lecture au moment du clic droit. */
export function videoMenu(item: MediaItem, video: HTMLVideoElement, zoom: ZoomControls): MenuEntry[] {
  const player = usePlayer.getState();
  const file = fileEntries(item);
  const time = video.currentTime;
  return [
    { label: video.paused ? "Lire" : "Pause", shortcut: "Espace", run: () => void (video.paused ? video.play() : video.pause()) },
    { label: isSilent(player) ? "Rétablir le son" : "Couper le son", run: player.toggleSound },
    { label: "Lecture en boucle", checked: player.loop, run: () => player.setLoop(!player.loop) },
    {
      label: "Vitesse",
      submenu: [...SPEEDS].reverse().map((speed) => ({ label: speedLabel(speed), checked: speed === player.speed, run: () => player.setSpeed(speed) })),
    },
    fullscreenEntry(),
    zoomEntry(zoom),
    "separator",
    file.copy,
    // L'image affichée au moment du clic droit.
    { label: "Enregistrer une capture d'écran…", run: () => saveFrame(item, time) },
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
