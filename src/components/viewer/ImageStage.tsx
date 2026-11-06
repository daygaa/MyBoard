// Image de la visionneuse, zoomable façon wikifeet (ZOOM-01 à ZOOM-07).
// La miniature (déjà prête) s'affiche tout de suite, puis l'image nette (D-016). Image nette (VIEW-53,
// imageCache.ts) : sa copie décodée à la taille de l'écran, affichée aussitôt si elle est prête, sinon dès
// qu'elle l'est (préparée en premier). L'original est demandé après 1 s sur l'image, ou dès un zoom (choix de
// l'utilisateur du 06/11) : une image qu'on ne fait que traverser n'est jamais décodée en entier. Fichiers lus
// directement sur le disque par la fenêtre (D-053), sinon par `media://`.
// L'original décodé recouvre la copie d'un coup (même image : rien ne change à l'écran) ou la miniature en fondu ;
// ce qui est dessous n'est retiré qu'une fois l'original opaque à l'écran (retour AUT.7.2 : copie retirée au début
// du fondu, le fond se voyait 0,19 s).
// Les miniatures sont des carrés recadrés au centre (D-013) : elle est donc posée exactement
// sur le carré central de l'image, et le reste apparaît avec l'original.
// Clic droit sur l'image (pas sur le fond) : son menu (CTX-06).

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { THUMB, directUrl, mediaUrl, thumbUrl, type MediaItem } from "@/lib/api";
import { openContextMenu } from "@/lib/contextMenu";
import { cn } from "@/lib/utils";
import { usePreviewReady } from "@/stores/previews";
import { canCopy, pauseCopies, readyBitmap, whenReady } from "./imageCache";
import { imageMenu } from "./mediaMenus";
import { ANIM_MS, useZoom, type Size } from "./useZoom";
import { ZoomBadge } from "./ZoomBadge";

/** Temps passé sur une image avant d'en demander l'original (sans zoom). */
const DWELL_MS = 1000;
/** Fondu de l'original sur la miniature. */
const FADE_MS = 150;

/** `opening` : image ouverte depuis la grille (pas encore de flèche) : sans copie prête, son original est demandé
 *  tout de suite, seul (les copies attendent qu'il soit affiché) : mesuré, nette en ~0,4 s au lieu de 0,63 s
 *  pour la copie, faite en même temps que celles des voisines. */
export function ImageStage({ item, onClose, opening = false }: { item: MediaItem; onClose: () => void; opening?: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null);
  // Copie décodée : prête à l'ouverture (affichée sans attendre), ou attendue.
  const [bitmap, setBitmap] = useState(() => readyBitmap(item.id));
  const [copyPossible] = useState(() => canCopy(item));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Dimensions connues par la base (rotation EXIF comprise) ; corrigées au chargement si besoin.
  const [natural, setNatural] = useState<Size>({ w: item.width ?? 0, h: item.height ?? 0 });
  /** Original décodé, affiché : d'un coup sur la copie, en fondu sur la miniature. */
  const [reveal, setReveal] = useState<"instant" | "fade" | null>(null);
  /** Original opaque à l'écran : la copie ou la miniature, dessous, peut partir. */
  const [covered, setCovered] = useState(false);
  /** Original demandé : pas de copie possible, ouverture sans copie prête, 1 s passée sur l'image, ou zoom. */
  const [wantOriginal, setWantOriginal] = useState(!copyPossible || (opening && bitmap === null));
  /** Lecture directe du fichier impossible : `media://`. */
  const [fallback, setFallback] = useState(false);
  // Ouverture sans copie prête : les copies (voisines comprises) attendent que l'original soit affiché.
  const [openingAlone] = useState(opening && bitmap === null && copyPossible);
  /** Original illisible : la copie reste l'image nette. */
  const [broken, setBroken] = useState(false);
  const holding = openingAlone && !reveal && !broken;
  useEffect(() => {
    if (!holding) return;
    pauseCopies(true);
    return () => pauseCopies(false);
  }, [holding]);
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
    if (bitmap || !copyPossible || covered) return;
    return whenReady(item.id, (b) => (b ? setBitmap(b) : setWantOriginal(true)));
  }, [bitmap, copyPossible, covered, item.id]);
  useEffect(() => {
    if (wantOriginal) return;
    const timer = window.setTimeout(() => setWantOriginal(true), DWELL_MS);
    return () => clearTimeout(timer);
  }, [wantOriginal]);
  useEffect(() => {
    if (zoomed) setWantOriginal(true);
  }, [zoomed]);
  // Dessous retiré une fois l'original peint, opaque : 2 images plus tard, ou à la fin du fondu.
  useEffect(() => {
    if (!reveal) return;
    if (reveal === "fade") {
      const timer = window.setTimeout(() => setCovered(true), FADE_MS + 50);
      return () => clearTimeout(timer);
    }
    let frame = requestAnimationFrame(() => (frame = requestAnimationFrame(() => setCovered(true))));
    return () => cancelAnimationFrame(frame);
  }, [reveal]);
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
        {bitmap && !covered && (
          <canvas ref={canvasRef} width={bitmap.width} height={bitmap.height} className="absolute inset-0 h-full w-full" />
        )}
        {!bitmap && !covered && item.thumbStatus === THUMB.ready && side > 0 && (
          <img
            src={thumbUrl(item.hash, previewReady ? "preview" : "normal")}
            alt=""
            draggable={false}
            className="absolute"
            style={{ left: (natural.w - side) / 2, top: (natural.h - side) / 2, width: side, height: side }}
          />
        )}
        <img
          src={wantOriginal ? (fallback ? mediaUrl(item) : directUrl(item)) : undefined}
          alt={item.fileName}
          draggable={false}
          decoding="async"
          onError={() => {
            if (item.fileUrl && !fallback) setFallback(true);
            else setBroken(true);
          }}
          onLoad={(e) => {
            const el = e.currentTarget;
            const size = { w: el.naturalWidth, h: el.naturalHeight };
            // Affichée seulement une fois décodée : pas de case vide entre miniature (ou copie) et original.
            void el
              .decode()
              .catch(() => undefined)
              .then(() => {
                setNatural((n) => (n.w === size.w && n.h === size.h ? n : size));
                setReveal(canvasRef.current ? "instant" : "fade");
              });
          }}
          className="absolute inset-0 h-full w-full"
          style={{ opacity: reveal ? 1 : 0, transition: reveal === "fade" ? `opacity ${FADE_MS}ms` : undefined }}
        />
      </div>
      {zoomed && <ZoomBadge scale={view.scale} />}
    </div>
  );
}
