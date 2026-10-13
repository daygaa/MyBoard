// Image de la visionneuse, zoomable façon wikifeet (ZOOM-01 à ZOOM-07).
// La miniature (déjà prête) s'affiche tout de suite, puis l'original net la remplace (D-016).
// Les miniatures sont des carrés recadrés au centre (D-013) : elle est donc posée exactement
// sur le carré central de l'image, et le reste apparaît avec l'original.

import { useRef, useState } from "react";

import { THUMB, mediaUrl, thumbUrl, type MediaItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { usePreviews } from "@/stores/previews";
import { ANIM_MS, useZoom, type Size } from "./useZoom";
import { ZoomBadge } from "./ZoomBadge";

export function ImageStage({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  // Dimensions connues par la base (rotation EXIF comprise) ; corrigées au chargement si besoin.
  const [natural, setNatural] = useState<Size>({ w: item.width ?? 0, h: item.height ?? 0 });
  const [loaded, setLoaded] = useState(false);
  const { view, zoomed, animate, handlers } = useZoom(stageRef, natural, onClose);
  const previewReady = usePreviews((s) => s.ready[item.id] === true);
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
        style={{
          width: natural.w,
          height: natural.h,
          transform: `translate(-50%, -50%) translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          // Animation uniquement pour le clic (ZOOM-07) ; molette et glisser suivent la main.
          transition: animate ? `transform ${ANIM_MS}ms ease-out` : undefined,
          willChange: "transform",
        }}
      >
        {!loaded && item.thumbStatus === THUMB.ready && side > 0 && (
          <img
            src={thumbUrl(item.hash, previewReady ? "preview" : "normal")}
            alt=""
            draggable={false}
            className="absolute"
            style={{ left: (natural.w - side) / 2, top: (natural.h - side) / 2, width: side, height: side }}
          />
        )}
        <img
          src={mediaUrl(item)}
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
              });
          }}
          className="absolute inset-0 h-full w-full transition-opacity duration-150"
          style={{ opacity: loaded ? 1 : 0 }}
        />
      </div>
      {zoomed && <ZoomBadge scale={view.scale} />}
    </div>
  );
}
