// Carte « Options d'import » (IMP-30, apparence v8), à droite de la carte Fichiers : « Compresser les images » et sa
// qualité 20–95 (IMP-20, IMP-62), « Convertir les images en » (IMP-21), les options vidéo (IMP-69, IMP-22, `VideoOptions`),
// « Supprimer les originaux » (IMP-28). Dernier choix retenu (IMP-29), sauf la suppression des originaux. Bloquée
// pendant un import. Les textes explicatifs de chaque option sont dans son « ⓘ » (demande du 10/11).

import { Image as ImageIcon, SlidersHorizontal, Trash2, Wand2 } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { processing, QUALITY, useImport } from "@/stores/import";
import { FormatSelect, IMAGE_FORMATS } from "./FormatSelect";
import { OptionRow, withOriginals } from "./OptionRow";
import { VideoOptions } from "./VideoOptions";


// Textes des « ⓘ » : ceux de l'utilisateur (IMP-71, 11/11), une ligne par retour à la ligne.
const COMPRESS_INFO = [
  "Réencode les JPEG, WebP et PNG à la qualité choisie.",
  "La version compressée est enregistrée à côté de l'original et n'est conservée que si elle est au moins 5 % plus légère ; l'original n'est jamais modifié.",
  "PNG : optimisation lossless si la case est activée, peu importe la qualité ; de 16 à 8 bits de profondeur par couleur à 75 ou moins ; réduction à 256 couleurs à 50 ou moins.",
  "Les métadonnées sont conservées. Les GIF, BMP, TIFF et autres images animées ne sont jamais compressés.",
];
const CONVERT_INFO = [
  "Réencode chaque image dans le format choisi, à côté de l'original.",
  "Si la compression est activée, elle s'applique au format choisi ; sans compression : qualité maximale.",
  "En JPG, la transparence est remplacée par un fond blanc. Les GIF et WebP animés ne sont jamais convertis.",
  "Les métadonnées sont conservées, y compris pour les AVIF (traitement via MyBoard).",
];
const DELETE_INFO = [
  "Une fois sa nouvelle version enregistrée, l'original est effacé définitivement du disque, sans passer par la Corbeille. Deux confirmations sont demandées au lancement de l'import.",
];

export function OptionsCard() {
  const s = useImport();
  const busy = s.snapshot?.phase === "importing";

  return (
    <section data-zone="import.options" className="rounded-xl border border-border bg-card/60 p-6">
      <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
        <SlidersHorizontal className="h-4 w-4 text-[#d9a94e]" />
        Options d'import
      </h2>

      <div className="space-y-6">
        <div data-zone="import.options.compression" className="space-y-3">
          <OptionRow
            zone="import.options.compression"
            checked={s.compress}
            disabled={busy}
            onChange={s.setCompress}
            icon={<ImageIcon className="h-4 w-4 text-emerald-400" />}
            label="Compresser les images"
            info={withOriginals(COMPRESS_INFO, s.deleteOriginals)}
          />
          <div className="pl-7">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Qualité</span>
              <span className="rounded bg-[#d9a94e]/15 px-1.5 py-0.5 font-semibold text-[#d9a94e] tabular-nums select-text">{s.quality}</span>
            </div>
            <Slider
              data-zone="import.options.qualite"
              min={QUALITY.min}
              max={QUALITY.max}
              step={1}
              value={[s.quality]}
              disabled={!s.compress || busy}
              onValueChange={([v]) => s.setQuality(v)}
              aria-label="Qualité de la compression"
              className="data-[disabled]:cursor-not-allowed"
            />
            <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
              <span>{QUALITY.min} (compressé)</span>
              <span>{QUALITY.max} (haute)</span>
            </div>
          </div>
        </div>

        <div data-zone="import.options.conversion" className="space-y-3">
          <OptionRow
            zone="import.options.conversion"
            checked={s.convert}
            disabled={busy}
            onChange={s.setConvert}
            icon={<Wand2 className="h-4 w-4 text-[#d9a94e]" />}
            label="Convertir les images en :"
            info={CONVERT_INFO}
          />
          <div className="pl-7">
            <FormatSelect formats={IMAGE_FORMATS} value={s.convertTo} onChange={s.setConvertTo} disabled={!s.convert || busy} zone="import.options.format" />
          </div>
        </div>

        <VideoOptions busy={busy} />

        <div data-zone="import.options.suppression">
          {/* Grisée sans aucune compression ni conversion (demande du 10/11) ; utilisable aussi avec la bibliothèque gérée
              (LIB-02). */}
          <OptionRow
            zone="import.options.suppression"
            checked={s.deleteOriginals}
            disabled={busy || !processing(s)}
            onChange={s.setDeleteOriginals}
            icon={<Trash2 className="h-4 w-4 text-rose-400" />}
            label="Supprimer les originaux"
            info={DELETE_INFO}
          />
        </div>
      </div>
    </section>
  );
}
