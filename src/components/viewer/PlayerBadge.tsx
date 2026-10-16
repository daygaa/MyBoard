// Badge bref des raccourcis du lecteur vidéo (VIEW-47) : « Son coupé », « 1,25× », « Boucle
// activée »… Même aspect que le badge du zoom, en haut au centre. Visible même quand les commandes
// sont cachées (souris immobile, plein écran) : c'est justement là qu'il sert. Disparaît seul.

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { BADGE } from "./ZoomBadge";

const SHOWN_MS = 1200;

export function usePlayerBadge() {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const show = useCallback((next: string) => {
    window.clearTimeout(timer.current);
    setText(next);
    timer.current = window.setTimeout(() => setText(null), SHOWN_MS);
  }, []);
  return { text, show };
}

export function PlayerBadge({ text }: { text: string | null }) {
  if (text === null) return null;
  return (
    <div data-zone="visionneuse.badge-lecteur" className={cn("pointer-events-none absolute top-16 left-1/2 z-20 -translate-x-1/2", BADGE)}>
      {text}
    </div>
  );
}
