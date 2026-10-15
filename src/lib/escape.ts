// Échap et bouton 4 de la souris (« retour ») font la même chose (VIEW-03, SEL-01) : fermer
// ce qui est ouvert au premier plan (dialogue, puis visionneuse…). Le bouton 5 (« avance »)
// fait l'inverse (VIEW-30). Quand rien n'est ouvert, les boutons 4 et 5 rouvrent d'abord la
// visionneuse le long du chemin qu'ils ont parcouru (VIEW-27, VIEW-30), sinon ils gardent
// leur rôle normal de retour arrière / avance.
//
// Chaque élément ouvert s'inscrit sur une pile ; seul le dernier inscrit réagit.
// Les flèches de la barre de titre (NAV-04) font exactement la même chose (`goBack`, `goForward`)
// et se grisent quand le bouton correspondant ne ferait rien (`canGoBack`, `canGoForward`).
// Un élément « Échap seulement » (liste des suggestions) est ignoré par les boutons 4 / 5 et les
// flèches : ils agissent sur ce qui est dessous (NAV-07).

import { useEffect, useLayoutEffect, useRef } from "react";

type Handler = () => void;
type Entry = {
  current: Handler;
  forward: Handler | null;
  canForward: (() => boolean) | null;
  modal: boolean;
  escapeOnly: boolean;
};
const stack: Entry[] = [];

/** Abonnés prévenus quand un élément s'ouvre ou se ferme (flèches de la barre de titre). */
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());

export function onStackChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Boutons latéraux de la souris : 4 = « retour » (`button === 3`), 5 = « avance » (`button === 4`). */
const MOUSE_BACK = 3;
const MOUSE_FORWARD = 4;

function top() {
  return stack[stack.length - 1];
}

/** Élément au premier plan pour les boutons 4 / 5 et les flèches (sans les « Échap seulement »). */
function navTop(): Entry | undefined {
  for (let i = stack.length - 1; i >= 0; i--) if (!stack[i].escapeOnly) return stack[i];
  return undefined;
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
  const entry = navTop();
  if (!entry) {
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
  if (e.button === MOUSE_BACK) entry.current();
  else entry.forward?.();
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
  /** `onForward` ferait-il quelque chose en ce moment ? (flèche grisée sinon) */
  canForward?: () => boolean;
  /** Seule Échap le ferme : les boutons 4 / 5 et les flèches l'ignorent (suggestions, NAV-07). */
  escapeOnly?: boolean;
};

/** Inscrit `handler` (Échap, bouton 4) sur la pile tant que `active` est vrai. Renvoie une
 *  fonction qui dit si cet élément est au premier plan. */
export function useEscape(active: boolean, handler: Handler, options: Options = {}): () => boolean {
  const ref = useRef({ handler, onForward: options.onForward, canForward: options.canForward });
  const entryRef = useRef<Entry | null>(null);
  const modal = options.modal ?? false;
  const escapeOnly = options.escapeOnly ?? false;
  const hasForward = options.onForward !== undefined;
  const hasCanForward = options.canForward !== undefined;
  useLayoutEffect(() => {
    ref.current = { handler, onForward: options.onForward, canForward: options.canForward };
  });
  useEffect(() => {
    if (!active) return;
    const entry: Entry = {
      current: () => ref.current.handler(),
      forward: hasForward ? () => ref.current.onForward?.() : null,
      canForward: hasCanForward ? () => ref.current.canForward?.() ?? true : null,
      modal,
      escapeOnly,
    };
    entryRef.current = entry;
    stack.push(entry);
    changed();
    return () => {
      const i = stack.indexOf(entry);
      if (i >= 0) stack.splice(i, 1);
      entryRef.current = null;
      changed();
    };
  }, [active, modal, escapeOnly, hasForward, hasCanForward]);
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

/** Historique de la fenêtre (API « Navigation » de WebView2) ; absent : supposé possible. */
type HistoryState = { canGoBack: boolean; canGoForward: boolean };
const history_ = () => (window as unknown as { navigation?: HistoryState }).navigation;

/** Ce que ferait le bouton 4 de la souris : y a-t-il quelque chose à faire ? */
export function canGoBack(): boolean {
  if (navTop()) return true;
  return (fallbacks[MOUSE_BACK]?.can() ?? false) || (history_()?.canGoBack ?? true);
}

/** Ce que ferait le bouton 5 de la souris : y a-t-il quelque chose à faire ? */
export function canGoForward(): boolean {
  const entry = navTop();
  if (entry) return entry.forward !== null && (entry.canForward?.() ?? true);
  return (fallbacks[MOUSE_FORWARD]?.can() ?? false) || (history_()?.canGoForward ?? true);
}

/** Flèche « précédent » de la barre de titre = bouton 4 de la souris. */
export function goBack() {
  const entry = navTop();
  const fallback = fallbacks[MOUSE_BACK];
  if (entry) entry.current();
  else if (fallback?.can()) fallback.run();
  else window.history.back();
}

/** Flèche « suivant » de la barre de titre = bouton 5 de la souris. */
export function goForward() {
  const entry = navTop();
  const fallback = fallbacks[MOUSE_FORWARD];
  if (entry) entry.forward?.();
  else if (fallback?.can()) fallback.run();
  else window.history.forward();
}
