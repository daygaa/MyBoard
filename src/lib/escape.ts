// Échap et bouton 4 de la souris (« retour ») font la même chose (VIEW-03, SEL-01) : fermer
// ce qui est ouvert au premier plan (dialogue, puis visionneuse…). Quand rien n'est ouvert,
// le bouton 4 rouvre d'abord la visionneuse qu'on vient de fermer (VIEW-27), sinon il garde
// son rôle normal de retour arrière.
//
// Chaque élément ouvert s'inscrit sur une pile ; seul le dernier inscrit réagit.

import { useEffect, useLayoutEffect, useRef } from "react";

type Handler = () => void;
type Entry = { current: Handler; modal: boolean };
const stack: Entry[] = [];

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

/** Action du bouton 4 quand rien n'est ouvert, avant le retour arrière normal : rouvrir la
 *  visionneuse qu'on vient de fermer (VIEW-27). `can` dit si elle s'applique. */
type BackFallback = { can: () => boolean; run: () => void };
let fallback: BackFallback | null = null;
let fallbackArmed = false;

export function setBackFallback(f: BackFallback) {
  fallback = f;
}

function onMouse(e: MouseEvent) {
  if (e.button !== MOUSE_BACK) return;
  if (!top()) {
    // Décidé à l'appui : c'est là qu'il faut empêcher le retour arrière de la fenêtre.
    if (e.type === "mousedown") fallbackArmed = fallback?.can() ?? false;
    if (!fallbackArmed) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "mouseup") {
      fallbackArmed = false;
      fallback?.run();
    }
    return;
  }
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

/** Inscrit `handler` sur la pile tant que `active` est vrai. `modal` : pop-in qui bloque le
 *  reste (les flèches de la visionneuse se taisent tant qu'elle est ouverte). Renvoie une
 *  fonction qui dit si cet élément est au premier plan. */
export function useEscape(active: boolean, handler: Handler, modal = false): () => boolean {
  const ref = useRef(handler);
  const entryRef = useRef<Entry | null>(null);
  useLayoutEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!active) return;
    const entry = { current: () => ref.current(), modal };
    entryRef.current = entry;
    stack.push(entry);
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      entryRef.current = null;
    };
  }, [active, modal]);
  return () => entryRef.current !== null && top() === entryRef.current;
}

/** Vrai si une pop-in (modale) est ouverte. */
export function hasModalLayer(): boolean {
  return stack.some((e) => e.modal);
}

/** Vrai si quelque chose est ouvert au premier plan (les raccourcis de la grille se taisent). */
export function hasEscapeLayer(): boolean {
  return stack.length > 0;
}
