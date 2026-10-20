// Zone ouverte par-dessus la page (note, description d'un tag, petites listes du gestionnaire) : un
// clic en dehors la ferme, comme Échap, et ce clic ne fait rien d'autre. Un menu du clic droit ou une
// pop-in ouverts par-dessus gardent leurs clics (CTX-01).

import { useEffect, type RefObject } from "react";

import { isContextMenuOpen } from "@/lib/contextMenu";
import { hasModalLayer } from "@/lib/escape";

export function useOutsideClose(open: boolean, inside: RefObject<HTMLElement | null>[], close: () => void) {
  useEffect(() => {
    if (!open) return;
    const swallow = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (e.button !== 0 || isContextMenuOpen() || hasModalLayer() || inside.some((ref) => ref.current?.contains(target))) return;
      swallow(e);
      window.addEventListener("click", swallow, { capture: true, once: true });
      close();
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  });
}
