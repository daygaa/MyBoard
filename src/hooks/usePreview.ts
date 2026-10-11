// Grand aperçu d'une vignette (LIB-09) : demandé seulement si la vignette reste visible
// PREVIEW_DELAY_MS, annulé si elle sort de l'écran avant. Renvoie `true` quand il est prêt.

import { useEffect, type RefObject } from "react";

import { PREVIEW_DELAY_MS } from "@/lib/grid";
import { cancelPreview, usePreviews, wantPreview } from "@/stores/previews";

export function usePreview(ref: RefObject<HTMLElement | null>, id: number, enabled: boolean): boolean {
  const ready = usePreviews((s) => s.ready[id] === true);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || ready || !el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let requested = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        timer = setTimeout(() => {
          requested = true;
          wantPreview(id);
        }, PREVIEW_DELAY_MS);
      } else {
        clearTimeout(timer);
        if (requested) cancelPreview(id);
        requested = false;
      }
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
      if (requested) cancelPreview(id);
    };
  }, [ref, id, enabled, ready]);

  return ready;
}
