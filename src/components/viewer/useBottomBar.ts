// Plein écran (VIEW-18) : la barre du bas apparaît dès que la souris s'en approche à moins de
// BUFFER pixels, et ne disparaît que quand elle s'en éloigne d'autant (zone tampon) — pas besoin
// de viser exactement la barre. Aussi : hauteur de la barre, et souris immobile (VIEW-33).
// Souris sortie de la fenêtre (vers un autre écran, VIEW-37) : barre et commandes se cachent
// tout de suite ; à son retour, le premier mouvement les fait réapparaître comme d'habitude.

import { useEffect, useState, type RefObject } from "react";

import { isTyping } from "./navigation";

const BUFFER = 60;
/** Délai sans mouvement de la souris avant de cacher les commandes (VIEW-33). */
const IDLE_DELAY = 3000;

export function useBottomBarVisible(ref: RefObject<HTMLElement | null>, active: boolean): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!active) return;
    const onMove = (e: MouseEvent) => {
      const bar = ref.current;
      if (!bar) return;
      // Apparition : à moins de BUFFER du haut de la barre repliée. Affichée, elle reste tant que
      // la souris ne s'éloigne pas de plus de BUFFER de son bord haut réel, barre dépliée comprise
      // (VIEW-43) : sinon ses lignes du haut seraient inaccessibles.
      const foldedTop = window.innerHeight - bar.offsetHeight;
      const shownTop = (bar.firstElementChild ?? bar).getBoundingClientRect().top;
      setVisible((was) => e.clientY >= (was ? Math.min(foldedTop, shownTop) : foldedTop) - BUFFER);
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

/** Vrai pendant une saisie (champ de texte) dans l'élément : en plein écran, la barre du bas reste
 *  alors affichée (VIEW-18). Un bouton qui garde le focus après un clic (« Afficher plus »…) ne
 *  compte pas : la barre restait affichée jusqu'au clic suivant (VIEW-43). */
export function useTypingIn(ref: RefObject<HTMLElement | null>): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setTyping(el.contains(document.activeElement) && isTyping(document.activeElement));
    el.addEventListener("focusin", update);
    el.addEventListener("focusout", update);
    return () => {
      el.removeEventListener("focusin", update);
      el.removeEventListener("focusout", update);
    };
  }, [ref]);
  return typing;
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
