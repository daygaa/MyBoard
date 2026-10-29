// Une ligne de noms qui n'en coupe jamais un (retouches de R3, 29/10) : `head` (le tag principal) toujours
// affiché, puis autant de noms entiers que la largeur le permet, et `more(n)` (« … + N », ou « … ») pour ceux
// qui ne tiennent pas ; la bulle donne alors la liste complète. Ligne de groupe de synonymes et aperçu du
// formulaire.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type FitItem = { key: string; node: ReactNode };

type Props = {
  head: ReactNode;
  items: FitItem[];
  more: (hidden: number) => ReactNode;
  /** Bulle quand des noms sont cachés. */
  title: string;
  className?: string;
};

/** Séparateur entre deux noms. */
const DOT = <span className="px-1.5 text-muted-foreground">·</span>;

export function FitLine({ head, items, more, title, className }: Props) {
  const lineRef = useRef<HTMLSpanElement>(null);
  const moreRef = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState({ shown: items.length, left: 0 });

  // Mesure avant chaque affichage : tous les noms restent à leur place (ceux en trop invisibles), « … + N »
  // se pose juste après le dernier nom entier ; sa largeur réduit la place des noms quand il le faut.
  const measure = useCallback(() => {
    const line = lineRef.current;
    if (!line) return;
    const width = line.clientWidth;
    const start = line.getBoundingClientRect().left;
    const cells = [...line.querySelectorAll<HTMLElement>(":scope > [data-cellule]")];
    const right = (el: Element) => el.getBoundingClientRect().right - start;
    let shown = cells.length;
    if (shown > 0 && right(cells[shown - 1]) > width + 0.5) {
      const room = width - (moreRef.current?.offsetWidth ?? 0);
      shown = 0;
      while (shown < cells.length && right(cells[shown]) <= room + 0.5) shown++;
    }
    const last = shown > 0 ? cells[shown - 1] : line.querySelector(":scope > [data-tete]");
    const left = last ? right(last) : 0;
    setFit((f) => (f.shown === shown && f.left === left ? f : { shown, left }));
  }, []);
  useLayoutEffect(measure);
  useEffect(() => {
    const line = lineRef.current;
    if (!line) return;
    const observer = new ResizeObserver(measure);
    observer.observe(line);
    return () => observer.disconnect();
  }, [measure]);

  const hidden = items.length - Math.min(fit.shown, items.length);
  return (
    <span ref={lineRef} title={hidden > 0 ? title : undefined} className={cn("relative flex min-w-0 items-center overflow-hidden whitespace-nowrap", className)}>
      <span data-tete className="flex min-w-0 shrink-0 items-center">
        {head}
      </span>
      {items.map((item, i) => (
        <span key={item.key} data-cellule className={cn("flex shrink-0 items-center", i >= fit.shown && "invisible")}>
          {i > 0 && DOT}
          {item.node}
        </span>
      ))}
      <span ref={moreRef} style={{ left: fit.left }} className={cn("absolute top-1/2 -translate-y-1/2 pl-1.5 text-muted-foreground", hidden === 0 && "invisible")}>
        {more(Math.max(hidden, 1))}
      </span>
    </span>
  );
}
