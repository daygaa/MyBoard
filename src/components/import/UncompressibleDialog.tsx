// Pop-in des fichiers qu'on ne peut pas compresser (IMP-85, réponses du 13/11) : au clic sur « Importer », « Compresser
// les images » (ou « … les vidéos ») cochée, quand la liste contient des fichiers que MyBoard ne sait pas compresser dans
// leur format (images BMP, TIFF, HEIF / HEIC, TGA, QOI ; vidéos d'anciens formats ou de conteneurs non pris en charge). Seules
// les extensions de l'import en cours sont citées ; la liste des formats part toujours sur JPG / MP4 standard (Q9 B).
// - Une seule ligne (images OU vidéos) : « Oui » / « Non » lancent l'import, avec ou sans conversion ; la croix et Échap
//   ferment sans importer (Q10 A).
// - Deux lignes : une case « Oui » et une case « Non » par ligne, décochées au départ (cocher l'une décoche l'autre),
//   puis « Confirmer » / « Annuler » ; « Confirmer » grisé tant qu'une ligne n'a pas sa réponse, avec une bulle (Q11, Q13).
// Avant elle, si des vidéos de la liste ne sont pas encore lues (lecture anticipée, Q12 A) : « Vérification des
// vidéos… », qui attend la fin de leur lecture.
// Disposition (réponse Q16 A du 14/11) : un tableau aligné, une ligne par type (type, extensions, « Convertir en » et
// son menu, cases « Oui » / « Non » s'il y a deux lignes), sous une phrase commune.
// « ⓘ » de chaque ligne (IMP-93) : bulles de conversion de la carte des options, adaptées à cette pop-in ; comme dans
// la carte, « ; l'original n'est jamais modifié » disparaît quand « Supprimer les originaux » est cochée.

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import { api, type ImageTarget, type ImportOptions, type Uncompressible, type VideoTarget } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useImport } from "@/stores/import";
import { FormatSelect, IMAGE_FORMATS, VIDEO_FORMATS } from "./FormatSelect";
import { InfoLines, withOriginals } from "./OptionRow";

const GOLD = "bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]";
const OUTLINE = "border-border text-foreground hover:bg-secondary hover:text-foreground";

/** Réponse : format choisi pour chaque type (`null` : « Non », ou type absent). */
export type UncompressibleAnswer = { images: ImageTarget | null; videos: VideoTarget | null };

const IMAGES_INFO = [
  "« Oui » : chaque image citée est réencodée dans le format choisi, à la qualité de « Compresser les images », et enregistrée à côté de l'original ; l'original n'est jamais modifié.",
  "En JPG, la transparence est remplacée par un fond blanc. Les métadonnées sont conservées.",
  "« Non » : ces images sont importées telles quelles.",
];
const VIDEOS_INFO = [
  "« Oui » : chaque vidéo citée est réencodée dans le format choisi, à la qualité de « Compresser les vidéos », et enregistrée à côté de l'original ; l'original n'est jamais modifié.",
  "Une vidéo avec le même codec mais un container différent (H.265 en .mkv par exemple) ne change que son container.",
  "Résolution, IPS, pistes son, sous-titres et métadonnées sont conservés.",
  "« Non » : ces vidéos sont importées telles quelles, signalées dans le bilan.",
];

/** « .heif .tga » */
const listed = (exts: string[]) => exts.map((e) => `.${e}`).join(" ");

/** Attend la fin de la lecture anticipée des vidéos ; `onReady` reçoit la liste complète, `onCancel` : rien ne démarre. */
export function VideoCheckWait({
  options,
  first,
  onReady,
  onCancel,
}: {
  options: ImportOptions;
  first: Uncompressible;
  onReady: (found: Uncompressible) => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState(first);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const found = await api.uncompressibleFiles(options).catch(() => null);
      if (!alive) return;
      if (found && found.videosLeft === 0) return onReady(found);
      if (found) setState(found);
      window.setTimeout(() => void tick(), 400);
    };
    const timer = window.setTimeout(() => void tick(), 400);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // Une seule boucle pour la durée de la pop-in (options et réponse fixées à son ouverture).
  }, []);
  const read = state.videosTotal - state.videosLeft;
  return (
    <Modal
      open
      zone="import.verification-videos"
      onClose={onCancel}
      title="Vérification des vidéos…"
      description={`${formatNumber(read)} / ${formatNumber(state.videosTotal)} vidéos lues : MyBoard regarde lesquelles il peut compresser.`}
      footer={
        <Button variant="ghost" onClick={onCancel} className="text-foreground hover:bg-secondary hover:text-foreground">
          Annuler
        </Button>
      }
    />
  );
}

