// Pop-in des fichiers qu'on ne peut pas compresser (IMP-85, réponses du 13/11) : au clic sur « Importer », « Compresser
// les images » (ou « … les vidéos ») cochée, quand la liste contient des fichiers que MyBoard ne sait pas compresser dans
// leur format (images BMP, TIFF, HEIF / HEIC, DNG ; vidéos d'anciens formats ou de conteneurs non pris en charge). Seules
// les extensions de l'import en cours sont citées ; la liste des formats part toujours sur JPG / MP4 standard (Q9 B).
// - Une seule ligne (images OU vidéos) : « Oui » / « Non » lancent l'import, avec ou sans conversion ; la croix et Échap
//   ferment sans importer (Q10 A).
// - Deux lignes : une case « Oui » et une case « Non » par ligne, décochées au départ (cocher l'une décoche l'autre),
//   puis « Confirmer » / « Annuler » ; « Confirmer » grisé tant qu'une ligne n'a pas sa réponse, avec une bulle (Q11, Q13).
// Avant elle, si des vidéos de la liste ne sont pas encore lues (lecture anticipée, Q12 A) : « Vérification des
// vidéos… », qui attend la fin de leur lecture.

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import { api, type ImageTarget, type ImportOptions, type Uncompressible, type VideoTarget } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { FormatSelect, IMAGE_FORMATS, VIDEO_FORMATS } from "./FormatSelect";

const GOLD = "bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]";
const OUTLINE = "border-border text-foreground hover:bg-secondary hover:text-foreground";

/** Réponse : format choisi pour chaque type (`null` : « Non », ou type absent). */
export type UncompressibleAnswer = { images: ImageTarget | null; videos: VideoTarget | null };

/** « .heif, .dng » */
const listed = (exts: string[]) => exts.map((e) => `.${e}`).join(", ");

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
  /** Deux lignes : réponse de chaque ligne (`null` : pas encore choisie). */
  const [imageYes, setImageYes] = useState<boolean | null>(null);
  const [videoYes, setVideoYes] = useState<boolean | null>(null);

  const answer = (images: boolean, videos: boolean) =>
    onAnswer({ images: hasImages && images ? imageTarget : null, videos: hasVideos && videos ? videoTarget : null });

  const line = (kind: "images" | "videos") => {
    const images = kind === "images";
    return (
      <div data-zone={`import.non-compressibles.${kind}`} className="flex flex-col gap-2">
        <span className="block">
          MyBoard ne peut pas compresser les fichiers {listed(images ? found.images : found.videos)}, souhaitez-vous les convertir en :
        </span>
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-60">
            {images ? (
              <FormatSelect formats={IMAGE_FORMATS} value={imageTarget} onChange={setImageTarget} disabled={false} zone="import.non-compressibles.format" />
            ) : (
              <FormatSelect formats={VIDEO_FORMATS} value={videoTarget} onChange={setVideoTarget} disabled={false} zone="import.non-compressibles.format-video" />
            )}
          </div>
          {both && (
            <>
              {([true, false] as const).map((yes) => {
                const value = images ? imageYes : videoYes;
                const set = images ? setImageYes : setVideoYes;
                return (
                  <label key={String(yes)} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      data-zone={`import.non-compressibles.${kind}.${yes ? "oui" : "non"}`}
                      checked={value === yes}
                      onCheckedChange={(c) => set(c === true ? yes : null)}
                    />
                    {yes ? "Oui" : "Non"}
                  </label>
                );
              })}
            </>
          )}
        </div>
      </div>
    );
  };

  const ready = imageYes !== null && videoYes !== null;
  return (
    <Modal
      open
      size="lg"
      zone="import.non-compressibles"
      onClose={onCancel}
      onEnter={() => (both ? ready && answer(imageYes, videoYes) : answer(true, true))}
      title="Fichiers impossibles à compresser"
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
      <div className="flex flex-col gap-5 text-sm text-muted-foreground">
        {hasImages && line("images")}
        {hasVideos && line("videos")}
      </div>
    </Modal>
  );
}
