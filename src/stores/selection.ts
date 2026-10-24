// Sélection multiple (SEL-01 à SEL-10) : UNE seule sélection, rangée ici, dans l'état de
// l'application (pas dans l'affichage) : elle reste la même en changeant de page, de recherche ou de
// vue, en ouvrant la visionneuse et après un retour arrière ou avant (SEL-09). Les actions lisent
// exactement cette liste ; les coches des vignettes en sont le reflet.
//
// Performance (D-008) : la liste est un ensemble modifié sur place ; chaque changement incrémente
// `version`, et chaque vignette ne lit que SA réponse (cochée ou non) : seules celles qui changent se
// redessinent.

import { create } from "zustand";

import type { MediaItem } from "@/lib/api";
import { hasEscapeLayer } from "@/lib/escape";

/** Rectangle en cours (SEL-06) : vignettes touchées, à ajouter ou (Ctrl) à retirer au relâchement. */
type Preview = { ids: Set<number>; remove: boolean };

type SelectionState = {
  /** Mode sélection actif. */
  active: boolean;
  /** Nombre de médias cochés, affichés ou non. */
  count: number;
  version: number;
  preview: Preview | null;
};

const ids = new Set<number>();
/** Noms connus des médias cochés depuis la grille (pop-in de suppression d'un seul média). */
const names = new Map<number, string>();

export const useSelection = create<SelectionState>()(() => ({ active: false, count: 0, version: 0, preview: null }));

const changed = (patch: Partial<SelectionState> = {}) =>
  useSelection.setState((s) => ({ ...patch, count: ids.size, version: s.version + 1 }));

/** La vignette est-elle cochée (rectangle en cours compris) ? */
export function useIsSelected(id: number): boolean {
  return useSelection((s) => {
    const p = s.preview;
    if (p?.ids.has(id)) return !p.remove;
    return s.version >= 0 && ids.has(id);
  });
}

export const isSelecting = () => useSelection.getState().active;
export const selectedIds = (): number[] => [...ids];
export const isSelected = (id: number) => ids.has(id);
/** Nom du média coché quand il est seul et connu. */
export const singleName = (): string | undefined => (ids.size === 1 ? names.get([...ids][0]) : undefined);

type Selectable = Pick<MediaItem, "id"> & Partial<Pick<MediaItem, "fileName">>;

function put(items: Selectable[]) {
  for (const item of items) {
    ids.add(item.id);
    if (item.fileName) names.set(item.id, item.fileName);
  }
}

export function startSelection(items: Selectable[] = []) {
  put(items);
  changed({ active: true });
}

/** « Terminer » ou Échap : le mode se ferme et la sélection est vidée. */
export function stopSelection() {
  ids.clear();
  names.clear();
  changed({ active: false, preview: null });
}

export function addToSelection(items: Selectable[]) {
  put(items);
  changed();
}

/** Médias retirés de la sélection par leur suppression : ils y reviennent si leur fichier n'a pas pu
 *  être effacé (DEL-08, Q9-1). */
const deleting = new Map<number, string | undefined>();

export function removeDeletedFromSelection(list: number[]) {
  for (const id of list) deleting.set(id, names.get(id));
  removeFromSelection(list);
}

/** Suppression réglée : les médias revenus (échec) sont recochés si le mode sélection est actif. */
export function settleSelectionDeletion(list: number[], failed: boolean) {
  const back: Selectable[] = [];
  for (const id of list) {
    if (failed && deleting.has(id)) back.push({ id, fileName: deleting.get(id) });
    deleting.delete(id);
  }
  if (back.length && useSelection.getState().active) addToSelection(back);
}

export function removeFromSelection(list: number[]) {
  for (const id of list) {
    ids.delete(id);
    names.delete(id);
  }
  changed();
}

export function clearSelection() {
  ids.clear();
  names.clear();
  changed();
}

export function toggleSelected(item: Selectable) {
  if (ids.has(item.id)) removeFromSelection([item.id]);
  else addToSelection([item]);
}

// --- Grille affichée : rangée d'une vignette (Maj + clic, SEL-10) et « Tout » (SEL-04)

let page: { items: MediaItem[]; density: number } = { items: [], density: 1 };

/** Appelé par la grille à chaque nouvelle page ou densité. */
export function setSelectionPage(items: MediaItem[], density: number) {
  page = { items, density };
}

export const pageItems = () => page.items;

/** Maj + clic : coche toute la rangée de la vignette ; déjà toute cochée : la décoche. */
export function toggleRowOf(id: number) {
  const at = page.items.findIndex((m) => m.id === id);
  if (at < 0) return;
  const start = at - (at % page.density);
  const row = page.items.slice(start, start + page.density);
  if (row.every((m) => ids.has(m.id))) removeFromSelection(row.map((m) => m.id));
  else addToSelection(row);
}

// --- Rectangle (SEL-06)

export function setSelectionPreview(preview: Preview | null) {
  changed({ preview });
}

export function commitSelectionPreview() {
  const p = useSelection.getState().preview;
  if (!p) return;
  if (p.remove) for (const id of p.ids) {
    ids.delete(id);
    names.delete(id);
  }
  else put(page.items.filter((m) => p.ids.has(m.id)));
  changed({ preview: null });
}

const inField = (target: EventTarget | null) =>
  target instanceof HTMLElement && (["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable);

// Échap quitte le mode (SEL-01), en dernier recours : seulement si rien d'autre n'est ouvert par-dessus
// (visionneuse, menu, pop-in : ils passent avant, escape.ts) et hors d'un champ de saisie (un Échap
// de trop dans le champ des tags ne doit pas vider la sélection).
window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || !isSelecting() || hasEscapeLayer() || inField(e.target)) return;
  stopSelection();
});

// Ctrl + A (SEL-06.3) : plus de « tout sélectionner » de la page web, sauf dans un champ ; en mode
// sélection, rien d'ouvert par-dessus, il coche la page affichée, comme « Tout ».
window.addEventListener("keydown", (e) => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "a" || inField(e.target)) return;
  e.preventDefault();
  if (isSelecting() && !hasEscapeLayer()) addToSelection(pageItems());
});
