// Carte « Options d'import » (IMP-30, apparence v8), à droite de la carte Fichiers. Lot 3 de la phase 4 : seulement
// « Compresser les images » et sa qualité 20–95 (IMP-20) ; la conversion des images (lot 4) et des vidéos (lot 5)
// s'y ajouteront. Dernier choix retenu (IMP-29). Bloquée pendant un import.

import { Image as ImageIcon, SlidersHorizontal } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { QUALITY, useImport } from "@/stores/import";

export function OptionsCard() {
  const compress = useImport((s) => s.compress);
  const quality = useImport((s) => s.quality);
  const setCompress = useImport((s) => s.setCompress);
  const setQuality = useImport((s) => s.setQuality);
  const busy = useImport((s) => s.snapshot?.phase === "importing");

  return (
    <section data-zone="import.options" className="rounded-xl border border-border bg-card/60 p-6">
      <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
        <SlidersHorizontal className="h-4 w-4 text-[#d9a94e]" />
        Options d'import
      </h2>

      <div data-zone="import.options.compression" className="space-y-3">
        <label className="flex cursor-pointer items-start gap-3 has-disabled:cursor-not-allowed">
          <Checkbox checked={compress} disabled={busy} onCheckedChange={(c) => setCompress(c === true)} className="mt-0.5" />
          <span className="space-y-1">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ImageIcon className="h-4 w-4 text-emerald-400" />
              Compresser les images
            </span>
            <span className="block text-xs text-muted-foreground select-text">
              Réencode les JPEG et les WebP à la qualité choisie. La version compressée est écrite à côté de l'original («
              photo (compressé).jpg ») et n'est gardée que si elle est au moins 5 % plus légère ; l'original n'est jamais
              modifié.
            </span>
          </span>
        </label>

        <div className="pl-7">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Qualité</span>
            <span className="rounded bg-[#d9a94e]/15 px-1.5 py-0.5 font-semibold text-[#d9a94e] tabular-nums select-text">{quality}</span>
          </div>
          <Slider
            data-zone="import.options.qualite"
            min={QUALITY.min}
            max={QUALITY.max}
            step={1}
            value={[quality]}
            disabled={!compress || busy}
            onValueChange={([v]) => setQuality(v)}
            aria-label="Qualité de la compression"
            className="data-[disabled]:cursor-not-allowed"
          />
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
            <span>{QUALITY.min} (compressé)</span>
            <span>{QUALITY.max} (haute)</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground select-text">
            Résolution, informations de la photo (EXIF) et dates du fichier gardées. Les PNG, GIF et autres formats ne sont
            jamais compressés.
          </p>
        </div>
      </div>
    </section>
  );
}
