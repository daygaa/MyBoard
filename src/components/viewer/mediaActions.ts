// Actions sur le fichier d'un média, communes à la barre du bas de la visionneuse (VIEW-13,
// VIEW-24, VIEW-35) et aux menus du clic droit (vignette CTX-05, visionneuse CTX-06 à CTX-08).
// Échec : message d'erreur avec le code Windows (VIEW-28 dans la visionneuse, pop-in CTX-19
// ailleurs), curseur d'attente pendant l'appel (externalOpen.ts).

import { api, type MediaItem } from "@/lib/api";
import { useViewer } from "@/stores/viewer";
import { runExternal } from "./externalOpen";

/** Le fichier lui-même dans le presse-papiers ; « Copié » s'affiche sur le bouton (VIEW-35). */
export async function copyFile(item: MediaItem) {
  if (await runExternal("Copier le fichier", () => api.copyMedia(item.id))) useViewer.getState().markCopied(item.id);
}

export function revealFile(item: MediaItem) {
  void runExternal("Ouvrir dans l'explorateur", () => api.revealMedia(item.id));
}

export function openFile(item: MediaItem) {
  void runExternal("Ouvrir avec l'application par défaut", () => api.openMedia(item.id));
}

/** Chemin complet du fichier, en texte, dans le presse-papiers. */
export function copyPath(item: MediaItem) {
  void runExternal("Copier le chemin du fichier", async () => {
    const detail = await api.mediaDetail(item.id);
    if (!detail) throw new Error("Média introuvable dans la bibliothèque.");
    await api.writeClipboardText(detail.path);
  });
}

/** Nom du fichier (avec son extension), en texte, dans le presse-papiers (CTX-08). */
export function copyName(item: MediaItem) {
  void runExternal("Copier le nom", () => api.writeClipboardText(item.fileName));
}
