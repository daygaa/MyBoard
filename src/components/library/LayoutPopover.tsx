// Bouton « Disposition » (GRID-03, v8 ✓) : préréglages + curseur 4–30 colonnes,
// sans texte explicatif sous le curseur.

import { LayoutGrid } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { DENSITY_DEFAULT, DENSITY_MAX, DENSITY_MIN, DENSITY_PRESETS } from "@/lib/grid";
import { cn } from "@/lib/utils";
import { useLibrary } from "@/stores/library";

export function LayoutPopover() {
  const density = useLibrary((s) => s.density);
  const setDensity = useLibrary((s) => s.setDensity);
  const activePreset = DENSITY_PRESETS.find((p) => Math.abs(p.value - density) <= 1);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          data-zone="grille.filtres.disposition"
          variant="outline"
          size="sm"
          className="gap-1.5 border-border bg-card/60 text-xs hover:bg-secondary hover:text-foreground"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Disposition
        </Button>
      </PopoverTrigger>
      <PopoverContent data-zone="disposition" align="start" className="w-64 border-border bg-popover p-4 text-popover-foreground">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Disposition</span>
          <span className="font-mono text-xs text-[#d9a94e]">{density} cols</span>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-1.5">
          {DENSITY_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setDensity(p.value)}
              className={cn(
                "rounded-md border px-2 py-1.5 text-xs font-medium transition",
                activePreset?.value === p.value
                  ? "border-[#d9a94e] bg-[#d9a94e]/15 text-[#d9a94e]"
                  : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{DENSITY_MIN} (aéré)</span>
            <span>{DENSITY_MAX} (compact)</span>
          </div>
          <Slider
            value={[density]}
            min={DENSITY_MIN}
            max={DENSITY_MAX}
            step={1}
            onValueChange={(v) => setDensity(v[0] ?? DENSITY_DEFAULT)}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
