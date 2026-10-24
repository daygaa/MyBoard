// Commandes d'édition d'un champ à pastilles (SEL-12), communes au clavier, à la souris et au menu
// d'édition (CTX-03) : toutes passent par le contenu (lib/pillText.ts) et son historique (usePills).

import type { Pills } from "@/hooks/usePills";
import { bounds, caretAt, endOf, isCollapsed, isRaw, removePill, replace, samePos, START, step, type PillDoc, type Pos } from "@/lib/pillText";

/** Nouveau contenu, curseur après le remplacement. */
const at = <T>({ doc, caret }: { doc: PillDoc<T>; caret: Pos }) => ({ doc, sel: caretAt(caret) });

/** `resolve` : la pastille d'un texte validé par Entrée, ou `null` (le texte reste). */
export function pillCommands<T>(pills: Pills<T>, resolve: (text: string) => T | null | Promise<T | null>) {
  const { doc, sel } = pills;
  const eraseSelection = () =>
    pills.edit((d, s) => {
      if (isCollapsed(s)) return null;
      const [from, to] = bounds(s);
      return at(replace(d, from, to));
    });
  const selectAll = () => pills.select({ anchor: START, focus: endOf(doc) });
  return {
    eraseSelection,
    selectAll,
    /** Frappe (ou collage, `group` nul : une étape à lui seul) à la place de la sélection. */
    typeText: (text: string, group: string | null = "taper") =>
      pills.edit((d, s) => {
        const [from, to] = bounds(s);
        return at(replace(d, from, to, text));
      }, group),
    /** Retour arrière (-1) ou Suppr (1) : la sélection, sinon le caractère (le mot avec Ctrl) ou la
     *  pastille voisine ; les lettres effacées à la suite forment une seule étape. */
    erase: (dir: -1 | 1, word: boolean) => {
      if (!isCollapsed(sel)) return eraseSelection();
      const crossesPill = step(doc, sel.focus, dir, word).t !== sel.focus.t;
      pills.edit(
        (d, s) => {
          const target = step(d, s.focus, dir, word);
          if (samePos(target, s.focus)) return null;
          return at(dir < 0 ? replace(d, target, s.focus) : replace(d, s.focus, target));
        },
        crossesPill ? null : `effacer${dir}`,
      );
    },
    /** Croix d'une pastille. */
    remove: (k: number) => pills.edit((d, s) => removePill(d, s, k)),
    /** Le texte n° t devient une pastille (`item`, sinon `resolve`) ; déjà là : le texte s'efface. */
    validate: (t: number, item?: T) => {
      const text = doc.texts[t];
      const put = (found: T | null) =>
        found !== null &&
        pills.edit((d) => {
          if (d.texts[t] !== text) return null; // modifié entre-temps
          const there = d.pills.some((other) => pills.same(other, found));
          return at(replace(d, { t, o: 0 }, { t, o: text.length }, "", there ? undefined : found));
        });
      if (item !== undefined) put(item);
      else void Promise.resolve(resolve(text)).then(put);
    },
    /** Ctrl + A : le texte où est le curseur, puis tout le champ (tout de suite hors d'un texte). */
    selectStep: () => {
      const [from, to] = bounds(sel);
      const length = doc.texts[from.t].length;
      const inText = from.t === to.t && isRaw(doc.texts[from.t]);
      if (inText && (from.o !== 0 || to.o !== length)) return pills.select({ anchor: { t: from.t, o: 0 }, focus: { t: from.t, o: length } });
      selectAll();
    },
  };
}
