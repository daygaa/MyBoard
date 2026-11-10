// Menu des formats de « Convertir les images en » (IMP-21) et de « Convertir les vidéos en » (IMP-22), apparence v8
// (« JPG · DÉFAUT »). JFIF = JPEG sous un autre nom ; pas de HEIF (ffmpeg ne sait pas l'écrire, Windows demande une
// extension payante). À droite de chaque format, un « ⓘ » : qualité, vitesse, compatibilité (IMP-66, textes choisis par
// l'utilisateur le 10/11 ; une seule bulle par format, celle d'IMP-23 est remplacée). La vitesse est celle de
// l'encodeur choisi automatiquement : carte graphique pour le H.264 et le H.265 (à adapter quand le choix ira dans les
// Paramètres, SET-05).

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { InfoTip } from "@/components/ui/info-tip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ImageTarget, VideoTarget } from "@/lib/api";
import { useEscape } from "@/lib/escape";
import { cn } from "@/lib/utils";

type Format<T extends string> = { value: T; label: string; info: string[] };

export const IMAGE_FORMATS: Format<ImageTarget>[] = [
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

export const VIDEO_FORMATS: Format<VideoTarget>[] = [
  { value: "h264", label: "MP4 standard (H.264)", info: ["Qualité : bonne", "Vitesse : rapide", "Compatibilité : maximale"] },
  { value: "h265", label: "MP4 H.265 (HEVC)", info: ["Qualité : très bonne et poids léger", "Vitesse : rapide", "Compatibilité : moyenne"] },
  { value: "webm", label: "WebM", info: ["Qualité : très bonne", "Vitesse : lente", "Compatibilité : moyenne"] },
  { value: "av1", label: "AV1", info: ["Qualité : maximale et poids très léger", "Vitesse : très lente", "Compatibilité : moyenne"] },
];

function Label<T extends string>({ format, isDefault }: { format: Format<T> | undefined; isDefault: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate">{format?.label}</span>
      {isDefault && <span className="shrink-0 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">défaut</span>}
    </span>
  );
}

type Props<T extends string> = {
  formats: Format<T>[];
  value: T;
  onChange: (v: T) => void;
  disabled: boolean;
  /** `data-zone` du menu : « import.options.format » (images), « import.options.format-video ». */
  zone: string;
};

export function FormatSelect<T extends string>({ formats, value, onChange, disabled, zone }: Props<T>) {
  const [open, setOpen] = useState(false);
  useEscape(open, () => setOpen(false));
  // Le premier format de la liste est celui par défaut (JPG, MP4 standard), comme la v8.
  const isDefault = (v: T) => v === formats[0].value;
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          data-zone={zone}
          className={cn(
            "flex h-[38px] w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 text-sm text-foreground transition hover:border-[#d9a94e]/50",
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border",
          )}
        >
          <Label format={formats.find((f) => f.value === value)} isDefault={isDefault(value)} />
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="z-[130] min-w-[var(--radix-dropdown-menu-trigger-width)] border-border bg-popover text-popover-foreground">
        {formats.map((f) => (
          <DropdownMenuItem key={f.value} onSelect={() => onChange(f.value)} className="justify-between gap-6">
            <Label format={f} isDefault={isDefault(f.value)} />
            <InfoTip zone={`${zone}.${f.value}.info`}>
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
