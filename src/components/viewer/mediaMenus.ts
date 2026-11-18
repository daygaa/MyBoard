// Menus du clic droit de la visionneuse (ordre et libellés de l'utilisateur) : image (CTX-06) et
// vidéo (CTX-07), ouverts sur le média lui-même ; nom du fichier (CTX-08). Vidéo : « Sous-titres ▸ » (VIEW-52) ;
// GIF lu par le lecteur vidéo (VIEW-54) : menu de la vidéo sans le son, avec « Copier l'image » (celle affichée). Raccourcis affichés :
// ceux de la visionneuse (lib/shortcuts.ts, touche F du plein écran, Espace). Suppression : pop-in
// avec sa case (DEL-04), puis le média suivant (VIEW-14). Cartes « illisible dans MyBoard » (VIEW-59, réponse Q32 A du
// 15/11) : même menu, entrées qui ont besoin de l'image ou de la lecture grisées (`zoom`, `playing` absents).

import { deleteEntry } from "@/components/library/DeleteDialog";
import { canRotate, type MediaItem } from "@/lib/api";
import type { MenuEntry } from "@/lib/contextMenu";
import { VIDEO_SHORTCUTS, VIEWER_SHORTCUTS, ZOOM_SHORTCUTS } from "@/lib/shortcuts";
import { isSilent, SPEEDS, speedLabel, usePlayer } from "@/stores/player";
import { useViewer } from "@/stores/viewer";
import type { GifControls } from "./VideoControls";
import type { Subtitles } from "./Subtitles";
import { copyFile, copyGifFrame, copyImage, copyName, copyPath, deleteShown, openFile, revealFile, saveFrame, setWallpaper } from "./mediaActions";
import { rotateMedia } from "./turns";
import { printImage } from "./printMedia";

function fullscreenEntry(): MenuEntry {
  const { fullscreen, setFullscreen } = useViewer.getState();
  return { label: fullscreen ? "Quitter le plein écran" : "Plein écran", shortcut: "F", run: () => setFullscreen(!fullscreen) };
}

/** Commandes du zoom de la visionneuse (useZoom). */
export type ZoomControls = { zoomTo: (scale: number | "fit" | "adapt") => void; fitIsFullSize: boolean; adaptDisabled: boolean };

/** Paliers du zoom : « Défaut » (ajusté, ou 100 % pour une image plus petite que la zone) ; 100 %
 *  grisé quand le défaut l'est déjà. Sans zoom (carte « illisible ») : grisé. */
