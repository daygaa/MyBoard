// Plein écran (VIEW-18) : la barre du bas apparaît dès que la souris s'en approche à moins de
// BUFFER pixels, et ne disparaît que quand elle s'en éloigne d'autant (zone tampon) — pas besoin
// de viser exactement la barre. Aussi : hauteur de la barre, et souris immobile (VIEW-33).

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
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
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

/** Vrai quand la souris n'a pas bougé depuis IDLE_DELAY (seulement si `active`). */
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
    window.addEventListener("mousemove", wake);
    window.addEventListener("pointerdown", wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("pointerdown", wake);
      setIdle(false);
    };
  }, [active]);
  return idle;
}
