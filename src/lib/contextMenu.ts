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
  /** Entrée cochée ou non (ex. lecture en boucle) ; absente : pas de case. */
  checked?: boolean;
  /** Pastille de couleur avant le libellé (catégories). */
  color?: string;
  confirm?: Confirm;
  /** Sous-menu « ▸ » (un seul niveau). */
  submenu?: MenuEntry[];
};

/** « separator » : trait entre deux groupes d'entrées (« ‖ » dans la SPEC). */
export type MenuEntry = MenuItem | "separator";

export type OpenMenu = {
  /** Point d'ouverture, en pixels de la fenêtre. */
  x: number;
  y: number;
  entries: MenuEntry[];
  /** Ouvert au clavier : la première entrée est déjà choisie (comme sous Windows). */
  keyboard: boolean;
  /** Change à chaque ouverture : le menu est recréé (sélection, sous-menu remis à zéro). */
  id: number;
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

/** Point d'ouverture : celui du clic. Menu ouvert au clavier (touche Menu, Maj + F10 : ce n'est
 *  pas le bouton droit) : sous le coin haut gauche de l'élément si le point reçu n'est pas dessus. */
function anchorOf(e: MouseEvent): { x: number; y: number; keyboard: boolean } {
  const keyboard = e.button !== 2;
  const box = e.target instanceof Element ? e.target.getBoundingClientRect() : null;
  const inside = box && e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
  if (keyboard && box && !inside) return { x: box.left, y: box.bottom, keyboard };
  return { x: e.clientX, y: e.clientY, keyboard };
}

function show(e: MouseEvent, entries: MenuEntry[]) {
  useContextMenu.setState({ menu: { ...anchorOf(e), entries, id: nextId++ } });
}

/** Ouvre un menu à un point de la fenêtre, sans clic droit (Alt + Espace : menu de la fenêtre,
 *  CTX-13) ; `keyboard` : la première entrée est déjà choisie. */
export function openMenuAt(x: number, y: number, entries: MenuEntry[], keyboard: boolean) {
  useContextMenu.setState({ menu: { x, y, entries, keyboard, id: nextId++ } });
}

/** Ouvre le menu de l'élément. Sans effet sur un champ de saisie ou un texte sélectionné : leur
 *  menu (édition, « Copier ») passe avant. */
export function openContextMenu(e: ReactMouseEvent | MouseEvent, entries: () => MenuEntry[]) {
  const native = "nativeEvent" in e ? e.nativeEvent : e;
  if (handled === native || textMenuFor(native)) return;
  handled = native;
  show(native, entries());
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
  void text().then((entries) => show(e, entries));
});
