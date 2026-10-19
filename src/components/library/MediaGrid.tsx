// Grille virtualisée (D-008) : seules les lignes visibles, plus une petite marge,
// existent dans la page. N colonnes fixes (GRID-02) : les vignettes s'adaptent en largeur.
// Changer de densité ne recharge rien : c'est un simple calcul de taille.
// La page défile dans la zone sous la barre de titre (NAV-04, `lib/scroller`), pas la fenêtre.
// Mode sélection : rectangle de sélection (SEL-06) ; la page affichée est donnée à la sélection pour
// « Tout » (SEL-04) et Maj + clic (SEL-10).

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { useRectangleSelection } from "@/hooks/useRectangleSelection";
import { useScreen } from "@/hooks/useScreen";
import type { MediaItem } from "@/lib/api";
import { scroller } from "@/lib/scroller";
import { COMPACT_DENSITY, GRID_GAP, NAME_ONLY_TILE_INCHES, TILE_FULL_WIDTH, thumbSizeFor } from "@/lib/grid";
import { setSelectionPage, useSelection } from "@/stores/selection";
import { MediaTile } from "./MediaTile";

/** Largeur de la grille et sa position dans la zone qui défile, tenues à jour. */
function useGridBox(ref: React.RefObject<HTMLDivElement | null>) {
  const [box, setBox] = useState({ width: 0, top: 0 });
  const measure = () => {
    const el = ref.current;
    if (!el) return;
    const width = el.clientWidth;
    const area = scroller();
    const top = el.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop;
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

type Props = {
  items: MediaItem[];
  density: number;
  /** Position du premier média de la page dans tous les résultats, et taille des pages. */
  firstIndex: number;
  pageSize: number;
};

export function MediaGrid({ items, density, firstIndex, pageSize }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const rectangleRef = useRef<HTMLDivElement>(null);
  const { width, top } = useGridBox(ref);
  const tile = width > 0 ? (width - GRID_GAP * (density - 1)) / density : 0;
  const rowHeight = tile + GRID_GAP;
  const rowCount = Math.ceil(items.length / density);
  const compact = density >= COMPACT_DENSITY;
  const { pixelRatio, pxPerInch } = useScreen();
  // Miniature d'après la largeur réelle des vignettes (LIB-16) : densité, fenêtre et écran.
  const thumbSize = thumbSizeFor(tile * pixelRatio);
  // Vignettes de moins de ~2,2 cm à l'écran : nom seul, agrandi au survol (GRID-11).
  const nameOnly = tile > 0 && tile < NAME_ONLY_TILE_INCHES * pxPerInch;

  const selecting = useSelection((s) => s.active);
  const startRectangle = useRectangleSelection(ref, rectangleRef, { tile, density, items });
  useEffect(() => {
    setSelectionPage(items, density);
    return () => setSelectionPage([], density);
  }, [items, density]);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: scroller,
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
      data-nom-seul={nameOnly || undefined}
      onPointerDown={selecting ? startRectangle : undefined}
      className="relative w-full"
      style={
        {
          height: Math.max(0, rowCount * rowHeight - GRID_GAP),
          // Vignettes étroites : badges et infos réduits dans la même proportion (GRID-10).
          // Variable CSS héritée : les vignettes ne sont pas redessinées par React.
          "--tile-scale": tile > 0 ? Math.min(1, tile / TILE_FULL_WIDTH) : 1,
        } as CSSProperties
      }
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
            {items.slice(row.index * density, (row.index + 1) * density).map((item, col) => (
              <MediaTile
                key={item.id}
                item={item}
                index={firstIndex + row.index * density + col}
                pageSize={pageSize}
                compact={compact}
                thumbSize={thumbSize}
              />
            ))}
          </div>
        ))}
      <div ref={rectangleRef} data-zone="grille.rectangle" className="pointer-events-none absolute z-20 hidden rounded-sm border border-[#d9a94e] bg-[#d9a94e]/10" />
    </div>
  );
}
