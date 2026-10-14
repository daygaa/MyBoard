// Barre du bas de la visionneuse (message d'erreur VIEW-28, infos et actions, tags) et son
// dépliage (VIEW-39) : jusqu'à 3 lignes de tags, la barre pousse le média ; « Afficher plus »
// la déplie vers le HAUT, par-dessus le média (sa place réservée ne change pas, le média ne
// rapetisse pas), jusqu'à la moitié de la visionneuse, avec défilement si besoin.
// Mesures transmises à la visionneuse : de combien la barre dépliée monte (`rise`, pour faire
// glisser flèches et boutons avec elle) et sa hauteur avec une seule ligne de tags (`oneLine`,
// place d'ancrage des flèches, VIEW-38), et sa hauteur repliée la plus grande (`anchor`, place
// d'ancrage des commandes flottantes, VIEW-42). En passant à un média dont les tags ne sont pas
// encore lus, la zone des tags garde sa hauteur jusqu'à leur arrivée (VIEW-40).

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

import type { MediaItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ErrorBanner } from "./ErrorBanner";
import { InfoBar } from "./InfoBar";
import { TagsArea } from "./TagsArea";

/** `anchor` : hauteur de la barre repliée la plus épaisse (3 lignes de tags + « Afficher plus »),
 *  place d'ancrage des commandes flottantes (VIEW-42). `height` : hauteur réservée à la barre,
 *  transmise avant l'affichage (mesurée après coup, elle arrivait une image en retard et les
 *  commandes sautaient pendant un défilement rapide). */
export type PanelMetrics = { rise: number; oneLine: number; anchor: number; height: number };

/** Hauteur minimale d'une ligne de tags (classe `min-h-6`). */
const ONE_LINE = 24;
/** Hauteur d'une pastille (texte 16 px + marges 4 px + bordure 2 px) et écart entre deux lignes
 *  (`gap-1.5`) : 3 lignes, tant qu'aucune pastille n'a été mesurée (média sans tag). */
const THREE_LINES = 3 * 22 + 2 * 6;
/** Ligne « Afficher plus » : texte `text-xs` (16 px) + écart `gap-1` (4 px). */
const PLUS_LINE = 20;
/** Durée du dépliage (même valeur que la transition des lignes de tags). */
const UNFOLD_MS = 200;

type Mode = "replie" | "deplie" | "repli";
/** `tags` : hauteur de la zone des tags, barre repliée (gardée pendant le chargement des tags
 *  d'un autre média, VIEW-40). */
type Geometry = { collapsed: number; oneLine: number; tags: number; lines3: number; full: number; maxTags: number };

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
  const [geo, setGeo] = useState<Geometry>({ collapsed: 0, oneLine: 0, tags: 0, lines3: THREE_LINES, full: 0, maxTags: 0 });

  // Nouveau média : barre repliée, avant l'affichage.
  useLayoutEffect(() => setMode("replie"), [item.id]);

  // Mesures, à chaque affichage (tags ajoutés ou retirés, largeur…) et quand la fenêtre change.
  const measure = () => {
    const bar = barRef.current;
    const box = boxRef.current;
    const area = areaRef.current;
    const info = area?.closest<HTMLElement>('[data-zone="visionneuse.barre"]');
    if (!bar || !box || !area || !info) return;
    const pill = box.querySelector<HTMLElement>('[data-zone="tag.pastille"]');
    const gap = parseFloat(getComputedStyle(box).rowGap) || 0;
    // Sans pastille (média sans tag, tags pas encore lus), la dernière mesure est gardée.
    const measured = pill ? 3 * pill.offsetHeight + 2 * gap : undefined;
    const viewer = bar.parentElement?.clientHeight ?? window.innerHeight;
    setGeo((g) => {
      // La hauteur repliée ne se mesure que repliée (dépliée, la place réservée reste la même).
      const folded = mode === "replie";
      const collapsed = folded ? bar.offsetHeight : g.collapsed;
      const lines3 = measured ?? g.lines3;
      const next: Geometry = {
        collapsed,
        oneLine: folded ? info.offsetHeight - area.offsetHeight + ONE_LINE : g.oneLine,
        tags: folded ? area.offsetHeight : g.tags,
        lines3,
        full: box.scrollHeight,
        // Barre dépliée : la moitié de la visionneuse au plus (pixels entiers : les flèches et le
        // bouton plein écran qui glissent avec elle restent nets).
        maxTags: Math.max(lines3, Math.floor(viewer / 2 - (collapsed - lines3))),
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

  const anchor = geo.oneLine ? geo.oneLine - ONE_LINE + geo.lines3 + PLUS_LINE : 0;

  useLayoutEffect(
    () => onMetrics({ rise, oneLine: geo.oneLine, anchor, height: geo.collapsed }),
    [rise, geo.oneLine, anchor, geo.collapsed, onMetrics],
  );

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
            pendingHeight={geo.tags}
            onLayout={measure}
          />
        </InfoBar>
      </div>
    </div>
  );
}
