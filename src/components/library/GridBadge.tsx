// Badge bref en haut de la grille (SEL-08), aspect des badges du lecteur vidéo (VIEW-47).

import { BADGE } from "@/components/viewer/ZoomBadge";
import { cn } from "@/lib/utils";
import { useGridBadge } from "@/stores/badge";

export function GridBadge() {
  const text = useGridBadge((s) => s.text);
  if (text === null) return null;
  return (
    <div data-zone="grille.badge" className={cn("pointer-events-none fixed top-20 left-1/2 z-[60] -translate-x-1/2", BADGE)}>
      {text}
    </div>
  );
}
