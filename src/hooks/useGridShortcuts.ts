// Raccourcis de la grille : Ctrl + ← / → change de page (PAGE-02),
// Ctrl + molette change la densité comme dans l'explorateur Windows (GRID-04).

import { useEffect } from "react";

import { hasEscapeLayer } from "@/lib/escape";
import { useLibrary } from "@/stores/library";

/** Une encoche de molette vaut 100 ; les pavés tactiles envoient de petits pas cumulés. */
const WHEEL_STEP = 100;

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
}

export function useGridShortcuts(pageCount: number) {
  useEffect(() => {
    let wheel = 0;

    const onKey = (e: KeyboardEvent) => {
      // Visionneuse ou dialogue ouvert par-dessus : la grille ne réagit pas.
      if (!(e.ctrlKey || e.metaKey) || isTyping(e.target) || hasEscapeLayer()) return;
      const { page, setPage } = useLibrary.getState();
      if (e.key === "ArrowLeft" && page > 1) {
        e.preventDefault();
        setPage(page - 1);
      } else if (e.key === "ArrowRight" && page < pageCount) {
        e.preventDefault();
        setPage(page + 1);
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || hasEscapeLayer()) return;
      e.preventDefault(); // pas de zoom de la page
      wheel += e.deltaY;
      const steps = Math.trunc(wheel / WHEEL_STEP);
      if (steps === 0) return;
      wheel -= steps * WHEEL_STEP;
      // Molette vers le haut = vignettes plus grandes = moins de colonnes.
      const { density, setDensity } = useLibrary.getState();
      setDensity(density + steps);
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    };
  }, [pageCount]);
}
