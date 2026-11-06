// Image de la visionneuse, zoomable façon wikifeet (ZOOM-01 à ZOOM-07).
// La miniature (déjà prête) s'affiche tout de suite, puis l'image nette (D-016). Image nette (VIEW-53,
// imageCache.ts) : sa copie décodée à la taille de l'écran, affichée aussitôt si elle est prête (sans fondu),
// sinon dès qu'elle l'est (préparée en premier). L'original n'est demandé qu'après 1 s sur l'image, ou dès
// un zoom : à l'écran, la copie est déjà nette ; une image qu'on ne fait que traverser n'est ainsi jamais
// décodée en entier (retour AUT.7.1 : ce décodage, puis sa libération, ralentissaient la navigation rapide).
// Il recouvre la copie une fois décodé (même image à l'écran : rien ne change).
// Les miniatures sont des carrés recadrés au centre (D-013) : elle est donc posée exactement
// sur le carré central de l'image, et le reste apparaît avec l'original.
// Clic droit sur l'image (pas sur le fond) : son menu (CTX-06).

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { THUMB, mediaUrl, thumbUrl, type MediaItem } from "@/lib/api";
import { openContextMenu } from "@/lib/contextMenu";
import { cn } from "@/lib/utils";
import { usePreviewReady } from "@/stores/previews";
import { canCopy, readyBitmap, whenReady } from "./imageCache";
import { imageMenu } from "./mediaMenus";
import { ANIM_MS, useZoom, type Size } from "./useZoom";
import { ZoomBadge } from "./ZoomBadge";

/** Temps passé sur une image avant d'en demander l'original (sans zoom). */
const DWELL_MS = 1000;

export function ImageStage({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  // Dimensions connues par la base (rotation EXIF comprise) ; corrigées au chargement si besoin.
  // Copie décodée : prête à l'ouverture (affichée sans attendre), ou attendue.
  const [bitmap, setBitmap] = useState(() => readyBitmap(item.id));
  const [cachedAtStart] = useState(bitmap !== null);
  const [copyPossible] = useState(() => canCopy(item));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [natural, setNatural] = useState<Size>({ w: item.width ?? 0, h: item.height ?? 0 });
  const [loaded, setLoaded] = useState(cachedAtStart);
  /** Original décodé : la miniature ou la copie, dessous, peut partir. */
  const [decoded, setDecoded] = useState(false);
  /** Original demandé : pas de copie possible, 1 s passée sur l'image, ou zoom. */
  const [wantOriginal, setWantOriginal] = useState(!copyPossible);
  const { view, zoomed, animate, handlers, controls } = useZoom(stageRef, natural, onClose);
  // Copie dessinée avant d'être affichée : elle est à l'écran dès sa première image.
  useLayoutEffect(() => {
    try {
      if (bitmap) canvasRef.current?.getContext("2d")?.drawImage(bitmap, 0, 0);
    } catch {
      // Copie oubliée entre-temps : l'original arrive comme d'habitude.
      setWantOriginal(true);
    }
  }, [bitmap]);
  useEffect(() => {
    if (bitmap || !copyPossible) return;
    return whenReady(item.id, (b) => (b ? setBitmap(b) : setWantOriginal(true)));
  }, [bitmap, copyPossible, item.id]);
  useEffect(() => {
    if (wantOriginal) return;
    const timer = window.setTimeout(() => setWantOriginal(true), DWELL_MS);
    return () => clearTimeout(timer);
  }, [wantOriginal]);
  useEffect(() => {
    if (zoomed) setWantOriginal(true);
  }, [zoomed]);
  const previewReady = usePreviewReady(item.id, 640);
  const side = Math.min(natural.w, natural.h);

  return (
    <div
      ref={stageRef}
      data-zone="visionneuse.image"
      {...handlers}
      // Curseur normal sur le fond (un clic y ferme ou dézoome) ; loupe ou main seulement sur
      // l'image elle-même (VIEW-31).
      className="absolute inset-0 touch-none select-none"
    >
      <div
        className={cn("absolute top-1/2 left-1/2", zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in")}
        onContextMenu={(e) => openContextMenu(e, () => imageMenu(item, controls))}
        style={{
          width: natural.w,
          height: natural.h,
          transform: `translate(-50%, -50%) translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          // Animation uniquement pour le clic (ZOOM-07) ; molette et glisser suivent la main.
          transition: animate ? `transform ${ANIM_MS}ms ease-out` : undefined,
          willChange: "transform",
        }}
      >
        {bitmap && !decoded && (
          <canvas ref={canvasRef} width={bitmap.width} height={bitmap.height} className="absolute inset-0 h-full w-full" />
        )}
        {!bitmap && !decoded && item.thumbStatus === THUMB.ready && side > 0 && (
          <img
            src={thumbUrl(item.hash, previewReady ? "preview" : "normal")}
            alt=""
            draggable={false}
            className="absolute"
            style={{ left: (natural.w - side) / 2, top: (natural.h - side) / 2, width: side, height: side }}
          />
        )}
        <img
          src={wantOriginal ? mediaUrl(item) : undefined}
          alt={item.fileName}
          draggable={false}
          decoding="async"
          onLoad={(e) => {
            const el = e.currentTarget;
            const size = { w: el.naturalWidth, h: el.naturalHeight };
            // Affichée seulement une fois décodée : pas de case vide entre miniature et original.
            void el
              .decode()
              .catch(() => undefined)
              .then(() => {
                setNatural((n) => (n.w === size.w && n.h === size.h ? n : size));
                setLoaded(true);
                setDecoded(true);
              });
          }}
          className={cn("absolute inset-0 h-full w-full", !cachedAtStart && "transition-opacity duration-150")}
          style={{ opacity: loaded ? 1 : 0 }}
        />
      </div>
      {zoomed && <ZoomBadge scale={view.scale} />}
    </div>
  );
}