type Props = {
  found: Uncompressible;
  onAnswer: (answer: UncompressibleAnswer) => void;
  /** Croix, Échap, « Annuler » : l'import ne démarre pas. */
  onCancel: () => void;
};

export function UncompressibleDialog({ found, onAnswer, onCancel }: Props) {
  const [imageTarget, setImageTarget] = useState<ImageTarget>(IMAGE_FORMATS[0].value);
  const [videoTarget, setVideoTarget] = useState<VideoTarget>(VIDEO_FORMATS[0].value);
  const hasImages = found.images.length > 0;
  const hasVideos = found.videos.length > 0;
  const both = hasImages && hasVideos;
  const deleteOriginals = useImport((s) => s.deleteOriginals);
  /** Deux lignes : réponse de chaque ligne (`null` : pas encore choisie). */
  const [imageYes, setImageYes] = useState<boolean | null>(null);
  const [videoYes, setVideoYes] = useState<boolean | null>(null);

  const answer = (images: boolean, videos: boolean) =>
    onAnswer({ images: hasImages && images ? imageTarget : null, videos: hasVideos && videos ? videoTarget : null });

  /** Une ligne du tableau (grille commune : colonnes alignées d'une ligne à l'autre). */
  const row = (kind: "images" | "videos") => {
    const images = kind === "images";
    return (
      <div data-zone={`import.non-compressibles.${kind}`} className="col-span-full grid grid-cols-subgrid items-center">
        <span className="font-medium text-foreground">{images ? "Images" : "Vidéos"}</span>
        <span data-zone={`import.non-compressibles.${kind}.extensions`} className="break-words">
          {listed(images ? found.images : found.videos)}
        </span>
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap">Convertir en</span>
          <div className="w-60">
            {images ? (
              <FormatSelect formats={IMAGE_FORMATS} value={imageTarget} onChange={setImageTarget} disabled={false} zone="import.non-compressibles.format" />
            ) : (
              <FormatSelect formats={VIDEO_FORMATS} value={videoTarget} onChange={setVideoTarget} disabled={false} zone="import.non-compressibles.format-video" />
            )}
          </div>
          <InfoLines zone={`import.non-compressibles.${kind}.info`} lines={withOriginals(images ? IMAGES_INFO : VIDEOS_INFO, deleteOriginals)} />
        </div>
        {both && (
          <div className="flex items-center gap-4">
            {([true, false] as const).map((yes) => {
              const value = images ? imageYes : videoYes;
              const set = images ? setImageYes : setVideoYes;
              return (
                <label key={String(yes)} className="flex cursor-pointer items-center gap-2 text-foreground">
                  <Checkbox
                    data-zone={`import.non-compressibles.${kind}.${yes ? "oui" : "non"}`}
                    checked={value === yes}
                    onCheckedChange={(c) => set(c === true ? yes : null)}
                  />
                  {yes ? "Oui" : "Non"}
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const ready = imageYes !== null && videoYes !== null;
  return (
    <Modal
      open
      size="xl"
      zone="import.non-compressibles"
      onClose={onCancel}
      onEnter={() => (both ? ready && answer(imageYes, videoYes) : answer(true, true))}
      title="Fichiers impossibles à compresser"
      description="MyBoard ne sait pas compresser certains formats. Voulez-vous les convertir ?"
      footer={
        both ? (
          <>
            <Button variant="ghost" onClick={onCancel} className="text-foreground hover:bg-secondary hover:text-foreground">
              Annuler
            </Button>
            <span className={ready ? undefined : "cursor-not-allowed"} title={ready ? undefined : "Choisissez Oui ou Non pour chaque ligne"}>
              <Button data-zone="import.non-compressibles.confirmer" disabled={!ready} onClick={() => ready && answer(imageYes, videoYes)} className={GOLD}>
                Confirmer
              </Button>
            </span>
          </>
        ) : (
          <>
            <Button data-zone="import.non-compressibles.non" variant="outline" onClick={() => answer(false, false)} className={OUTLINE}>
              Non
            </Button>
            <Button data-zone="import.non-compressibles.oui" onClick={() => answer(true, true)} className={GOLD}>
              Oui
            </Button>
          </>
        )
      }
    >
      <div
        data-zone="import.non-compressibles.tableau"
        className={`grid items-center gap-x-5 gap-y-3 text-sm text-muted-foreground ${both ? "grid-cols-[auto_minmax(0,1fr)_auto_auto]" : "grid-cols-[auto_minmax(0,1fr)_auto]"}`}
      >
        {hasImages && row("images")}
        {hasVideos && row("videos")}
      </div>
    </Modal>
  );
}
