// Navigation de la visionneuse dans TOUS les résultats (VIEW-04) : les pages voisines sont lues
// avec la même requête que la grille (même cache), et les images voisines sont préchargées.

import { useQueryClient } from "@tanstack/react-query";

import { api, mediaUrl, type ListPage, type MediaItem } from "@/lib/api";
import type { ListBase } from "@/stores/viewer";

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

/** Garde en mémoire les images voisines déjà décodées : passer à la suivante est immédiat. */
const preloaded = new Map<number, HTMLImageElement>();

export function preload(items: MediaItem[]) {
  const keep = new Set(items.map((i) => i.id));
  for (const id of preloaded.keys()) if (!keep.has(id)) preloaded.delete(id);
  for (const item of items) {
    if (item.kind !== "image" || preloaded.has(item.id)) continue;
    const img = new Image();
    img.decoding = "async";
    img.src = mediaUrl(item);
    preloaded.set(item.id, img);
  }
}

export function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
}
