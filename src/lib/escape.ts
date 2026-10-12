// Échap et bouton 4 de la souris (« retour ») font la même chose (VIEW-03, SEL-01) : fermer
// ce qui est ouvert au premier plan (dialogue, puis visionneuse…). Quand rien n'est ouvert,
// le bouton 4 garde son rôle normal de retour arrière.
//
// Chaque élément ouvert s'inscrit sur une pile ; seul le dernier inscrit réagit.

import { useEffect, useLayoutEffect, useRef } from "react";

type Handler = () => void;
const stack: { current: Handler }[] = [];

/** Bouton « retour » de la souris (bouton 4) : `button === 3` dans les événements souris. */
const MOUSE_BACK = 3;

function top() {
  return stack[stack.length - 1];
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== "Escape" || !top()) return;
  e.preventDefault();
  e.stopPropagation();
  top()?.current();
}

function onMouse(e: MouseEvent) {
  if (e.button !== MOUSE_BACK || !top()) return;
  // Empêche le retour arrière de la fenêtre : le bouton sert à fermer.
  e.preventDefault();
  e.stopPropagation();
  if (e.type === "mouseup") top()?.current();
}

// Phase de capture : réagit avant tout autre élément (menus, champs de saisie…).
window.addEventListener("keydown", onKeyDown, true);
window.addEventListener("mousedown", onMouse, true);
window.addEventListener("mouseup", onMouse, true);
window.addEventListener("auxclick", onMouse, true);

/** Inscrit `handler` sur la pile tant que `active` est vrai. Renvoie une fonction qui dit si
 *  cet élément est au premier plan (ex. les flèches de la visionneuse se taisent quand une
 *  pop-in est ouverte par-dessus). */
export function useEscape(active: boolean, handler: Handler): () => boolean {
  const ref = useRef(handler);
  const entryRef = useRef<{ current: Handler } | null>(null);
  useLayoutEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!active) return;
    const entry = { current: () => ref.current() };
    entryRef.current = entry;
    stack.push(entry);
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      entryRef.current = null;
    };
  }, [active]);
  return () => entryRef.current !== null && top() === entryRef.current;
}

/** Vrai si quelque chose est ouvert au premier plan (les raccourcis de la grille se taisent). */
export function hasEscapeLayer(): boolean {
  return stack.length > 0;
}
