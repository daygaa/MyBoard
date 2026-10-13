// Badge du zoom (ZOOM-07, ZOOM-09) : pourcentage de la taille réelle de l'image ou de la vidéo
// (100 % = un pixel du média pour un pixel de l'écran), affiché seulement quand c'est zoomé.
// Placé juste sous le bouton des notes (VIEW-19). Caché avec les autres commandes quand la souris
// est immobile ou hors de l'écran (VIEW-33).

import { useContext } from "react";

import { cn } from "@/lib/utils";
import { idleClass, ViewerChrome } from "./viewerChrome";

export function ZoomBadge({ scale }: { scale: number }) {
  const { idle } = useContext(ViewerChrome);
  return (
    <div
      data-zone="visionneuse.facteur-zoom"
      className={cn(
        "pointer-events-none absolute top-16 left-4 z-20 rounded bg-black/70 px-2 py-1 font-mono text-xs text-white transition-opacity duration-300",
        idleClass(idle),
      )}
    >
      {Math.round(scale * 100)} %
    </div>
  );
}
