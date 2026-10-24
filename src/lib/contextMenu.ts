// Menus du clic droit (GEN-12, CTX-01) : un seul menu ouvert à la fois, dessiné par
// `ContextMenuHost` (components/ui/context-menu.tsx). Le menu du navigateur (Retour, Actualiser,
// Enregistrer sous, Imprimer) n'apparaît jamais : un clic droit là où MyBoard n'a pas de menu
// n'ouvre rien. Sans rien à faire dans leurs composants : les champs de saisie ont le menu
// d'édition (CTX-03), un texte sélectionné le menu « Copier » (CTX-18) — voir `textMenus.ts`.
//
// Un élément ouvre son menu avec `onContextMenu={(e) => openContextMenu(e, () => [...])}` ; les
// entrées sont calculées au clic droit seulement (aucun coût par vignette, D-008). Le plus précis
// gagne : le premier élément qui ouvre un menu pendant un clic droit (le plus profond) le garde.

import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { create } from "zustand";

import { textMenuFor } from "./textMenus";

/** Confirmation demandée avant d'agir (CTX-02) ; `danger` : bouton « Oui » rouge. */
export type Confirm = { title: string; message: ReactNode; danger?: boolean };

export type MenuItem = {
  label: string;
  /** Action. Absente (et sans sous-menu) : entrée grisée, fonction pas encore là. */
  run?: () => void;
  /** Entrée grisée (sans objet ici). */
  disabled?: boolean;
  /** Raccourci affiché en gris à droite, seulement là où il fonctionne (CTX-01). */
  shortcut?: string;
  /** Action dangereuse : en rouge, en dernier, avec confirmation (CTX-01). */
  danger?: boolean;
  /** Entrée cochée ou non (ex. lecture en boucle), « partial » : à moitié (une partie de la sélection,
   *  SEL-08.1) ; absente : pas de case. */
  checked?: boolean | "partial";
  /** Précision en gris à droite, comme un raccourci (« 7 / 20 », SEL-08.1). */
  detail?: string;
  /** Pastille de couleur avant le libellé (catégories). */
  color?: string;
  confirm?: Confirm;
  /** Pop-in plus riche qu'une confirmation (suppression avec sa case, DEL-04), dessinée par le menu :
   *  `onCancel` la ferme et laisse le menu ouvert (CTX-02), `onDone` ferme tout. */
  dialog?: (close: { onCancel: () => void; onDone: () => void }) => ReactNode;
  /** Sous-menu « ▸ » (un seul niveau). */
  submenu?: MenuEntry[];
};

/** « separator » : trait entre deux groupes d'entrées (« ‖ » dans la SPEC). */
export type MenuEntry = MenuItem | "separator";

/** Élément sur lequel le menu a été ouvert, et place du point d'ouverture dans cet élément (en part
 *  de sa largeur et de sa hauteur) : quand la fenêtre change de taille sous une pop-in, le menu suit
 *  cet élément (une vignette change de place et de taille, retour du 24/10, point AUT.14). */
export type MenuAnchor = { el: Element; fx: number; fy: number };

export type OpenMenu = {
  /** Point d'ouverture, en pixels de la fenêtre. */
  x: number;
  y: number;
  entries: MenuEntry[];
  /** Ouvert au clavier : la première entrée est déjà choisie (comme sous Windows). */
  keyboard: boolean;
  /** Change à chaque ouverture : le menu est recréé (sélection, sous-menu remis à zéro). */
  id: number;
  /** Ouvert au-dessus du point (liste du bouton Dossier de la visionneuse, FOLD-09). */
  above?: boolean;
  /** Qui l'a ouvert, quand ça compte (barre du bas de la visionneuse : elle reste affichée). */
  owner?: string;
  anchor?: MenuAnchor;
};

export const useContextMenu = create<{ menu: OpenMenu | null }>(() => ({ menu: null }));

let nextId = 1;
/** Clic droit déjà servi par un élément plus précis. */
let handled: Event | null = null;

export function isContextMenuOpen(): boolean {
  return useContextMenu.getState().menu !== null;
}

export function closeContextMenu() {
  if (isContextMenuOpen()) useContextMenu.setState({ menu: null });
}

function anchorAt(el: Element | null, x: number, y: number): MenuAnchor | undefined {
  const box = el?.getBoundingClientRect();
  if (!el || !box?.width || !box.height) return undefined;
  return { el, fx: (x - box.left) / box.width, fy: (y - box.top) / box.height };
}

