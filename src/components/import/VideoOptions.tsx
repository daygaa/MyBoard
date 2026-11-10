// Options vidéo de la carte « Options d'import » : « Compresser les vidéos » et son curseur à 5 crans (IMP-69, IMP-24 :
// sous cette case, choix de l'utilisateur du 11/11), « Convertir les vidéos en » (IMP-22) et son menu, avec un « ⓘ »
// par format (IMP-66). Placées sous « Convertir les images en » (demande du 11/11).

import { Film, Video } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useImport, VIDEO_QUALITY } from "@/stores/import";
import { FormatSelect, VIDEO_FORMATS } from "./FormatSelect";
import { OptionRow } from "./OptionRow";

const COMPRESS_VIDEOS_INFO = [
  "Réencode les vidéos H.264, H.265, VP8, VP9 et AV1 dans leur format, à la qualité choisie. La version compressée est écrite à côté de l'original (« video_c.mp4 ») et n'est gardée que si elle est au moins 5 % plus légère ; l'original n'est jamais modifié.",
  "Résolution, images par seconde, pistes son, sous-titres et informations de la vidéo (date, lieu, appareil) gardés. Anciens formats (MPEG-4 / Xvid, MPEG-2, WMV, FLV…) : jamais compressés, signalés dans le bilan.",
  "Encodage par la carte graphique quand c'est possible (H.264, H.265), sinon par le processeur, plus lent.",
];
const CONVERT_VIDEOS_INFO = [
  "Écrit chaque vidéo dans le format choisi, à côté de l'original (« video.mp4 » ; « video_c.mp4 » si elle est aussi compressée). La qualité de compression s'applique au format choisi ; sans compression : qualité « Haute ».",
  "Vidéo déjà dans le bon format mais dans une autre enveloppe (.mkv, .mov, .avi) : seule l'enveloppe change, en quelques secondes et sans perte. Sinon, la version convertie n'est gardée que si elle est au moins 5 % plus légère.",
  "Pistes son et sous-titres en texte gardés, adaptés au format si besoin.",
];
/** Noms courts sous le curseur, comme la v8. */
const SHORT = ["Min", "Basse", "Moy.", "Haute", "Max"];

export function VideoOptions({ busy }: { busy: boolean }) {
  const s = useImport();
  return (
    <>
      <div data-zone="import.options.compression-video" className="space-y-3">
        <OptionRow
          zone="import.options.compression-video"
          checked={s.compressVideos}
          disabled={busy}
          onChange={s.setCompressVideos}
          icon={<Video className="h-4 w-4 text-emerald-400" />}
          label="Compresser les vidéos"
          info={COMPRESS_VIDEOS_INFO}
        />
        <div className="pl-7">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Qualité vidéo</span>
            <span className="rounded bg-[#d9a94e]/15 px-1.5 py-0.5 font-semibold text-[#d9a94e] select-text">{VIDEO_QUALITY[s.videoQuality]}</span>
          </div>
          <Slider
            data-zone="import.options.qualite-video"
            min={0}
            max={4}
            step={1}
            value={[s.videoQuality]}
            disabled={!s.compressVideos || busy}
            onValueChange={([v]) => s.setVideoQuality(v)}
            aria-label="Qualité vidéo"
            className="data-[disabled]:cursor-not-allowed"
          />
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
            {SHORT.map((label, i) => (
              <span key={label} className={cn(i === s.videoQuality && "font-semibold text-[#d9a94e]")}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div data-zone="import.options.conversion-video" className="space-y-3">
        <OptionRow
          zone="import.options.conversion-video"
          checked={s.convertVideos}
          disabled={busy}
          onChange={s.setConvertVideos}
          icon={<Film className="h-4 w-4 text-[#d9a94e]" />}
          label="Convertir les vidéos en :"
          info={CONVERT_VIDEOS_INFO}
        />
        <div className="pl-7">
          <FormatSelect
            formats={VIDEO_FORMATS}
            value={s.videoTarget}
            onChange={s.setVideoTarget}
            disabled={!s.convertVideos || busy}
            zone="import.options.format-video"
          />
        </div>
      </div>
    </>
  );
}
