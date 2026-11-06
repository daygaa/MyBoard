// Menus du clic droit de la visionneuse (ordre et libellés de l'utilisateur) : image (CTX-06) et
// vidéo (CTX-07), ouverts sur le média lui-même ; nom du fichier (CTX-08). Vidéo : « Sous-titres ▸ » (VIEW-52) ;
// GIF lu par le lecteur vidéo (VIEW-54) : menu de la vidéo sans le son, avec « Copier l'image » (celle affichée). Raccourcis affichés :
// ceux de la visionneuse (lib/shortcuts.ts, touche F du plein écran, Espace). Suppression : pop-in
// avec sa case (DEL-04), puis le média suivant (VIEW-14).

import { deleteEntry } from "@/components/library/DeleteDialog";
import type { MediaItem } from "@/lib/api";
import type { MenuEntry } from "@/lib/contextMenu";
import { VIDEO_SHORTCUTS, VIEWER_SHORTCUTS, ZOOM_SHORTCUTS } from "@/lib/shortcuts";
import { isSilent, SPEEDS, speedLabel, usePlayer } from "@/stores/player";
import { useViewer } from "@/stores/viewer";
import type { GifControls } from "./VideoControls";
import type { Subtitles } from "./Subtitles";
import { copyFile, copyGifFrame, copyImage, copyName, copyPath, deleteShown, openFile, revealFile, saveFrame, setWallpaper } from "./mediaActions";
import { printImage } from "./printMedia";

function fullscreenEntry(): MenuEntry {
  const { fullscreen, setFullscreen } = useViewer.getState();
  return { label: fullscreen ? "Quitter le plein écran" : "Plein écran", shortcut: "F", run: () => setFullscreen(!fullscreen) };
}

/** Commandes du zoom de la visionneuse (useZoom). */
export type ZoomControls = { zoomTo: (scale: number | "fit" | "adapt") => void; fitIsFullSize: boolean; adaptDisabled: boolean };

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

/** « Adapter à l'écran » (ZOOM-12), juste sous « Zoom ▸ » : grisé s'il est impossible, pareil que
 *  « Défaut », ou déjà fait. */
function adaptEntry(zoom: ZoomControls): MenuEntry {
  return { label: "Adapter à l'écran", shortcut: ZOOM_SHORTCUTS.adapt.label, disabled: zoom.adaptDisabled, run: () => zoom.zoomTo("adapt") };
}

const fileEntries = (item: MediaItem) => ({
  copy: { label: "Copier le fichier", shortcut: VIEWER_SHORTCUTS.copy.label, run: () => void copyFile(item) },
  path: { label: "Copier le chemin du fichier", run: () => copyPath(item) },
  open: { label: "Ouvrir avec l'application par défaut", shortcut: VIEWER_SHORTCUTS.open.label, run: () => openFile(item) },
  reveal: { label: "Afficher dans l'explorateur de fichiers", shortcut: VIEWER_SHORTCUTS.reveal.label, run: () => revealFile(item) },
  remove: deleteEntry({ count: 1, name: item.fileName }, (deleteFiles) => void deleteShown(item, deleteFiles)),
});

export function imageMenu(item: MediaItem, zoom: ZoomControls): MenuEntry[] {
  const file = fileEntries(item);
  return [
    file.copy,
    { label: "Copier l'image", run: () => copyImage(item) },
    "separator",
    fullscreenEntry(),
    zoomEntry(zoom),
    adaptEntry(zoom),
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

/** Pistes de sous-titres (VIEW-52) : « Désactivés », chaque piste, puis « Importer un fichier… » (VIS.1.4) ;
 *  grisé pour un GIF. */
function subtitlesEntry(subs: Subtitles): MenuEntry {
  return {
    label: "Sous-titres",
    shortcut: VIDEO_SHORTCUTS.subtitles.label,
    disabled: !subs.enabled,
    submenu: [
      { label: "Désactivés", checked: subs.active === null, run: () => subs.select(null) },
      ...subs.tracks.map((t) => ({ label: t.label, checked: subs.active === t.key, run: () => subs.select(t.key) })),
      "separator",
      { label: "Importer un fichier…", run: subs.importFile },
      ...(subs.activeImported ? [{ label: "Retirer le fichier importé", run: subs.removeImported }] : []),
    ],
  };
}

/** Toujours à l'image de la barre de lecture au moment du clic droit. */
export function videoMenu(item: MediaItem, video: HTMLVideoElement, zoom: ZoomControls, subs: Subtitles, gif?: GifControls): MenuEntry[] {
  const player = usePlayer.getState();
  const file = fileEntries(item);
  const time = video.currentTime;
  const loop = gif ? gif.loop : player.loop;
  const setLoop = gif ? gif.setLoop : player.setLoop;
  return [
    { label: video.paused ? "Lire" : "Pause", shortcut: "Espace", run: () => void (video.paused ? video.play() : video.pause()) },
    ...(gif ? [] : [{ label: isSilent(player) ? "Rétablir le son" : "Couper le son", shortcut: VIDEO_SHORTCUTS.mute.label, run: player.toggleSound }]),
    { label: "Lecture en boucle", shortcut: VIDEO_SHORTCUTS.loop.label, checked: loop, run: () => setLoop(!loop) },
    {
      label: "Vitesse",
      shortcut: `${VIDEO_SHORTCUTS.slower.label} / ${VIDEO_SHORTCUTS.faster.label}`,
      submenu: [...SPEEDS].reverse().map((speed) => ({ label: speedLabel(speed), checked: speed === player.speed, run: () => player.setSpeed(speed) })),
    },
    subtitlesEntry(subs),
    fullscreenEntry(),
    zoomEntry(zoom),
    adaptEntry(zoom),
    "separator",
    file.copy,
    ...(gif ? [{ label: "Copier l'image", run: () => copyGifFrame(item, time) }] : []),
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
