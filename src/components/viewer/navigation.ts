// Navigation de la visionneuse dans TOUS les résultats (VIEW-04) : les pages voisines sont lues
// avec la même requête que la grille (même cache), et les voisins (image, tags) sont préchargés :
// 2 après et 1 avant (VIEW-53), images gardées dans imageCache.ts.

import { useQueryClient } from "@tanstack/react-query";

import { api, type ListPage, type MediaItem } from "@/lib/api";
import type { ListBase } from "@/stores/viewer";
import { warm } from "./imageCache";

/** Page de résultats contenant la position `index` (lue en cache si déjà chargée). */
export function usePageAt() {
  const queryClient = useQueryClient();
  return (base: ListBase, index: number): Promise<ListPage> => {
    const query = { ...base, page: Math.floor(index / base.pageSize) + 1 };
    return queryClient.ensureQueryData({ queryKey: ["media", query], queryFn: () => api.listMedia(query) });
  };
}

export function itemAt(page: ListPage, index: number): MediaItem | undefined {
  return page.items[index - (page.page - 1) * page.pageSize];
}

/** Voisins du média affiché, à préparer dans cet ordre : 2 après, puis 1 avant (VIEW-53 : on avance plus
 *  souvent qu'on ne recule). */
export const NEIGHBORS = [1, 2, -1];

/** Préchargement : images du média affiché et des voisins lues et décodées d'avance (imageCache.ts), et
 *  infos des voisins (tags…) lues d'avance pour que la barre du bas ait tout de suite sa bonne hauteur
 *  (VIEW-40). */
export function usePreload() {
  const queryClient = useQueryClient();
  return (current: MediaItem, neighbors: MediaItem[]) => {
    for (const item of neighbors) {
      void queryClient.ensureQueryData({ queryKey: ["media-detail", item.id], queryFn: () => api.mediaDetail(item.id) });
      // GIF voisins convertis d'avance pour le lecteur vidéo (VIEW-54).
      if (item.ext === "gif") void api.prepareGif(item.id).catch(() => {});
    }
    // Le média affiché d'abord : sa copie est son image nette (ImageStage), puis 2 après et 1 avant.
    warm([current, ...neighbors]);
  };
}

export function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
}
