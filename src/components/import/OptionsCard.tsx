// Carte « Options d'import » (IMP-30, apparence v8), à droite de la carte Fichiers : « Compresser les images » et sa
// qualité 20–95 (IMP-20, IMP-62), « Convertir les images en » (IMP-21), « Supprimer les originaux » (IMP-28) ; les
// vidéos s'y ajouteront (lot 5). Dernier choix retenu (IMP-29), sauf la suppression des originaux. Bloquée pendant un
// import. Les textes explicatifs de chaque option sont dans son « ⓘ » (demande du 10/11, aussi pour les prochaines).

import type { ReactNode } from "react";
import { Image as ImageIcon, SlidersHorizontal, Trash2, Wand2 } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { InfoTip } from "@/components/ui/info-tip";
import { Slider } from "@/components/ui/slider";
import { keepQuoted } from "@/lib/keepWords";
import { cn } from "@/lib/utils";
import { QUALITY, useImport } from "@/stores/import";
import { FormatSelect } from "./FormatSelect";

/** Ligne d'une option : case, icône, nom, « ⓘ ». Grisée, le nom l'est aussi (demande du 10/11, IMP-28). */
function OptionRow(props: { zone: string; checked: boolean; disabled: boolean; onChange: (on: boolean) => void; icon: ReactNode; label: string; info: string[] }) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex cursor-pointer items-center gap-3 has-disabled:cursor-not-allowed">
        <Checkbox checked={props.checked} disabled={props.disabled} onCheckedChange={(c) => props.onChange(c === true)} />
        <span className={cn("flex items-center gap-2 text-sm font-medium text-foreground", props.disabled && "opacity-50")}>
          {props.icon}
          {props.label}
        </span>
      </label>
      <InfoTip zone={`${props.zone}.info`}>
        {props.info.map((text) => (
          <span key={text} className="block">
            {keepQuoted(text)}
          </span>
        ))}
      </InfoTip>
    </div>
  );
}

const COMPRESS_INFO = [
  "Réencode les JPEG, WebP et PNG à la qualité choisie. La version compressée est écrite à côté de l'original (« photo_c.jpg ») et n'est gardée que si elle est au moins 5 % plus légère ; l'original n'est jamais modifié.",
  "PNG : optimisation sans perte dès que la case est cochée, même à 95 ; à 75 ou moins, 16 bits par couleur ramenés à 8 ; à 50 ou moins, réduction à 256 couleurs.",
  "Résolution, informations de la photo (EXIF) et dates du fichier gardées. Les GIF, BMP, TIFF et images animées ne sont jamais compressés.",
];
const CONVERT_INFO = [
  "Écrit chaque image dans le format choisi, à côté de l'original (« photo.webp » ; « photo_c.webp » si elle est aussi compressée). La qualité de compression s'applique au format choisi ; sans compression : qualité 90.",
  "La version convertie n'est gardée que si elle est au moins 5 % plus légère. En JPG, la transparence est remplacée par un fond blanc. GIF et WebP animés : jamais convertis.",
  "AVIF : écrit par ffmpeg, quelques secondes par photo ; les informations de la photo (EXIF) n'y sont pas gardées.",
];
const DELETE_INFO = [
  "Une fois sa nouvelle version enregistrée, l'original est effacé définitivement du disque, sans passer par la Corbeille. Deux confirmations sont demandées au lancement de l'import.",
  "Case décochée à chaque ouverture de MyBoard.",
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
            info={COMPRESS_INFO}
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
            <FormatSelect value={s.convertTo} onChange={s.setConvertTo} disabled={!s.convert || busy} />
          </div>
        </div>

        <div data-zone="import.options.suppression">
          {/* Grisée sans compression ni conversion (demande du 10/11) ; utilisable aussi avec la bibliothèque gérée (LIB-02). */}
          <OptionRow
            zone="import.options.suppression"
            checked={s.deleteOriginals}
            disabled={busy || !(s.compress || s.convert)}
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
