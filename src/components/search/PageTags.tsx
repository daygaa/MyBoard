// Tags de la page affichée (SRCH-10), groupés par catégorie dans l'ordre défini, chacun de sa
// couleur (SRCH-11), avec le nombre TOTAL de médias de la bibliothèque qui le portent.
// Clic = rechercher ce tag ; « + » = l'ajouter à la recherche ; « − » = l'exclure (SRCH-12).
// Les compteurs viennent de la base (déclencheurs SQL) : toujours exacts (SRCH-13), relus
// dès qu'un tag est ajouté ou retiré (SRCH-14).
// Liste virtualisée (D-008) : une page de 500 médias peut porter des milliers de tags.
// Chaque catégorie montre ses 10 tags les plus utilisés ; son nom est un bouton qui déplie la
// liste complète, puis la replie (SRCH-15).

import { useLayoutEffect, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, Minus, Plus } from "lucide-react";

import { useCategories } from "@/hooks/useCategories";
import { api, type Category, type MediaItem, type TagInfo } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { displayTag } from "@/lib/tags";
import { useSearch } from "@/stores/search";

type Row =
  | { kind: "category"; category: Category; count: number; expandable: boolean; expanded: boolean }
  | { kind: "tag"; tag: TagInfo; color: string };

const CATEGORY_ROW = 30;
const TAG_ROW = 26;
/** Tags montrés par catégorie tant qu'elle n'est pas dépliée (SRCH-15). */
const FOLDED_COUNT = 10;

function TagRow({ tag, color }: { tag: TagInfo; color: string }) {
  const setTerms = useSearch((s) => s.setTerms);
  const addTerms = useSearch((s) => s.addTerms);
  const label = displayTag(tag.name);
  return (
    <div data-zone="barre-laterale.tag" className="group flex h-full items-center gap-1 rounded-md pr-1 hover:bg-secondary/60">
      <button
        type="button"
        onClick={() => addTerms([tag.name])}
        aria-label={`Ajouter « ${label} » à la recherche`}
        title="Ajouter à la recherche"
        className="grid h-5 w-5 place-items-center rounded text-muted-foreground/70 transition hover:text-[#d9a94e]"
      >
        <Plus className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => addTerms([`-${tag.name}`])}
        aria-label={`Exclure « ${label} » de la recherche`}
        title="Exclure de la recherche"
        className="grid h-5 w-5 place-items-center rounded text-muted-foreground/70 transition hover:text-rose-400"
      >
        <Minus className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => setTerms([tag.name])}
        title={`Rechercher « ${label} »`}
        className="ml-1 min-w-0 flex-1 truncate text-left text-sm hover:underline"
        style={{ color }}
      >
        {label}
      </button>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatNumber(tag.mediaCount)}</span>
    </div>
  );
}

export function PageTags({ items }: { items: MediaItem[] }) {
  const ids = items.map((m) => m.id);
  const { data: tags = [] } = useQuery({
    queryKey: ["page-tags", ids],
    queryFn: () => api.pageTags(ids),
    placeholderData: keepPreviousData,
  });
  const { list: categories } = useCategories();
  /** Catégories dépliées (gardées en changeant de page). */
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const toggle = (id: number) =>
    setExpanded((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  // Tags déjà triés par nombre de médias (le plus utilisé en haut, D-016).
  const rows: Row[] = [];
  for (const category of categories) {
    const inCategory = tags.filter((t) => t.categoryId === category.id);
    if (inCategory.length === 0) continue;
    const open = expanded.has(category.id);
    const expandable = inCategory.length > FOLDED_COUNT;
    rows.push({ kind: "category", category, count: inCategory.length, expandable, expanded: open });
    const shown = open ? inCategory : inCategory.slice(0, FOLDED_COUNT);
    for (const tag of shown) rows.push({ kind: "tag", tag, color: category.color });
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  // Nouvelle page : la liste repart du haut (sinon elle resterait au milieu d'une autre liste).
  const pageKey = ids.join(",");
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [pageKey]);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (rows[i]?.kind === "category" ? CATEGORY_ROW : TAG_ROW),
    overscan: 12,
  });

  return (
    <section data-zone="barre-laterale.tags" className="mt-6 flex min-h-0 flex-1 flex-col">
      <h3 className="mb-2 flex items-center justify-between px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        Tags
        {tags.length > 0 && (
          <span className="font-normal tracking-normal normal-case">{formatNumber(tags.length)} sur la page</span>
        )}
      </h3>
      {rows.length === 0 && <p className="px-1 text-sm text-muted-foreground">Aucun tag.</p>}
      {/* Toujours présente, même vide : la liste virtualisée mesure sa zone dès le départ. */}
      <div ref={scrollRef} className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((v) => {
            const row = rows[v.index];
            if (!row) return null;
            return (
              <div
                key={v.key}
                className="absolute top-0 left-0 w-full"
                style={{ height: v.size, transform: `translateY(${v.start}px)` }}
              >
                {row.kind === "category" ? (
                  <button
                    type="button"
                    data-zone="barre-laterale.categorie"
                    disabled={!row.expandable}
                    onClick={() => toggle(row.category.id)}
                    aria-expanded={row.expandable ? row.expanded : undefined}
                    title={row.expandable ? (row.expanded ? "Ne montrer que les 10 premiers" : "Afficher tous les tags") : undefined}
                    className="flex h-full w-full items-end gap-2 px-1 pb-1 text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase enabled:hover:text-foreground disabled:cursor-default"
                  >
                    {row.category.name}
                    <span className="font-normal text-muted-foreground/70 tabular-nums">{formatNumber(row.count)}</span>
                    {row.expandable && (
                      <ChevronDown className={cn("mb-px h-3.5 w-3.5 transition-transform", row.expanded && "rotate-180")} />
                    )}
                  </button>
                ) : (
                  <TagRow tag={row.tag} color={row.color} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
