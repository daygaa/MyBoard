// Tableau du gestionnaire de tags (TAGM-04) : en-tête aux colonnes triables (clic ; flèche du sens),
// case « tout cocher » (les tags affichés), puis les lignes, virtualisées comme la grille (D-008) :
// fluide même avec des milliers de tags.

import { useLayoutEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { useCategories } from "@/hooks/useCategories";
import type { ManagedTag } from "@/lib/api";
import { scroller } from "@/lib/scroller";
import { cn } from "@/lib/utils";
import { COLUMNS, TagRow } from "./TagRow";
import type { Sort, SortKey } from "./useTagList";

const ROW_HEIGHT = 38;

type RowHandlers = Pick<React.ComponentProps<typeof TagRow>, "onCheck" | "onEdit" | "onRename" | "onSearch" | "onDelete" | "onMenu">;

type Props = RowHandlers & {
  tags: ManagedTag[];
  checked: Set<number>;
  editing: number | null;
  sort: Sort;
  onSort: (key: SortKey) => void;
  onCheckAll: (on: boolean) => void;
};

function SortHeader({ label, sortKey, sort, onSort, className }: { label: string; sortKey: SortKey; sort: Sort; onSort: Props["onSort"]; className?: string }) {
  const on = sort.key === sortKey;
  const Arrow = sort.desc ? ArrowDown : ArrowUp;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      title="Trier"
      className={cn("flex items-center gap-1 hover:text-foreground", on && "text-[#d9a94e]", className)}
    >
      {label}
      {on && <Arrow className="h-3 w-3" />}
    </button>
  );
}

export function TagTable({ tags, checked, editing, sort, onSort, onCheckAll, ...row }: Props) {
  const { color } = useCategories();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  // Position de la liste dans la zone qui défile (ce qui est au-dessus a pu changer de hauteur).
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const area = scroller();
    const next = el.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop;
    if (next !== top) setTop(next);
  });
  const virtualizer = useVirtualizer({
    count: tags.length,
    getScrollElement: scroller,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    scrollMargin: top,
  });
  const all = tags.length > 0 && tags.every((t) => checked.has(t.id));
  const some = !all && tags.some((t) => checked.has(t.id));

  return (
    <div data-zone="gestionnaire-tags.tableau" className="rounded-xl border border-border bg-card/40">
      <div className={cn(COLUMNS, "h-9 border-b border-border px-2 text-xs font-medium text-muted-foreground")}>
        <Checkbox
          checked={all ? true : some ? "indeterminate" : false}
          onCheckedChange={(c) => onCheckAll(c === true)}
          aria-label="Cocher tous les tags affichés"
        />
        <SortHeader label="Nom" sortKey="name" sort={sort} onSort={onSort} />
        <SortHeader label="Catégorie" sortKey="category" sort={sort} onSort={onSort} />
        <SortHeader label="Médias" sortKey="count" sort={sort} onSort={onSort} className="justify-end" />
        <SortHeader label="Créé le" sortKey="created" sort={sort} onSort={onSort} />
        <span className="text-center">Description</span>
        <span className="text-right">Actions</span>
      </div>
      <div ref={bodyRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const tag = tags[item.index];
          return (
            <div key={tag.id} className="absolute inset-x-0 top-0" style={{ height: ROW_HEIGHT, transform: `translateY(${item.start - top}px)` }}>
              <TagRow tag={tag} color={color(tag.categoryId)} checked={checked.has(tag.id)} editing={editing === tag.id} {...row} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
