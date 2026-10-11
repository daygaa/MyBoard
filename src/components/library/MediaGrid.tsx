// Grille virtualisée (D-008) : seules les lignes visibles, plus une petite marge,
// existent dans la page. N colonnes fixes (GRID-02) : les vignettes s'adaptent en largeur.
// Changer de densité ne recharge rien : c'est un simple calcul de taille.

import { useLayoutEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";

import type { MediaItem } from "@/lib/api";
import { COMPACT_DENSITY, GRID_GAP, PREVIEW_MAX_DENSITY, SMALL_THUMB_DENSITY } from "@/lib/grid";
import { MediaTile } from "./MediaTile";

/** Largeur de la grille et sa position dans la page, tenues à jour. */
function useGridBox(ref: React.RefObject<HTMLDivElement | null>) {
  const [box, setBox] = useState({ width: 0, top: 0 });
  const measure = () => {
    const el = ref.current;
    if (!el) return;
    const width = el.clientWidth;
    const top = el.getBoundingClientRect().top + window.scrollY;
    setBox((b) => (b.width === width && b.top === top ? b : { width, top }));
  };
  // À chaque affichage (ce qui est au-dessus de la grille a pu changer de hauteur)…
  useLayoutEffect(() => {
    measure();
  });
  // …et à chaque changement de taille de la fenêtre.
  useLayoutEffect(() => {
    const observer = new ResizeObserver(measure);
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]); // `measure` ne lit que la ref : inutile de la suivre
  return box;
}

export function MediaGrid({ items, density }: { items: MediaItem[]; density: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { width, top } = useGridBox(ref);
  const tile = width > 0 ? (width - GRID_GAP * (density - 1)) / density : 0;
  const rowHeight = tile + GRID_GAP;
  const rowCount = Math.ceil(items.length / density);
  const compact = density >= COMPACT_DENSITY;
  const small = density >= SMALL_THUMB_DENSITY;
  const preview = density <= PREVIEW_MAX_DENSITY;

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => rowHeight,
    overscan: 2,
    scrollMargin: top,
  });
  // Nouvelle densité ou nouvelle largeur : les hauteurs de ligne changent.
  useLayoutEffect(() => {
    virtualizer.measure();
  }, [virtualizer, rowHeight]);

  return (
    <div
      ref={ref}
      data-zone="grille.vignettes"
      className="relative w-full"
      style={{ height: Math.max(0, rowCount * rowHeight - GRID_GAP) }}
    >
      {tile > 0 &&
        virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.index}
            className="absolute top-0 left-0 grid w-full"
            style={{
              transform: `translateY(${row.index * rowHeight}px)`,
              gridTemplateColumns: `repeat(${density}, minmax(0, 1fr))`,
              gap: GRID_GAP,
            }}
          >
            {items.slice(row.index * density, (row.index + 1) * density).map((item) => (
              <MediaTile key={item.id} item={item} compact={compact} small={small} preview={preview} />
            ))}
          </div>
        ))}
    </div>
  );
}
