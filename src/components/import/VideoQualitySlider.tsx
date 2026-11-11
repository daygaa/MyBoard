// Curseur « Qualité vidéo » à 5 crans (IMP-24, apparence v8) : nom complet dans l'étiquette, noms courts dessous (le cran
// choisi en doré). Utilisé par « Compresser les vidéos » (IMP-69) et par la pop-in « Convertir » de la visionneuse
// (VIEW-25).

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { VIDEO_QUALITY } from "@/stores/import";

/** Noms courts sous le curseur, comme la v8. */
const SHORT = ["Min", "Basse", "Moy.", "Haute", "Max"];

type Props = { zone: string; value: number; onChange: (v: number) => void; disabled?: boolean };

export function VideoQualitySlider({ zone, value, onChange, disabled = false }: Props) {
  return (
    <>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Qualité vidéo</span>
        <span className="rounded bg-[#d9a94e]/15 px-1.5 py-0.5 font-semibold text-[#d9a94e] select-text">{VIDEO_QUALITY[value]}</span>
      </div>
      <Slider
        data-zone={zone}
        min={0}
        max={4}
        step={1}
        value={[value]}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
        aria-label="Qualité vidéo"
        className="data-[disabled]:cursor-not-allowed"
      />
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        {SHORT.map((label, i) => (
          <span key={label} className={cn(i === value && "font-semibold text-[#d9a94e]")}>
            {label}
          </span>
        ))}
      </div>
    </>
  );
}
