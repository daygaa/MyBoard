// Barre au-dessus de la grille (apparence v8) : types, tri, disposition, compteur.
// Filtres et tri sont totalement indépendants des tags (FILT-02, FILT-03).

import { ArrowDownWideNarrow } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatNumber, plural } from "@/lib/format";
import { KIND_FILTERS, SORTS } from "@/lib/grid";
import { cn } from "@/lib/utils";
import { useLibrary } from "@/stores/library";
import { LayoutPopover } from "./LayoutPopover";

const SEGMENT = "rounded-md px-2.5 py-1 text-xs font-medium transition";
const SEGMENT_ON = "bg-[#d9a94e]/15 text-[#d9a94e]";
const SEGMENT_OFF = "text-muted-foreground hover:text-foreground";

/** Types à sélection multiple (FILT-01) : « Tout » = aucun type coché. */
function KindFilter() {
  const kinds = useLibrary((s) => s.kinds);
  const toggleKind = useLibrary((s) => s.toggleKind);
  const showAllKinds = useLibrary((s) => s.showAllKinds);
  return (
    <div data-zone="grille.filtres.types" className="flex items-center gap-0.5 rounded-lg border border-border bg-card/60 p-0.5">
      <button type="button" onClick={showAllKinds} className={cn(SEGMENT, kinds.length === 0 ? SEGMENT_ON : SEGMENT_OFF)}>
        Tout
      </button>
      {KIND_FILTERS.map((f) => (
        <button
          key={f.value}
          type="button"
          aria-pressed={kinds.includes(f.value)}
          onClick={() => toggleKind(f.value)}
          className={cn(SEGMENT, kinds.includes(f.value) ? SEGMENT_ON : SEGMENT_OFF)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

function SortMenu() {
  const sort = useLibrary((s) => s.sort);
  const setSort = useLibrary((s) => s.setSort);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          data-zone="grille.filtres.tri"
          variant="outline"
          size="sm"
          className="gap-1.5 border-border bg-card/60 text-xs hover:bg-secondary hover:text-foreground"
        >
          <ArrowDownWideNarrow className="h-3.5 w-3.5" />
          {SORTS.find((s) => s.value === sort)?.label ?? "Récents"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent data-zone="tri.menu" align="start" className="border-border bg-popover text-popover-foreground">
        {SORTS.map((s) => (
          <DropdownMenuItem
            key={s.value}
            onSelect={() => setSort(s.value)}
            className={cn("flex w-full items-center justify-between gap-3", sort === s.value && "text-[#d9a94e]")}
          >
            {s.label}
            {sort === s.value && <span className="text-[#d9a94e]">•</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FiltersBar({ total }: { total: number }) {
  return (
    <div data-zone="grille.filtres" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      <KindFilter />
      <SortMenu />
      <LayoutPopover />
      <div data-zone="grille.filtres.compteur" className="ml-auto text-xs text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{formatNumber(total)}</span> {plural(total, "média")}
      </div>
    </div>
  );
}
