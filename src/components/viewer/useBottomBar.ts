// Plein écran (VIEW-18) : la barre du bas apparaît dès que la souris s'en approche à moins de
// BUFFER pixels, et ne disparaît que quand elle s'en éloigne d'autant (zone tampon) — pas besoin
// de viser exactement la barre. Aussi : hauteur de la barre, et souris immobile (VIEW-33).
// Souris sortie de la fenêtre (vers un autre écran, VIEW-37) : barre et commandes se cachent
// tout de suite ; à son retour, le premier mouvement les fait réapparaître comme d'habitude.

import { useEffect, useState, type RefObject } from "react";

const BUFFER = 60;
/** Délai sans mouvement de la souris avant de cacher les commandes (VIEW-33). */
const IDLE_DELAY = 3000;

export function useBottomBarVisible(ref: RefObject<HTMLElement | null>, active: boolean): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!active) return;
    const onMove = (e: MouseEvent) => {
      const bar = ref.current;
      if (bar) setVisible(e.clientY >= window.innerHeight - bar.offsetHeight - BUFFER);
    };
    const onLeave = () => setVisible(false);
    window.addEventListener("mousemove", onMove);
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      setVisible(false);
    };
  }, [ref, active]);
  return visible;
}

/** Hauteur d'un élément, tenue à jour. */
export function useHeight(ref: RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    setHeight(el.offsetHeight);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}

/** Vrai quand la souris n'a pas bougé depuis IDLE_DELAY, ou dès qu'elle sort de la fenêtre
 *  (seulement si `active`). */
export function useIdle(active: boolean): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (!active) return;
    let timer = setTimeout(() => setIdle(true), IDLE_DELAY);
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), IDLE_DELAY);
    };
    const leave = () => {
      clearTimeout(timer);
      setIdle(true);
    };
    window.addEventListener("mousemove", wake);
    window.addEventListener("pointerdown", wake);
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("pointerdown", wake);
      document.documentElement.removeEventListener("mouseleave", leave);
      setIdle(false);
    };
  }, [active]);
  return idle;
}
