// Grand aperçu d'une vignette (LIB-09, LIB-16) : demandé seulement si la vignette reste visible
// PREVIEW_DELAY_MS, annulé si elle sort de l'écran avant. `size` : taille voulue, ou `null` (pas
// d'aperçu). Renvoie `true` quand il est prêt.

import { useEffect, type RefObject } from "react";

import type { PreviewSize } from "@/lib/api";
import { PREVIEW_DELAY_MS } from "@/lib/grid";
import { cancelPreview, usePreviewReady, usePreviews, wantPreview } from "@/stores/previews";

export function usePreview(ref: RefObject<HTMLElement | null>, id: number, size: PreviewSize | null): boolean {
  const ready = usePreviewReady(id, size ?? 640) && size !== null;
  // Fichiers revus : nouvelle demande des aperçus pas encore prêts.
  const retry = usePreviews((s) => s.retry);

  useEffect(() => {
    const el = ref.current;
    if (size === null || ready || !el) return;
    const key = { id, size };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let requested = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        timer = setTimeout(() => {
          requested = true;
          wantPreview(key);
        }, PREVIEW_DELAY_MS);
      } else {
        clearTimeout(timer);
        if (requested) cancelPreview(key);
        requested = false;
      }
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      if (requested) cancelPreview(key);
    };
  }, [ref, id, size, ready, retry]);

  return ready;
}
