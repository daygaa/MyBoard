// Zone ouverte par-dessus la page (note, description d'un tag, petites listes du gestionnaire, menu burger) : un
// clic en dehors la ferme, comme Échap, et ce clic ne fait rien d'autre. Un menu du clic droit ou une
// pop-in ouverts par-dessus gardent leurs clics (CTX-01).
// Options : `rightButton`, le clic droit ferme aussi (sans ouvrir de menu du clic droit) ; `ignore`, ce qui garde
// ses clics (sélecteur : la barre de titre pour le menu burger, retour T3, point AUT.3).

import { useEffect, type RefObject } from "react";

import { isContextMenuOpen } from "@/lib/contextMenu";
import { hasModalLayer } from "@/lib/escape";

type Options = { rightButton?: boolean; ignore?: string };

export function useOutsideClose(open: boolean, inside: RefObject<HTMLElement | null>[], close: () => void, { rightButton, ignore }: Options = {}) {
  useEffect(() => {
    if (!open) return;
    const swallow = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element;
      const button = e.button === 0 || (rightButton && e.button === 2);
      if (!button || isContextMenuOpen() || hasModalLayer() || inside.some((ref) => ref.current?.contains(target))) return;
      if (ignore && target.closest?.(ignore)) return;
      swallow(e);
      // Le clic qui suit (ou le menu du clic droit) ne fait rien non plus.
      window.addEventListener(e.button === 2 ? "contextmenu" : "click", swallow, { capture: true, once: true });
      close();
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  });
}
