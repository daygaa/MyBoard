// Plein écran (VIEW-18) : la barre du bas apparaît dès que la souris s'en approche à moins de
// BUFFER pixels, et ne disparaît que quand elle s'en éloigne d'autant (zone tampon) — pas besoin
// de viser exactement la barre.

import { useEffect, useState, type RefObject } from "react";

const BUFFER = 60;

export function useBottomBarVisible(ref: RefObject<HTMLElement | null>, active: boolean): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!active) return;
    const onMove = (e: MouseEvent) => {
      const bar = ref.current;
      if (bar) setVisible(e.clientY >= window.innerHeight - bar.offsetHeight - BUFFER);
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      setVisible(false);
    };
  }, [ref, active]);
  return visible;
}
