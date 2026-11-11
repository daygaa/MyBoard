// Bouton « Ouvrir avec l'application par défaut » (VIEW-24) : format que le lecteur intégré ne sait pas lire, documents.
// `secondary` : à côté du bouton doré « Convertir » d'une vidéo illisible (VIEW-25), en contour.

import { ExternalLink } from "lucide-react";

import { api, type MediaItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { runExternal } from "./externalOpen";

export function OpenExternally({ item, secondary = false }: { item: MediaItem; secondary?: boolean }) {
  return (
    <button
      type="button"
      data-zone="visionneuse.ouvrir-externe"
      onClick={() => void runExternal("Ouvrir avec l'application par défaut", () => api.openMedia(item.id))}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
        secondary
          ? "border border-border text-foreground hover:bg-secondary"
          : "mt-4 bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]",
      )}
    >
      <ExternalLink className="h-4 w-4" />
      Ouvrir avec l'application par défaut
    </button>
  );
}
