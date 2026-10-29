// Champ à pastilles limité à `maxLines` lignes de pastilles (retouches de R3, 29/10 : champ « Synonymes » du
// formulaire des groupes). Au-delà, « +N » au bout de la dernière ligne : une pastille qui n'y tient plus y
// passe, et la suivante prend sa place si elle tient ; on écrit alors sur une ligne à part, dessous, sans
// pastille. La souris qui approche déplie toutes les pastilles par-dessus ce qui est dessous, comme les termes
// de la recherche (SRCH-18, hooks/useUnfolded.ts) ; le clavier aussi, quand le curseur va près d'une pastille
// cachée.

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";

import { useUnfolded } from "@/hooks/useUnfolded";
import type { PillDoc, Sel } from "@/lib/pillText";
import { cn } from "@/lib/utils";

/** Hauteur d'une ligne du champ (`leading-7`) et d'une pastille. */
const LINE = 28;
const PILL = 22;

/** Souris sur un élément posé par-dessus (liste de suggestions, pop-in, menu) : rien ne se déplie. */
const covered = (target: EventTarget | null) =>
  !(target instanceof Element) || !target.closest("#root") || target.closest('[data-zone$=".suggestions"]') !== null;

const same = (a: Set<number>, b: Set<number>) => a.size === b.size && [...a].every((k) => b.has(k));

type Args<T> = {
  maxLines: number | undefined;
  doc: PillDoc<T>;
  sel: Sel;
  focused: boolean;
  /** Liste de suggestions ouverte : rien ne se déplie (elle passerait dessous). */
  listOpen: boolean;
  root: RefObject<HTMLDivElement | null>;
  editor: RefObject<HTMLDivElement | null>;
};

export function usePillOverflow<T>({ maxLines, doc, sel, focused, listOpen, root, editor }: Args<T>) {
  const [hidden, setHidden] = useState<Set<number>>(() => new Set());
  const plus = useRef<HTMLSpanElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const folded = useRef(0);
  const last = doc.texts.length - 1;
  const at = sel.focus.t;
  const byKeyboard = focused && at !== last && (hidden.has(at) || hidden.has(at - 1));
  const rectOf = useCallback(() => (layer.current ?? root.current)?.getBoundingClientRect(), [root]);
  const byMouse = useUnfolded(rectOf, !!maxLines && hidden.size > 0 && !listOpen, covered);
  const unfolded = hidden.size > 0 && (byMouse || byKeyboard);

  useLayoutEffect(() => {
    const ed = editor.current;
    const box = root.current;
    if (!maxLines || !ed || !box) return;
    if (unfolded) {
      // Fond et cadre sous les pastilles dépliées, du haut du champ jusqu'en bas de la dernière ligne.
      const padding = parseFloat(getComputedStyle(box).paddingBottom);
      if (layer.current) layer.current.style.height = `${ed.getBoundingClientRect().bottom - box.getBoundingClientRect().top + padding + 1}px`;
      return;
    }
    // Mesure à neuf avant chaque affichage : tout est montré le temps de la mesure (style posé ici, ôté à
    // la fin), puis les pastilles qui débordent sont cachées une à une (la suivante peut alors remonter).
    const wraps = [...ed.querySelectorAll<HTMLElement>(":scope > [data-pastille]")];
    const spacers = [...ed.querySelectorAll<HTMLElement>(":scope > [data-texte]")];
    const jump = ed.querySelector<HTMLElement>(":scope > [data-saut]");
    wraps.forEach((w) => (w.style.display = "inline-flex"));
    spacers.forEach((s) => (s.style.display = "inline"));
    if (jump) jump.style.display = "none";
    const top = ed.getBoundingClientRect().top;
    const left = ed.getBoundingClientRect().left;
    const line = (el: Element) => Math.floor((el.getBoundingClientRect().top - top + 1) / LINE);
    const next = new Set<number>();
    if (wraps.some((w) => line(w) >= maxLines)) {
      if (jump) jump.style.display = "block";
      const room = ed.clientWidth - (plus.current?.offsetWidth ?? 0) - 6;
      for (;;) {
        const k = wraps.findIndex((w, i) => !next.has(i) && (line(w) >= maxLines || (line(w) === maxLines - 1 && w.getBoundingClientRect().right - left > room)));
        if (k < 0) break;
        next.add(k);
        wraps[k].style.display = "none";
        if (doc.texts[k] === "") spacers[k].style.display = "none";
      }
    }
    wraps.forEach((w) => (w.style.display = ""));
    spacers.forEach((s) => (s.style.display = ""));
    if (jump) jump.style.display = "";
    // « +N » au bout de la dernière ligne de pastilles.
    if (plus.current) {
      plus.current.style.top = `${ed.offsetTop + (maxLines - 1) * LINE + (LINE - PILL) / 2}px`;
      plus.current.style.right = `${box.clientWidth - ed.offsetLeft - ed.clientWidth}px`;
    }
    setHidden((prev) => (same(prev, next) ? prev : next));
    folded.current = box.offsetHeight;
  });

  /** Pastille `k` cachée (et le texte vide qui la précède). */
  const isHidden = (k: number) => !unfolded && hidden.has(k);
  return { hidden, unfolded, isHidden, overflow: !!maxLines && hidden.size > 0, plus, layer, foldedHeight: folded.current };
}

/** « +N » et, dépliées, le fond des pastilles. */
export function PillOverflowParts({ count, unfolded, focused, plus, layer }: {
  count: number;
  unfolded: boolean;
  focused: boolean;
  plus: RefObject<HTMLSpanElement | null>;
  layer: RefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      <span
        ref={plus}
        data-zone="champ-pastilles.plus"
        className={cn(
          "pointer-events-none absolute rounded-md border border-border px-1.5 py-0.5 text-xs leading-4 text-muted-foreground tabular-nums",
          (count === 0 || unfolded) && "invisible",
        )}
      >
        +{Math.max(count, 1)}
      </span>
      {unfolded && (
        <div
          ref={layer}
          aria-hidden
          className={cn("pointer-events-none absolute -inset-x-px -top-px -z-10 rounded-lg border bg-background shadow-lg", focused ? "border-[#d9a94e]" : "border-border")}
        />
      )}
    </>
  );
}
