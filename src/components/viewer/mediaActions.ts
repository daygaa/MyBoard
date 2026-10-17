// Actions sur le fichier d'un média, communes à la barre du bas de la visionneuse (VIEW-13,
// VIEW-24, VIEW-35) et aux menus du clic droit (vignette CTX-05, visionneuse CTX-06 à CTX-08).
// Échec : message d'erreur avec le code Windows (VIEW-28 dans la visionneuse, pop-in CTX-19
// ailleurs), curseur d'attente pendant l'appel (externalOpen.ts).

import { api, type MediaItem } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { deleteMedia } from "@/stores/deletion";
import { useViewer } from "@/stores/viewer";
import { runExternal } from "./externalOpen";
import { itemAt } from "./navigation";

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

/** L'image elle-même dans le presse-papiers, à coller dans Paint, une conversation… (CTX-06). */
export function copyImage(item: MediaItem) {
  void runExternal("Copier l'image", () => api.copyImage(item.id));
}

/** Fond d'écran du bureau de Windows (CTX-06, après confirmation). */
export function setWallpaper(item: MediaItem) {
  void runExternal("Utiliser comme fond d'écran", () => api.setWallpaper(item.id));
}

/** Image de la vidéo à `seconds`, pleine résolution, enregistrée en .jpg là où l'utilisateur le
 *  choisit (fenêtre « Enregistrer sous » de Windows, CTX-07). */
export function saveFrame(item: MediaItem, seconds: number) {
  // Date du jour dans le nom proposé : « JJ-MM-AA » (« / » est interdit dans un nom de fichier).
  const date = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }).replaceAll("/", "-");
  void runExternal("Enregistrer une capture d'écran", () => api.saveVideoFrame(item.id, seconds, date));
}

/** Supprime le média affiché par la visionneuse (DEL-04), puis montre le suivant : le précédent s'il
 *  était le dernier, fermeture s'il n'en reste aucun (VIEW-14, comme l'app Photos de Windows). */
export async function deleteShown(item: MediaItem, deleteFiles: boolean) {
  if (!(await deleteMedia([item.id], deleteFiles))) return;
  const { open, base, index } = useViewer.getState();
  if (!open || !base || useViewer.getState().item?.id !== item.id) return;
  const pageOf = (i: number) => {
    const query = { ...base, page: Math.floor(i / base.pageSize) + 1 };
    return queryClient.fetchQuery({ queryKey: ["media", query], queryFn: () => api.listMedia(query) });
  };
  let page = await pageOf(index);
  if (page.total === 0) return useViewer.getState().close();
  const next = Math.min(index, page.total - 1);
  if (next !== index) page = await pageOf(next);
  const found = itemAt(page, next);
  if (found) useViewer.getState().show(next, found, page.total);
}