/** Point du menu d'après son élément ; `null` si l'élément n'est plus affiché (vignette sortie de la
 *  grille…). */
export function anchorPoint({ el, fx, fy }: MenuAnchor): { x: number; y: number } | null {
  const box = el.isConnected ? el.getBoundingClientRect() : null;
  if (!box?.width || !box.height) return null;
  return { x: box.left + fx * box.width, y: box.top + fy * box.height };
}

/** Élément qui ouvre le menu : celui qui écoute le clic droit (la vignette), sinon l'élément cliqué. */
function owner(e: ReactMouseEvent | MouseEvent): Element | null {
  const el = "nativeEvent" in e ? e.currentTarget : e.target;
  return el instanceof Element ? el : null;
}

/** Point d'ouverture : celui du clic. Menu ouvert au clavier (touche Menu, Maj + F10 : ce n'est
 *  pas le bouton droit) : sous le coin haut gauche de l'élément si le point reçu n'est pas dessus. */
function anchorOf(e: MouseEvent, el: Element | null): { x: number; y: number; keyboard: boolean; anchor?: MenuAnchor } {
  const keyboard = e.button !== 2;
  const box = e.target instanceof Element ? e.target.getBoundingClientRect() : null;
  const inside = box && e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
  const [x, y] = keyboard && box && !inside ? [box.left, box.bottom] : [e.clientX, e.clientY];
  return { x, y, keyboard, anchor: anchorAt(el, x, y) };
}

function show(e: MouseEvent, entries: MenuEntry[], el: Element | null) {
  useContextMenu.setState({ menu: { ...anchorOf(e, el), entries, id: nextId++ } });
}

/** Ouvre un menu à un point de la fenêtre, sans clic droit (Alt + Espace : menu de la fenêtre,
 *  CTX-13 ; menu ⋮ d'un dossier ; bouton Dossier de la visionneuse) ; `keyboard` : la première entrée
 *  est déjà choisie ; `anchor` : l'élément qui l'ouvre (le menu le suit, AUT.14). */
export function openMenuAt(
  x: number,
  y: number,
  entries: MenuEntry[],
  keyboard: boolean,
  { anchor, ...options }: { above?: boolean; owner?: string; anchor?: Element } = {},
) {
  useContextMenu.setState({ menu: { x, y, entries, keyboard, id: nextId++, anchor: anchorAt(anchor ?? null, x, y), ...options } });
}

/** Ouvre le menu de l'élément. Sans effet sur un champ de saisie ou un texte sélectionné : leur
 *  menu (édition, « Copier ») passe avant. */
export function openContextMenu(e: ReactMouseEvent | MouseEvent, entries: () => MenuEntry[]) {
  const native = "nativeEvent" in e ? e.nativeEvent : e;
  if (handled === native || textMenuFor(native)) return;
  handled = native;
  show(native, entries(), owner(e));
}

/** Comme `openContextMenu`, pour des entrées qui demandent d'abord une réponse au cœur Rust (menu
 *  d'une vignette cochée, SEL-08) : le menu s'ouvre au point du clic dès la réponse, sauf si un autre
 *  menu s'est ouvert entre-temps. */
export function openContextMenuAsync(e: ReactMouseEvent | MouseEvent, entries: () => Promise<MenuEntry[]>) {
  const native = "nativeEvent" in e ? e.nativeEvent : e;
  if (handled === native || textMenuFor(native)) return;
  handled = native;
  const anchor = anchorOf(native, owner(e));
  const before = useContextMenu.getState().menu;
  void entries().then((list) => {
    if (useContextMenu.getState().menu === before) useContextMenu.setState({ menu: { ...anchor, entries: list, id: nextId++ } });
  });
}

// Après les éléments (phase de remontée, sur `window`) : le menu du navigateur n'apparaît jamais ;
// si aucun élément n'a ouvert le sien : menu de texte, sinon rien (un menu ouvert se ferme).
window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  // Clic droit sur le menu lui-même : rien.
  if (e.target instanceof Element && e.target.closest('[data-zone^="menu-contextuel"]')) return;
  if (handled === e) return;
  const text = textMenuFor(e);
  if (!text) return closeContextMenu();
  void text().then((entries) => show(e, entries, e.target instanceof Element ? e.target : null));
});
