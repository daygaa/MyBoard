// Navigation de la visionneuse dans TOUS les résultats (VIEW-04) : les pages voisines sont lues
// avec la même requête que la grille (même cache), et les voisins (image, tags) sont préchargés :
// 2 après et 1 avant (VIEW-53), images gardées dans imageCache.ts. Pendant une rafale (burst.ts) :
// miniatures des médias suivants chargées d'avance, copies des seules images légères.

import { useEffect, type RefObject } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { api, THUMB, thumbUrl, type ListPage, type MediaItem } from "@/lib/api";
import { previewReady } from "@/stores/previews";
import { useViewer, type ListBase } from "@/stores/viewer";
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
/** Rafale : miniatures préparées devant, dans le sens du défilement (retour AUT.7.5 : la moitié des médias
 *  traversés restaient vides, leur miniature arrivait trop tard). */
export const THUMBS_AHEAD = 10;
/** Miniatures préparées gardées (décodées) : celles devant et quelques-unes derrière. */
const THUMBS_KEPT = 2 * THUMBS_AHEAD;

/** Miniature montrée par la visionneuse en attendant mieux : aperçu 640 px s'il est prêt, sinon 320 px. */
export const stageThumb = (item: MediaItem, preview: boolean) => thumbUrl(item.hash, preview ? "preview" : "normal");

const thumbs = new Map<string, HTMLImageElement>();

/** Miniatures lues et décodées d'avance : affichées dès la première image du média. */
function preloadThumbs(items: MediaItem[]) {
  for (const item of items) {
    if (item.thumbStatus !== THUMB.ready) continue;
    const url = stageThumb(item, previewReady(item.id, 640));
    const old = thumbs.get(url);
    thumbs.delete(url);
    if (old) {
      thumbs.set(url, old); // la plus récente en dernier
      continue;
    }
    const img = new Image();
    img.src = url;
    void img.decode().catch(() => {});
    thumbs.set(url, img);
  }
  for (const url of thumbs.keys()) {
    if (thumbs.size <= THUMBS_KEPT) break;
    thumbs.delete(url);
  }
}

/** Préchargement : images du média affiché et des voisins lues et décodées d'avance (imageCache.ts), et
 *  infos des voisins (tags…) lues d'avance pour que la barre du bas ait tout de suite sa bonne hauteur
 *  (VIEW-40). Rafale (`ahead` : médias suivants) : miniatures d'avance, copies des images légères ; ni infos
 *  (barre du bas mise à jour à l'arrêt), ni GIF convertis. */
function usePreload() {
  const queryClient = useQueryClient();
  return (current: MediaItem, neighbors: MediaItem[], ahead: MediaItem[] | null) => {
    if (ahead) {
      preloadThumbs([current, ...ahead]);
      warm([current, ...neighbors], true);
      return;
    }
    for (const item of neighbors) {
      void queryClient.ensureQueryData({ queryKey: ["media-detail", item.id], queryFn: () => api.mediaDetail(item.id) });
      // GIF voisins convertis d'avance pour le lecteur vidéo (VIEW-54).
      if (item.ext === "gif") void api.prepareGif(item.id).catch(() => {});
    }
    // Le média affiché d'abord : sa copie est son image nette (ImageStage), puis 2 après et 1 avant.
    warm([current, ...neighbors]);
  };
}

/** Nombre total de résultats, puis préchargement des voisins à chaque changement de média (rafale : allégé, et
 *  miniatures des médias suivants dans le sens `direction` ; à la fin de la rafale, préchargement normal). */
export function useNeighbors(base: ListBase, index: number, burst: boolean, direction: RefObject<number>) {
  const pageAt = usePageAt();
  const preload = usePreload();
  useEffect(() => {
    let cancelled = false;
    const { show, close } = useViewer.getState();
    void pageAt(base, index).then(async (page) => {
      if (cancelled) return;
      // Média revenu par l'historique, puis supprimé ou déplacé entre-temps : ce qui est à sa place, ou
      // fermeture s'il ne reste rien.
      if (page.total === 0) return close({ replace: true });
      const here = itemAt(page, index);
      if (here && here.id !== useViewer.getState().item?.id) show(index, here, page.total);
      if (page.total !== useViewer.getState().total) useViewer.setState({ total: page.total });
      const items = (offsets: number[]) =>
        Promise.all(
          offsets
            .map((d) => index + d)
            .filter((i) => i >= 0 && i < page.total)
            .map(async (i) => itemAt(await pageAt(base, i), i)),
        ).then((list) => list.filter((n): n is MediaItem => n !== undefined));
      const ahead = Array.from({ length: THUMBS_AHEAD }, (_, k) => (k + 1) * direction.current);
      const [neighbors, next] = await Promise.all([items(NEIGHBORS), burst ? items(ahead) : null]);
      if (!cancelled && here) preload(here, neighbors, next);
    });
    return () => {
      cancelled = true;
    };
    // `pageAt` et `preload` sont recréées à chaque affichage mais ne dépendent que du cache partagé.
  }, [base, index, burst]);
}

export function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
}
