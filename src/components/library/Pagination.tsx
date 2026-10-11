// Pagination (PAGE-01), apparence v8 : flèches, numéros autour de la page courante,
// première et dernière page, plus un champ « aller à la page ». Affichée en haut et
// en bas de la grille. Une page inexistante ne peut pas être demandée.
// La page active reste toujours au centre exact de la fenêtre, alignée avec le logo
// (PAGE-04) : les pages précédentes se rangent à sa gauche, les suivantes à sa droite.

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { formatNumber, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLibrary } from "@/stores/library";

const CELL =
  "grid h-8 min-w-8 place-items-center rounded-md px-2 text-sm tabular-nums transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9a94e]";
const LINK = "text-muted-foreground hover:bg-secondary hover:text-foreground";

/** Demi-largeur minimale pour centrer sur la fenêtre (place des numéros et de « Aller à »). */
const MIN_HALF_WIDTH = 380;

/** Marges qui placent le centre de l'élément au centre de la fenêtre. La grille est à droite
 *  de la barre latérale : sans cela, la barre est centrée sur la grille, pas sur la fenêtre.
 *  Fenêtre trop étroite : marges nulles (centrage sur la grille, sans passer sous la barre latérale). */
function useWindowCentering(ref: RefObject<HTMLElement | null>) {
  const [pad, setPad] = useState({ left: 0, right: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect(); // bords extérieurs : ne dépendent pas des marges
      const centre = window.innerWidth / 2;
      const half = Math.min(centre - box.left, box.right - centre);
      const next =
        half < MIN_HALF_WIDTH
          ? { left: 0, right: 0 }
          : { left: Math.round(centre - half - box.left), right: Math.round(box.right - (centre + half)) };
      setPad((p) => (p.left === next.left && p.right === next.right ? p : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref]);
  return { paddingLeft: pad.left, paddingRight: pad.right };
}

/** Numéros avec « … » quand il manque des pages entre deux numéros. */
function PageButtons({ pages, setPage }: { pages: number[]; setPage: (p: number) => void }) {
  return pages.map((p, i) => (
    <span key={p} className="flex items-center gap-1">
      {i > 0 && pages[i - 1] !== p - 1 && <span className="px-1 text-muted-foreground/60">…</span>}
      <button type="button" onClick={() => setPage(p)} className={cn(CELL, LINK)}>
        {p}
      </button>
    </span>
  ));
}

/** Pages affichées : 1, la dernière, et 3 de chaque côté de la page courante. */
function visiblePages(page: number, pageCount: number): number[] {
  const set = new Set([1, pageCount]);
  for (let p = page - 3; p <= page + 3; p++) if (p >= 1 && p <= pageCount) set.add(p);
  return [...set].sort((a, b) => a - b);
}

function GoToPage({ pageCount }: { pageCount: number }) {
  const setPage = useLibrary((s) => s.setPage);
  const [value, setValue] = useState("");
  const target = Number(value);
  const valid = Number.isInteger(target) && target >= 1 && target <= pageCount;
  const invalid = value !== "" && !valid;

  return (
    <form
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        setPage(target);
        setValue("");
      }}
    >
      <span>Aller à</span>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={pageCount}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="page"
        aria-invalid={invalid}
        title={invalid ? `Page entre 1 et ${pageCount}` : undefined}
        className={cn(
          "h-8 w-16 rounded-md border bg-card/60 px-2 text-center text-sm text-foreground tabular-nums outline-none placeholder:text-muted-foreground/60 focus:border-[#d9a94e]/60",
          invalid ? "border-rose-500/70" : "border-border",
        )}
      />
    </form>
  );
}

type Props = {
  page: number;
  pageCount: number;
  total: number;
  zone: string;
  /** Ligne « Page X / Y · N médias » (en bas seulement, comme dans la v8). */
  showSummary?: boolean;
};

export function Pagination({ page, pageCount, total, zone, showSummary = false }: Props) {
  const ref = useRef<HTMLElement>(null);
  const centering = useWindowCentering(ref);
  const setPage = useLibrary((s) => s.setPage);
  const summary = `Page ${page} / ${pageCount} · ${formatNumber(total)} ${plural(total, "média")}`;

  if (pageCount <= 1) {
    if (!showSummary) return null;
    return (
      <nav ref={ref} data-zone={zone} style={centering} className="text-center text-xs text-muted-foreground">
        {summary}
      </nav>
    );
  }

  const pages = visiblePages(page, pageCount);
  const before = pages.filter((p) => p < page);
  const after = pages.filter((p) => p > page);
  // « … » entre la dernière page précédente et la page active, ou entre elle et la suivante.
  const gapBefore = before.length > 0 && before[before.length - 1] !== page - 1;
  const gapAfter = after.length > 0 && after[0] !== page + 1;

  return (
    <nav ref={ref} data-zone={zone} aria-label="Pagination" style={centering} className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            aria-label="Page précédente"
            className={cn(CELL, page > 1 ? LINK : "text-muted-foreground/40")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <PageButtons pages={before} setPage={setPage} />
          {gapBefore && <span className="px-1 text-muted-foreground/60">…</span>}
        </div>
        <span aria-current="page" className={cn(CELL, "bg-[#d9a94e] font-semibold text-[#1a1408]")}>
          {page}
        </span>
        <div className="flex items-center justify-start gap-1">
          {gapAfter && <span className="px-1 text-muted-foreground/60">…</span>}
          <PageButtons pages={after} setPage={setPage} />
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage(page + 1)}
            aria-label="Page suivante"
            className={cn(CELL, page < pageCount ? LINK : "text-muted-foreground/40")}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="ml-2">
            <GoToPage pageCount={pageCount} />
          </span>
        </div>
      </div>
      {showSummary && <div className="text-center text-xs text-muted-foreground">{summary}</div>}
    </nav>
  );
}