function zoomEntry(zoom: ZoomControls | null): MenuEntry {
  if (!zoom) return { label: "Zoom", disabled: true, run: () => undefined };
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
function adaptEntry(zoom: ZoomControls | null): MenuEntry {
  return { label: "Adapter à l'écran", shortcut: ZOOM_SHORTCUTS.adapt.label, disabled: !zoom || zoom.adaptDisabled, run: () => zoom?.zoomTo("adapt") };
}

/** « Tourner à gauche / à droite » (VIEW-60, réponse Q25 A) : sous « Adapter à l'écran », dans la même section ;
 *  aussi dans le menu d'une vignette (sans raccourci). */
export function rotateEntries(item: MediaItem, shortcuts = true): MenuEntry[] {
  const off = !canRotate(item);
  return [
    { label: "Tourner à gauche", shortcut: shortcuts ? VIEWER_SHORTCUTS.rotateLeft.label : undefined, disabled: off, run: () => rotateMedia(item, false) },
    { label: "Tourner à droite", shortcut: shortcuts ? VIEWER_SHORTCUTS.rotateRight.label : undefined, disabled: off, run: () => rotateMedia(item, true) },
  ];
}

const fileEntries = (item: MediaItem) => ({
  copy: { label: "Copier le fichier", shortcut: VIEWER_SHORTCUTS.copy.label, run: () => void copyFile(item) },
  path: { label: "Copier le chemin du fichier", run: () => copyPath(item) },
  open: { label: "Ouvrir avec l'application par défaut", shortcut: VIEWER_SHORTCUTS.open.label, run: () => openFile(item) },
  reveal: { label: "Afficher dans l'explorateur de fichiers", shortcut: VIEWER_SHORTCUTS.reveal.label, run: () => revealFile(item) },
  remove: deleteEntry({ count: 1, name: item.fileName, gone: item.missing }, (deleteFiles) => void deleteShown(item, deleteFiles)),
});

/** `zoom` absent : image illisible dans MyBoard (VIEW-59). */
export function imageMenu(item: MediaItem, zoom: ZoomControls | null): MenuEntry[] {
  const file = fileEntries(item);
  const off = zoom === null;
  return [
    file.copy,
    { label: "Copier l'image", disabled: off, run: () => copyImage(item) },
    "separator",
    fullscreenEntry(),
    zoomEntry(zoom),
    adaptEntry(zoom),
    ...rotateEntries(item),
    "separator",
    file.path,
    file.open,
    file.reveal,
    { label: "Imprimer", shortcut: VIEWER_SHORTCUTS.print.label, disabled: off, run: () => void printImage(item) },
    {
      label: "Utiliser comme fond d'écran du bureau…",
      disabled: off,
      confirm: { title: "Utiliser comme fond d'écran ?", message: "Cette image remplacera le fond d'écran actuel du bureau de Windows." },
      run: () => setWallpaper(item),
    },
    "separator",
    file.remove,
  ];
}

/** Pistes de sous-titres (VIEW-52) : « Désactivés », chaque piste, puis « Importer un fichier… » (VIS.1.4) ;
 *  grisé pour un GIF. */
function subtitlesEntry(subs: Subtitles | null): MenuEntry {
  if (!subs) return { label: "Sous-titres", shortcut: VIDEO_SHORTCUTS.subtitles.label, disabled: true, run: () => undefined };
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

/** Vidéo en cours de lecture : son lecteur et ses commandes. */
export type Playing = { video: HTMLVideoElement; zoom: ZoomControls; subs: Subtitles; gif?: GifControls };

/** Toujours à l'image de la barre de lecture au moment du clic droit. `playing` absent : carte « illisible » (VIEW-59). */
export function videoMenu(item: MediaItem, playing: Playing | null): MenuEntry[] {
  const player = usePlayer.getState();
  const file = fileEntries(item);
  const video = playing?.video;
  const gif = playing?.gif;
  const off = !video;
  const time = video?.currentTime ?? 0;
  const loop = gif ? gif.loop : player.loop;
  const setLoop = gif ? gif.setLoop : player.setLoop;
  return [
    { label: !video || video.paused ? "Lire" : "Pause", shortcut: "Espace", disabled: off, run: () => void (video?.paused ? video.play() : video?.pause()) },
    ...(gif ? [] : [{ label: isSilent(player) ? "Rétablir le son" : "Couper le son", shortcut: VIDEO_SHORTCUTS.mute.label, disabled: off, run: player.toggleSound }]),
    { label: "Lecture en boucle", shortcut: VIDEO_SHORTCUTS.loop.label, checked: loop, disabled: off, run: () => setLoop(!loop) },
    {
      label: "Vitesse",
      shortcut: `${VIDEO_SHORTCUTS.slower.label} / ${VIDEO_SHORTCUTS.faster.label}`,
      disabled: off,
      submenu: [...SPEEDS].reverse().map((speed) => ({ label: speedLabel(speed), checked: speed === player.speed, run: () => player.setSpeed(speed) })),
    },
    subtitlesEntry(playing?.subs ?? null),
    fullscreenEntry(),
    zoomEntry(playing?.zoom ?? null),
    adaptEntry(playing?.zoom ?? null),
    ...rotateEntries(item),
    "separator",
    file.copy,
    ...(gif ? [{ label: "Copier l'image", run: () => copyGifFrame(item, time) }] : []),
    // L'image affichée au moment du clic droit.
    { label: "Enregistrer une capture d'écran…", disabled: off, run: () => saveFrame(item, time) },
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
