// Correspondance entre le champ à pastilles affiché (zone éditable, PillField) et son contenu
// (lib/pillText.ts) : chaque texte est un <span data-texte="t"> (un caractère invisible s'il est vide,
// pour que le curseur puisse s'y poser), chaque pastille un <span data-pastille="k"> non éditable.

import { endOf, START, type PillDoc, type Pos, type Sel } from "@/lib/pillText";

/** Caractère invisible (largeur nulle) d'un texte vide. */
export const EMPTY_TEXT = "​";

const dataOf = (node: Node | undefined, key: "texte" | "pastille") =>
  node instanceof HTMLElement && node.dataset[key] !== undefined ? Number(node.dataset[key]) : null;

/** Position du contenu pour un point de la sélection du navigateur. */
function domToPos<T>(editor: HTMLElement, doc: PillDoc<T>, node: Node, offset: number): Pos {
  if (node === editor) {
    // Entre deux enfants du champ : avant le texte, ou à la fin du texte qui précède la pastille.
    const child = editor.childNodes[offset];
    const t = dataOf(child, "texte");
    if (t !== null) return { t, o: 0 };
    const k = dataOf(child, "pastille");
    return k !== null ? { t: k, o: doc.texts[k].length } : endOf(doc);
  }
  const el = node instanceof Element ? node : node.parentElement;
  const text = el?.closest<HTMLElement>("[data-texte]");
  if (text && editor.contains(text)) {
    const t = Number(text.dataset.texte);
    const length = doc.texts[t]?.length ?? 0;
    if (node.nodeType !== Node.TEXT_NODE) return { t, o: offset === 0 ? 0 : length };
    return { t, o: Math.min(offset, length) }; // texte vide : le caractère invisible ne compte pas
  }
  const pill = el?.closest<HTMLElement>("[data-pastille]");
  if (pill && editor.contains(pill)) return { t: Number(pill.dataset.pastille) + 1, o: 0 };
  return endOf(doc);
}

/** Point du DOM d'une position (texte vide : après son caractère invisible). */
function domPoint<T>(editor: HTMLElement, doc: PillDoc<T>, pos: Pos): [Node, number] {
  const node = editor.querySelector(`[data-texte="${pos.t}"]`)?.firstChild;
  if (!node) return [editor, 0];
  return [node, doc.texts[pos.t] === "" ? 1 : pos.o];
}

/** Sélection du contenu → sélection du navigateur (sans y toucher si elle y est déjà). */
export function applySelection<T>(editor: HTMLElement, doc: PillDoc<T>, sel: Sel) {
  const selection = window.getSelection();
  if (!selection) return;
  const [anchorNode, anchorOffset] = domPoint(editor, doc, sel.anchor);
  const [focusNode, focusOffset] = domPoint(editor, doc, sel.focus);
  const same =
    selection.anchorNode === anchorNode && selection.anchorOffset === anchorOffset && selection.focusNode === focusNode && selection.focusOffset === focusOffset;
  if (!same) selection.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset);
}

/** Sélection du navigateur → sélection du contenu (`null` si elle n'est pas dans le champ). */
export function readSelection<T>(editor: HTMLElement, doc: PillDoc<T>): Sel | null {
  const s = window.getSelection();
  if (!s?.anchorNode || !s.focusNode || !editor.contains(s.anchorNode) || !editor.contains(s.focusNode)) return null;
  return { anchor: domToPos(editor, doc, s.anchorNode, s.anchorOffset), focus: domToPos(editor, doc, s.focusNode, s.focusOffset) };
}

/** Position sous un point de la fenêtre (souris). Sur une pastille : son bord le plus proche, et son
 *  numéro (`pill`) pour le clic simple. Hors du champ (glisser) : ramené à son bord. */
export function posAtPoint<T>(editor: HTMLElement, doc: PillDoc<T>, x: number, y: number): { pos: Pos; pill: number | null } {
  const box = editor.getBoundingClientRect();
  if (y < box.top) return { pos: START, pill: null };
  if (y > box.bottom) return { pos: endOf(doc), pill: null };
  const cx = Math.min(Math.max(x, box.left + 1), box.right - 1);
  const pill = document.elementFromPoint(cx, y)?.closest<HTMLElement>("[data-pastille]");
  if (pill && editor.contains(pill)) {
    const k = Number(pill.dataset.pastille);
    const r = pill.getBoundingClientRect();
    return { pos: cx < r.left + r.width / 2 ? { t: k, o: doc.texts[k].length } : { t: k + 1, o: 0 }, pill: k };
  }
  const range = document.caretRangeFromPoint(cx, y);
  if (!range || !editor.contains(range.startContainer)) return { pos: endOf(doc), pill: null };
  return { pos: domToPos(editor, doc, range.startContainer, range.startOffset), pill: null };
}
