// Échap et bouton 4 de la souris (« retour ») font la même chose (VIEW-03, SEL-01) : fermer
// ce qui est ouvert au premier plan (dialogue, puis visionneuse…). Le bouton 5 (« avance »)
// fait l'inverse (VIEW-30). Quand rien n'est ouvert, les boutons 4 et 5 rouvrent d'abord la
// visionneuse le long du chemin qu'ils ont parcouru (VIEW-27, VIEW-30), sinon ils gardent
// leur rôle normal de retour arrière / avance.
//
// Chaque élément ouvert s'inscrit sur une pile ; seul le dernier inscrit réagit.

import { useEffect, useLayoutEffect, useRef } from "react";

type Handler = () => void;
type Entry = { current: Handler; forward: Handler | null; modal: boolean };
const stack: Entry[] = [];

/** Boutons latéraux de la souris : 4 = « retour » (`button === 3`), 5 = « avance » (`button === 4`). */
const MOUSE_BACK = 3;
const MOUSE_FORWARD = 4;

function top() {
  return stack[stack.length - 1];
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== "Escape" || !top()) return;
  e.preventDefault();
  e.stopPropagation();
  top()?.current();
}

/** Action d'un bouton latéral quand rien n'est ouvert, avant le retour / l'avance normal de la
 *  fenêtre : rouvrir la visionneuse (VIEW-27, VIEW-30). `can` dit si elle s'applique. */
type Fallback = { can: () => boolean; run: () => void };
const fallbacks: Record<number, Fallback | null> = { [MOUSE_BACK]: null, [MOUSE_FORWARD]: null };
const armed: Record<number, boolean> = { [MOUSE_BACK]: false, [MOUSE_FORWARD]: false };

export function setMouseFallbacks(back: Fallback, forward: Fallback) {
  fallbacks[MOUSE_BACK] = back;
  fallbacks[MOUSE_FORWARD] = forward;
}

function onMouse(e: MouseEvent) {
  if (e.button !== MOUSE_BACK && e.button !== MOUSE_FORWARD) return;
  if (!top()) {
    // Décidé à l'appui : c'est là qu'il faut empêcher le retour / l'avance de la fenêtre.
    if (e.type === "mousedown") armed[e.button] = fallbacks[e.button]?.can() ?? false;
    if (!armed[e.button]) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "mouseup") {
      armed[e.button] = false;
      fallbacks[e.button]?.run();
    }
    return;
  }
  // Quelque chose est ouvert : la fenêtre ne change jamais de page sous lui.
  e.preventDefault();
  e.stopPropagation();
  if (e.type !== "mouseup") return;
  if (e.button === MOUSE_BACK) top()?.current();
  else top()?.forward?.();
}

// Phase de capture : réagit avant tout autre élément (menus, champs de saisie…).
window.addEventListener("keydown", onKeyDown, true);
window.addEventListener("mousedown", onMouse, true);
window.addEventListener("mouseup", onMouse, true);
window.addEventListener("auxclick", onMouse, true);

type Options = {
  /** Pop-in qui bloque le reste (les flèches de la visionneuse se taisent tant qu'elle est ouverte). */
  modal?: boolean;
  /** Action du bouton 5 de la souris quand cet élément est au premier plan. */
  onForward?: Handler;
};

/** Inscrit `handler` (Échap, bouton 4) sur la pile tant que `active` est vrai. Renvoie une
 *  fonction qui dit si cet élément est au premier plan. */
export function useEscape(active: boolean, handler: Handler, options: Options = {}): () => boolean {
  const ref = useRef({ handler, onForward: options.onForward });
  const entryRef = useRef<Entry | null>(null);
  const modal = options.modal ?? false;
  const hasForward = options.onForward !== undefined;
  useLayoutEffect(() => {
    ref.current = { handler, onForward: options.onForward };
  });
  useEffect(() => {
    if (!active) return;
    const entry: Entry = {
      current: () => ref.current.handler(),
      forward: hasForward ? () => ref.current.onForward?.() : null,
      modal,
    };
    entryRef.current = entry;
    stack.push(entry);
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      entryRef.current = null;
    };
  }, [active, modal, hasForward]);
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
