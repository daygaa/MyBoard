// Barre du bas de la visionneuse (message d'erreur VIEW-28, infos et actions, tags) et son
// dépliage (VIEW-39) : jusqu'à 3 lignes de tags, la barre pousse le média ; « Afficher plus »
// la déplie vers le HAUT, par-dessus le média (sa place réservée ne change pas, le média ne
// rapetisse pas), jusqu'à la moitié de la visionneuse, avec défilement si besoin.
// Mesures transmises à la visionneuse : de combien la barre dépliée monte (`rise`, pour faire
// glisser flèches et boutons avec elle) et sa hauteur avec une seule ligne de tags (`oneLine`,
// place d'ancrage des flèches, VIEW-38).

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

import type { MediaItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ErrorBanner } from "./ErrorBanner";
import { InfoBar } from "./InfoBar";
import { TagsArea } from "./TagsArea";

export type PanelMetrics = { rise: number; oneLine: number };

/** Hauteur minimale d'une ligne de tags (classe `min-h-6`). */
const ONE_LINE = 24;
/** Durée du dépliage (même valeur que la transition des lignes de tags). */
const UNFOLD_MS = 200;

type Mode = "replie" | "deplie" | "repli";
type Geometry = { collapsed: number; oneLine: number; lines3: number; full: number; maxTags: number };

type Props = {
  item: MediaItem;
  onSearch: (name: string) => void;
  barRef: RefObject<HTMLDivElement | null>;
  className?: string;
  onMetrics: (metrics: PanelMetrics) => void;
};

export function BottomPanel({ item, onSearch, barRef, className, onMetrics }: Props) {
  const [mode, setMode] = useState<Mode>("replie");
  const areaRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geometry>({ collapsed: 0, oneLine: 0, lines3: 3 * ONE_LINE, full: 0, maxTags: 0 });

  // Nouveau média : barre repliée.
  useEffect(() => setMode("replie"), [item.id]);

  // Mesures, à chaque affichage (tags ajoutés ou retirés, largeur…) et quand la fenêtre change.
  const measure = () => {
    const bar = barRef.current;
    const box = boxRef.current;
    const area = areaRef.current;
    const info = area?.closest<HTMLElement>('[data-zone="visionneuse.barre"]');
    if (!bar || !box || !area || !info) return;
    const pill = box.querySelector<HTMLElement>('[data-zone="tag.pastille"]');
    const gap = parseFloat(getComputedStyle(box).rowGap) || 0;
    const lines3 = 3 * (pill?.offsetHeight ?? ONE_LINE) + 2 * gap;
    const viewer = bar.parentElement?.clientHeight ?? window.innerHeight;
    setGeo((g) => {
      // La hauteur repliée ne se mesure que repliée (dépliée, la place réservée reste la même).
      const folded = mode === "replie";
      const collapsed = folded ? bar.offsetHeight : g.collapsed;
      const next: Geometry = {
        collapsed,
        oneLine: folded ? info.offsetHeight - area.offsetHeight + ONE_LINE : g.oneLine,
        lines3,
        full: box.scrollHeight,
        // Barre dépliée : la moitié de la visionneuse au plus.
        maxTags: Math.max(lines3, viewer / 2 - (collapsed - lines3)),
      };
      const same = (Object.keys(next) as (keyof Geometry)[]).every((k) => Math.abs(next[k] - g[k]) < 0.5);
      return same ? g : next;
    });
  };
  useLayoutEffect(measure);
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });

  const overflow = geo.full > geo.lines3 + 1;
  const open = mode !== "replie";
  const target = Math.min(geo.full, geo.maxTags);
  const rise = mode === "deplie" && overflow ? Math.max(0, target - geo.lines3) : 0;

  useLayoutEffect(() => onMetrics({ rise, oneLine: geo.oneLine }), [rise, geo.oneLine, onMetrics]);

  // Repli : une fois l'animation finie, la barre reprend sa place normale (sécurité si la fin
  // d'animation n'arrive pas).
  useEffect(() => {
    if (mode !== "repli") return;
    const timer = setTimeout(() => setMode("replie"), UNFOLD_MS + 150);
    return () => clearTimeout(timer);
  }, [mode]);

  return (
    <div ref={barRef} data-zone="visionneuse.bas" className={cn("relative", className)} style={{ height: open ? geo.collapsed : undefined }}>
      <div className={open ? "absolute inset-x-0 bottom-0" : undefined}>
        <ErrorBanner />
        <InfoBar item={item}>
          <TagsArea
            mediaId={item.id}
            onSearch={onSearch}
            expanded={mode === "deplie"}
            overflow={overflow}
            onToggle={() => setMode(mode === "deplie" ? "repli" : "deplie")}
            areaRef={areaRef}
            boxRef={boxRef}
            maxHeight={mode === "deplie" ? target : geo.lines3}
            scroll={mode === "deplie" && geo.full > geo.maxTags}
            onTransitionEnd={() => mode === "repli" && setMode("replie")}
          />
        </InfoBar>
      </div>
    </div>
  );
}
