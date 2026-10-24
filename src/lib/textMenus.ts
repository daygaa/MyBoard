// Menus du clic droit des textes, ouverts sans rien à faire dans les composants (contextMenu.ts) :
// - champ de saisie (recherche, saisie d'un tag, numéro de page, note en écriture…) : menu
//   d'édition classique (CTX-03), entrées grisées quand elles sont sans objet ; un champ éditable
//   maison (champ à pastilles, SEL-12) donne ses propres commandes (`registerEditable`) ;
// - texte sélectionné ailleurs (nom du fichier, compteurs…, GEN-17) : « Copier » (CTX-18).
// Le champ garde le clavier et sa sélection pendant que le menu est ouvert (le menu ne prend
// jamais le focus), comme avec le menu de Windows.

import { api } from "./api";
import type { MenuEntry } from "./contextMenu";

type Field = HTMLInputElement | HTMLTextAreaElement;

const TEXT_INPUTS = ["text", "search", "number", "url", "email", "tel", "password"];

function fieldOf(target: EventTarget | null): Field | null {
  if (target instanceof HTMLTextAreaElement) return target;
  if (target instanceof HTMLInputElement && TEXT_INPUTS.includes(target.type)) return target;
  return null;
}

/** Texte sélectionné dans le champ. */
function selectedIn(field: Field): string {
  // Champ numérique : sa sélection n'est pas lisible par `selectionStart`.
  if (field.selectionStart === null) return window.getSelection()?.toString() ?? "";
  return field.value.slice(field.selectionStart, field.selectionEnd ?? field.selectionStart);
}

/** Le clic droit tombe-t-il sur le texte sélectionné (hors champ de saisie) ? */
function onSelection(e: MouseEvent): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.toString().trim()) return false;
  for (let i = 0; i < selection.rangeCount; i++) {
    for (const r of selection.getRangeAt(i).getClientRects()) {
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return true;
    }
  }
  return false;
}

/** Colle le texte du presse-papiers de Windows à la place de la sélection, comme Ctrl + V
 *  (annulable par Ctrl + Z). Lu par le cœur Rust : WebView2 demanderait sinon une autorisation. */
async function paste(field: Field) {
  const text = await api.readClipboardText().catch(() => null);
  if (!text) return;
  field.focus();
  // Champ d'une seule ligne : les retours à la ligne deviennent des espaces, comme Ctrl + V.
  document.execCommand("insertText", false, field instanceof HTMLInputElement ? text.replace(/\r?\n/g, " ") : text);
}

async function editMenu(field: Field): Promise<MenuEntry[]> {
  const clipboard = await api.readClipboardText().catch(() => null);
  const selected = selectedIn(field) !== "";
  const writable = !field.readOnly && !field.disabled;
  const command = (name: string) => () => {
    field.focus();
    document.execCommand(name);
  };
  return [
    { label: "Annuler", shortcut: "Ctrl+Z", disabled: !writable || !document.queryCommandEnabled("undo"), run: command("undo") },
    { label: "Couper", shortcut: "Ctrl+X", disabled: !writable || !selected, run: command("cut") },
    { label: "Copier", shortcut: "Ctrl+C", disabled: !selected, run: command("copy") },
    { label: "Coller", shortcut: "Ctrl+V", disabled: !writable || !clipboard, run: () => void paste(field) },
    { label: "Supprimer", shortcut: "Suppr", disabled: !writable || !selected, run: command("delete") },
    {
      label: "Tout sélectionner",
      shortcut: "Ctrl+A",
      disabled: field.value === "",
      run: () => {
        field.focus();
        field.select();
      },
    },
  ];
}

/** Commandes d'édition d'un champ éditable maison (champ à pastilles) : le navigateur ne sait pas
 *  défaire ni coller à sa place. `selected` : le texte sélectionné, à copier. */
export type EditCommands = {
  canUndo: () => boolean;
  undo: () => void;
  selected: () => string;
  isEmpty: () => boolean;
  erase: () => void;
  paste: (text: string) => void;
  selectAll: () => void;
};

const editables = new WeakMap<Element, EditCommands>();

/** Inscrit un champ éditable maison ; renvoie de quoi le désinscrire. */
export function registerEditable(el: HTMLElement, commands: EditCommands): () => void {
  editables.set(el, commands);
  return () => editables.delete(el);
}

async function editableMenu(el: HTMLElement, c: EditCommands): Promise<MenuEntry[]> {
  const clipboard = await api.readClipboardText().catch(() => null);
  const selected = c.selected();
  const inField = (fn: () => void) => () => {
    el.focus();
    fn();
  };
  return [
    { label: "Annuler", shortcut: "Ctrl+Z", disabled: !c.canUndo(), run: inField(c.undo) },
    {
      label: "Couper",
      shortcut: "Ctrl+X",
      disabled: !selected,
      run: inField(() => {
        void api.writeClipboardText(selected);
        c.erase();
      }),
    },
    { label: "Copier", shortcut: "Ctrl+C", disabled: !selected, run: () => void api.writeClipboardText(selected) },
    { label: "Coller", shortcut: "Ctrl+V", disabled: !clipboard, run: inField(() => clipboard && c.paste(clipboard)) },
    { label: "Supprimer", shortcut: "Suppr", disabled: !selected, run: inField(c.erase) },
    { label: "Tout sélectionner", shortcut: "Ctrl+A", disabled: c.isEmpty(), run: inField(c.selectAll) },
  ];
}

/** Menu de texte à ouvrir pour ce clic droit (il passe avant celui de l'élément), ou `null`. */
export function textMenuFor(e: MouseEvent): (() => Promise<MenuEntry[]>) | null {
  const field = fieldOf(e.target);
  if (field) return () => editMenu(field);
  const editable = e.target instanceof Element ? e.target.closest<HTMLElement>('[contenteditable="true"]') : null;
  const commands = editable && editables.get(editable);
  if (editable && commands) return () => editableMenu(editable, commands);
  if (onSelection(e)) return async () => [{ label: "Copier", shortcut: "Ctrl+C", run: () => document.execCommand("copy") }];
  return null;
}

// Un texte surligné (GEN-17) perd son surlignage au premier clic ailleurs, et ce clic garde son effet
// (ouvrir la visionneuse…) : la page n'étant pas sélectionnable (SEL-06.3), le clic ne le retirait
// pas. Le clic droit (menu « Copier », CTX-18), le menu lui-même, un autre texte d'information et
// les champs de saisie gardent leur fonctionnement habituel.
window.addEventListener(
  "pointerdown",
  (e) => {
    const selection = window.getSelection();
    const editing = fieldOf(document.activeElement) || (document.activeElement as HTMLElement | null)?.isContentEditable;
    if (e.button !== 0 || !selection || selection.isCollapsed || editing) return;
    if (e.target instanceof Element && e.target.closest('.select-text, input, textarea, [contenteditable="true"], [data-zone^="menu-contextuel"]')) return;
    selection.removeAllRanges();
  },
  true,
);
