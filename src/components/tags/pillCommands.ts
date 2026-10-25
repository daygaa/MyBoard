// Commandes d'édition d'un champ à pastilles (SEL-12), communes au clavier, à la souris et au menu
// d'édition (CTX-03) : toutes passent par le contenu (lib/pillText.ts) et son historique (usePills).

import type { Pills } from "@/hooks/usePills";
import {
  bounds,
  caretAt,
  collect,
  endOf,
  insert,
  isCollapsed,
  isRaw,
  mapPills,
  removePill,
  replace,
  samePos,
  START,
  step,
  wordsToPills,
  type PillDoc,
  type Pos,
} from "@/lib/pillText";
import type { ClipPill } from "./pillClipboard";

/** Nouveau contenu, curseur après le remplacement. */
const at = <T>({ doc, caret }: { doc: PillDoc<T>; caret: Pos }) => ({ doc, sel: caretAt(caret) });

type Options<T> = {
  /** La pastille d'un texte validé par Entrée, ou `null` (le texte reste) ; recherche : d'un mot. */
  resolve: (text: string) => T | null | Promise<T | null>;
  /** Pastille collée (`null` : elle n'a pas de sens dans ce champ, elle n'est pas collée). */
  fromClip: (c: ClipPill) => T | null;
};

export function pillCommands<T>(pills: Pills<T>, { resolve, fromClip }: Options<T>) {
  const { doc, sel } = pills;
  /** Recherche : la pastille d'un mot (toujours connue tout de suite). */
  const word = (w: string) => {
    const item = resolve(w);
    return item instanceof Promise ? null : item;
  };
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
    /** Recherche : tout le champ en pastilles (les mots tapés compris), pour la lancer. */
    all: () => collect(doc, word, pills.same),
    /** Frappe (ou collage de texte, `group` nul : une étape à lui seul) à la place de la sélection. */
    typeText: (text: string, group: string | null = "taper") =>
      pills.edit((d, s) => {
        const [from, to] = bounds(s);
        return at(replace(d, from, to, text));
      }, group),
    /** Collage d'un morceau copié dans un champ à pastilles : textes et pastilles, sans doublon. */
    pastePiece: (piece: PillDoc<ClipPill>) =>
      pills.edit((d, s) => {
        const [from, to] = bounds(s);
        const base = replace(d, from, to);
        const seen = [...base.doc.pills];
        const part = mapPills(piece, (c) => {
          const item = fromClip(c);
          if (item === null || seen.some((other) => pills.same(other, item))) return null;
          seen.push(item);
          return item;
        });
        return at(insert(base.doc, base.caret, base.caret, part));
      }),
    /** Recherche, espace tapé : les mots avant le curseur deviennent des pastilles (rien avant :
     *  l'espace est ignoré). */
    splitWords: () =>
      pills.edit((d, s) => {
        const [from, to] = bounds(s);
        const base = isCollapsed(s) ? { doc: d, caret: s.focus } : replace(d, from, to);
        const { t, o } = base.caret;
        const before = base.doc.texts[t].slice(0, o);
        if (!isRaw(before)) return isCollapsed(s) ? null : at(base);
        const items = wordsToPills(before, word, pills.same, base.doc.pills);
        return at(insert(base.doc, { t, o: 0 }, { t, o }, { texts: Array(items.length + 1).fill(""), pills: items }));
      }),
    /** Efface le texte n° t (recherche : le mot ajouté par les boutons + / −). */
    clearText: (t: number) => pills.edit((d) => (d.texts[t] ? at(replace(d, { t, o: 0 }, { t, o: d.texts[t].length })) : null)),
    /** Retour arrière (-1) ou Suppr (1) : la sélection, sinon le caractère (le mot avec Ctrl) ou la
     *  pastille voisine ; les lettres effacées à la suite forment une seule étape. */
    erase: (dir: -1 | 1, ctrl: boolean) => {
      if (!isCollapsed(sel)) return eraseSelection();
      const crossesPill = step(doc, sel.focus, dir, ctrl).t !== sel.focus.t;
      pills.edit(
        (d, s) => {
          const target = step(d, s.focus, dir, ctrl);
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
    /** Double-clic sur une pastille : elle seule est sélectionnée. */
    selectPill: (k: number) => pills.select({ anchor: { t: k, o: doc.texts[k].length }, focus: { t: k + 1, o: 0 } }),
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
