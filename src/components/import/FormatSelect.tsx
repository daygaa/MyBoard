// Menu du format de « Convertir les images en » (IMP-21, apparence v8 : « JPG · DÉFAUT »). JFIF = JPEG sous un autre
// nom ; pas de HEIF (ffmpeg ne sait pas l'écrire, Windows demande une extension payante). À droite de chaque format,
// un « ⓘ » : qualité, vitesse, compatibilité (IMP-66, textes choisis par l'utilisateur le 10/11).

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { InfoTip } from "@/components/ui/info-tip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ImageTarget } from "@/lib/api";
import { useEscape } from "@/lib/escape";
import { cn } from "@/lib/utils";

const FORMATS: { value: ImageTarget; label: string; info: string[] }[] = [
  { value: "jpg", label: "JPG", info: ["Qualité : bonne", "Vitesse : très rapide", "Compatibilité : maximale"] },
  { value: "jfif", label: "JFIF", info: ["Qualité : bonne", "Vitesse : très rapide", "Compatibilité : moyenne"] },
  {
    value: "png",
    label: "PNG",
    info: ["Qualité : lossless + transparence conservée", "Vitesse : rapide", "Compatibilité : maximale", "Inconvénient : poids élevé"],
  },
  { value: "webp", label: "WebP", info: ["Qualité : très bonne et poids léger", "Vitesse : rapide", "Compatibilité : moyenne"] },
  { value: "avif", label: "AVIF", info: ["Qualité : excellente et poids léger", "Vitesse : lente", "Compatibilité : mauvaise"] },
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
          <DropdownMenuItem key={f.value} onSelect={() => onChange(f.value)} className="justify-between gap-6">
            <Label value={f.value} />
            <InfoTip zone={`import.options.format.${f.value}.info`}>
              {f.info.map((line) => (
                <span key={line} className="block whitespace-nowrap">
                  {line}
                </span>
              ))}
            </InfoTip>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
