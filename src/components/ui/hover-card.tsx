// Bulle de MyBoard (et non une bulle Windows) : posée par-dessus tout, près de son élément, sans jamais sortir de
// la fenêtre ; elle ne prend pas la souris (le survol reste sur l'élément). Zone de l'icône « = » des suggestions
// et bulle des pastilles de la recherche (retour T3, points TAGM-15.26 et TAGM-15.27).

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

/** Marge avec le bord de la fenêtre et écart avec l'élément. */
const EDGE = 8;
const GAP = 6;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

/** `place` : « side » à droite de `anchor` (à gauche s'il n'y a pas la place), « below » dessous (dessus s'il n'y
 *  a pas la place). */
export function HoverCard({ anchor, place, zone, children }: { anchor: DOMRect; place: "side" | "below"; zone: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  // Mesurée avant d'être montrée : placée d'après sa taille.
  useLayoutEffect(() => {
    const card = ref.current;
    if (!card) return;
    const { width, height } = card.getBoundingClientRect();
    const right = window.innerWidth - EDGE - width;
    const bottom = window.innerHeight - EDGE - height;
    if (place === "side") {
      const left = anchor.right + GAP <= right ? anchor.right + GAP : anchor.left - GAP - width;
      setPos({ left: clamp(left, EDGE, right), top: clamp(anchor.top, EDGE, bottom) });
    } else {
      const top = anchor.bottom + GAP <= bottom ? anchor.bottom + GAP : anchor.top - GAP - height;
      setPos({ left: clamp(anchor.left, EDGE, right), top: clamp(top, EDGE, bottom) });
    }
  }, [anchor, place]);
  return createPortal(
    <div
      ref={ref}
      data-zone={zone}
      className={cn(
        "pointer-events-none fixed z-[300] max-w-80 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-foreground shadow-xl",
        !pos && "invisible",
      )}
      style={pos ?? { left: 0, top: 0 }}
    >
      {children}
    </div>,
    document.body,
  );
}
