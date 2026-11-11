// Options vidéo de la carte « Options d'import » : « Compresser les vidéos » et son curseur à 5 crans (IMP-69, IMP-24 :
// sous cette case, choix de l'utilisateur du 11/11), « Convertir les vidéos en » (IMP-22) et son menu, avec un « ⓘ »
// par format (IMP-66). Placées sous « Convertir les images en » (demande du 11/11).

import { Film, Video } from "lucide-react";

import { useImport } from "@/stores/import";
import { FormatSelect, VIDEO_FORMATS } from "./FormatSelect";
import { OptionRow, withOriginals } from "./OptionRow";
import { VideoQualitySlider } from "./VideoQualitySlider";

// Textes des « ⓘ » : ceux de l'utilisateur (IMP-71, 11/11), une ligne par retour à la ligne.
const COMPRESS_VIDEOS_INFO = [
  "Réencode les vidéos H.264, H.265, VP8, VP9 et AV1 dans leur format, à la qualité choisie.",
  "La version compressée est enregistrée à côté de l'original et n'est conservée que si elle est au moins 5 % plus légère ; l'original n'est jamais modifié.",
  "Résolution, IPS, pistes son, sous-titres et métadonnées sont conservés.",
  "Anciens formats et formats déjà compressés (MPEG-4 / Xvid, MPEG-2, WMV, FLV…) : jamais compressés, signalés dans le bilan.",
  "Encodage via CPU par défaut et via GPU si disponible car plus rapide.",
];
const CONVERT_VIDEOS_INFO = [
  "Réencode chaque vidéo dans le format choisi, à côté de l'original.",
  "Si la compression est activée, elle s'applique au format choisi ; sans compression : qualité maximale.",
  "Une vidéo avec le même codec mais un container différent (H.265 en .mkv par exemple) ne change que son container.",
  "Les métadonnées sont conservées.",
];

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
          info={withOriginals(COMPRESS_VIDEOS_INFO, s.deleteOriginals)}
        />
        <div className="pl-7">
          <VideoQualitySlider zone="import.options.qualite-video" value={s.videoQuality} onChange={s.setVideoQuality} disabled={!s.compressVideos || busy} />
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
