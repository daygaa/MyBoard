// Bouton du plein écran total (VIEW-18) : flèches vers l'extérieur pour y entrer, vers
// l'intérieur pour en sortir. Vidéos : tout à droite de la barre de lecture ; autres médias :
// bouton rond en bas à droite de la scène. La touche F fait pareil.

import type { CSSProperties } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

import { useViewer } from "@/stores/viewer";

export function FullscreenButton({ className, style }: { className: string; style?: CSSProperties }) {
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
      style={style}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
