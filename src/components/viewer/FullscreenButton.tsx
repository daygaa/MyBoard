// Bouton du plein écran total (VIEW-18) : flèches vers l'extérieur pour y entrer, vers
// l'intérieur pour en sortir. Vidéos : tout à droite de la barre de lecture ; autres médias :
// bouton rond en bas à droite de la scène. La touche F fait pareil.
// `ring` (bouton rond des images) : contour doré tant que le plein écran est actif, et seulement
// à ce moment-là. Le contour de focus du navigateur, qui apparaissait au hasard après un clic
// puis F, est retiré des deux boutons.

import type { CSSProperties } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

import { useViewer } from "@/stores/viewer";

/** Le contour de focus du navigateur (même rendu), couleur d'accent à 50 %. */
const RING = "auto 1px color-mix(in oklab, var(--ring) 50%, transparent)";

export function FullscreenButton({ className, style, ring = false }: { className: string; style?: CSSProperties; ring?: boolean }) {
  const fullscreen = useViewer((s) => s.fullscreen);
  const setFullscreen = useViewer((s) => s.setFullscreen);
  const label = fullscreen ? "Quitter le plein écran (F)" : "Plein écran (F)";
  const Icon = fullscreen ? Minimize2 : Maximize2;
  return (
    <button
      type="button"
      data-zone="visionneuse.plein-ecran"
      onClick={() => setFullscreen(!fullscreen)}
      aria-label={label}
      title={label}
      className={className}
      style={{ ...style, outline: ring && fullscreen ? RING : "none" }}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
