// Menu de choix de la catégorie d'un nouveau tag (VIEW-22, IMP-30), dans l'ordre défini
// (TAGM-03), chaque catégorie avec sa couleur.

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCategories } from "@/hooks/useCategories";
import { useEscape } from "@/lib/escape";
import { cn } from "@/lib/utils";

type Props = {
  value: number | null;
  onChange: (id: number) => void;
  zone: string;
  className?: string;
};

/** Catégorie proposée par défaut : « Général » (comme la v8). */
export function useDefaultCategory(): number | null {
  const { list } = useCategories();
  return list.find((c) => c.key === "general")?.id ?? list[0]?.id ?? null;
}

export function CategorySelect({ value, onChange, zone, className }: Props) {
  const { list, byId } = useCategories();
  const [open, setOpen] = useState(false);
  // Échap ferme le menu seul, pas la pop-in qui le contient.
  useEscape(open, () => setOpen(false));
  const current = value === null ? undefined : byId.get(value);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-zone={zone}
          className={cn(
            "flex h-[38px] items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-sm text-foreground transition hover:border-[#d9a94e]/50",
            className,
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: current?.color }} />
            {current?.name ?? "Catégorie"}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[130] border-border bg-popover text-popover-foreground">
        {list.map((c) => (
          <DropdownMenuItem key={c.id} onSelect={() => onChange(c.id)} className="gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
            <span style={{ color: c.color }}>{c.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
