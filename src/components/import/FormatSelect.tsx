// Menu du format de « Convertir les images en » (IMP-21, apparence v8 : « JPG · DÉFAUT »). JFIF = JPEG sous un autre
// nom ; pas de HEIF (ffmpeg ne sait pas l'écrire, Windows demande une extension payante).

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ImageTarget } from "@/lib/api";
import { useEscape } from "@/lib/escape";
import { cn } from "@/lib/utils";

const FORMATS: { value: ImageTarget; label: string }[] = [
  { value: "jpg", label: "JPG" },
  { value: "jfif", label: "JFIF" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
  { value: "avif", label: "AVIF" },
];

function Label({ value }: { value: ImageTarget }) {
  return (
    <span className="flex items-center gap-2">
      {FORMATS.find((f) => f.value === value)?.label}
      {value === "jpg" && <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">défaut</span>}
    </span>
  );
}

export function FormatSelect({ value, onChange, disabled }: { value: ImageTarget; onChange: (v: ImageTarget) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  useEscape(open, () => setOpen(false));
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          data-zone="import.options.format"
          className={cn(
            "flex h-[38px] w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-sm text-foreground transition hover:border-[#d9a94e]/50",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border",
          )}
        >
          <Label value={value} />
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="z-[130] min-w-[var(--radix-dropdown-menu-trigger-width)] border-border bg-popover text-popover-foreground">
        {FORMATS.map((f) => (
          <DropdownMenuItem key={f.value} onSelect={() => onChange(f.value)}>
            <Label value={f.value} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
