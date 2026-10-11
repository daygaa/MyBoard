"use client";

// MyBoard — Barre filtres + tri + densité grille + compteur total.
// B1 refactor : kind, sort, favorites sont des params URL SÉPARÉS
// (indépendants du système de tags). Aucun chip type:xxx ou order:xxx.
//
// - Filtres type : segmented control (Tout/Images/Vidéos/Audio/Documents)
// - Tri : dropdown (Récents/Anciens/Taille ↓/↑/Nb.tags ↓/↑/Aléatoire/Favoris)
// - Densité grille : 3 presets + slider custom 4-30
// - Compteur total à droite.

import Link from "next/link";
import { useState } from "react";
import { ArrowDownWideNarrow, LayoutGrid } from "lucide-react";
import {
  KIND_FILTERS,
  SORTS,
  browseHref,
  type BrowseOpts,
} from "@/lib/shared";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useBoardUI } from "./store";

type Props = {
  query: string;
  kind: string;
  sort: string;
  favorites?: boolean;
  total: number;
};

const DENSITY_PRESETS = [
  { label: "Confort", value: 5 },
  { label: "Standard", value: 7 },
  { label: "Compact", value: 14 },
];

const DENSITY_BUTTON_LABEL = "Disposition";

export function FiltersBar({ query, kind, sort, favorites, total }: Props) {
  const gridDensity = useBoardUI((s) => s.gridDensity);
  const setGridDensity = useBoardUI((s) => s.setGridDensity);
  const [densityOpen, setDensityOpen] = useState(false);

  const activePreset = DENSITY_PRESETS.find(
    (p) => Math.abs(p.value - gridDensity) <= 1
  );

  // B1 : helper pour construire une URL en préservant tous les params séparés
  function href(overrides: Partial<BrowseOpts>): string {
    return browseHref({
      tags: query || undefined,
      kind: kind || undefined,
      sort: sort || undefined,
      favorites: favorites || undefined,
      density: gridDensity,
      ...overrides,
    });
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      {/* Segmented control : type (B1 : param kind séparé, pas de type:xxx dans tags) */}
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card/60 p-0.5">
        {KIND_FILTERS.map((f) => {
          const active = kind === f.value;
          return (
            <Link
              key={f.label}
              href={href({ kind: f.value || undefined, page: 1 })}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                active
                  ? "bg-[#d9a94e]/15 text-[#d9a94e]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* Tri dropdown (B1 : param sort séparé, pas de order:xxx dans tags) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-border bg-card/60 text-xs hover:bg-secondary hover:text-foreground"
          >
            <ArrowDownWideNarrow className="h-3.5 w-3.5" />
            {SORTS.find((s) => s.value === sort)?.label ?? "Récents"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="border-border bg-popover text-popover-foreground"
        >
          {SORTS.map((s) => {
            const active = sort === s.value;
            return (
              <DropdownMenuItem key={s.label} asChild>
                <Link
                  href={href({ sort: s.value || undefined, page: 1 })}
                  className={`flex w-full items-center justify-between gap-3 ${
                    active ? "text-[#d9a94e]" : ""
                  }`}
                >
                  {s.label}
                  {active && <span className="text-[#d9a94e]">•</span>}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Densité grille : popover avec presets + slider */}
      <Popover open={densityOpen} onOpenChange={setDensityOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-border bg-card/60 text-xs hover:bg-secondary hover:text-foreground"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            {DENSITY_BUTTON_LABEL}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-64 border-border bg-popover p-4 text-popover-foreground"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Disposition
            </span>
            <span className="font-mono text-xs text-[#d9a94e]">
              {gridDensity} cols
            </span>
          </div>
          {/* Presets */}
          <div className="mb-4 grid grid-cols-3 gap-1.5">
            {DENSITY_PRESETS.map((p) => {
              const isActive = activePreset?.value === p.value;
              return (
                <button
                  key={p.label}
                  onClick={() => setGridDensity(p.value)}
                  className={`rounded-md border px-2 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? "border-[#d9a94e] bg-[#d9a94e]/15 text-[#d9a94e]"
                      : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {/* Slider custom */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>4 (aéré)</span>
              <span>30 (compact)</span>
            </div>
            <Slider
              value={[gridDensity]}
              min={4}
              max={30}
              step={1}
              onValueChange={(v) => setGridDensity(v[0] ?? 7)}
              className="[&_[role=slider]]:border-[#d9a94e] [&_[role=slider]]:bg-[#d9a94e] [&_[role=slider]]:focus-visible:ring-[#d9a94e]/40 [&_.bg-primary]:bg-[#d9a94e]"
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Compteur */}
      <div className="ml-auto text-xs text-muted-foreground">
        <span className="font-semibold tabular-nums text-foreground">
          {total.toLocaleString("fr-FR")}
        </span>{" "}
        média{total > 1 ? "s" : ""}
      </div>
    </div>
  );
}
