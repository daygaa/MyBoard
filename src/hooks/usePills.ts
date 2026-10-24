// État d'un champ à pastilles (SEL-07, SEL-12) : les pastilles, le texte tapé pas encore validé et le
// curseur, avec l'historique des pastilles comme dans un éditeur de texte (retour du 24/10, SEL-07.2) :
// chaque ajout ou effacement est une étape, Ctrl + Z revient à la précédente, Ctrl + Y avance, et une
// nouvelle étape après des Ctrl + Z abandonne la suite.
//
// Curseur : une place entre deux pastilles (`caret`, de 0 à la longueur de la liste). Texte vide : la
// case de saisie est le curseur, elle suit `caret`. Texte tapé : il reste là où il a été tapé
// (`textAt`) et le curseur peut passer entre d'autres pastilles ; il est dans le texte quand
// `caret === textAt` (choix du 24/10).

import { useState } from "react";

type Snapshot<T> = { list: T[]; caret: number };
type State<T> = { list: T[]; text: string; textAt: number; caret: number; past: Snapshot<T>[]; future: Snapshot<T>[] };

const EMPTY = { list: [], text: "", textAt: 0, caret: 0, past: [], future: [] };

const clamp = (n: number, max: number) => Math.max(0, Math.min(n, max));

/** Texte vide : la case de saisie est au curseur. */
function fix<T>(s: State<T>): State<T> {
  return s.text === "" ? { ...s, textAt: s.caret } : s;
}

export type Pills<T> = ReturnType<typeof usePills<T>>;

/** `same` : deux pastilles du même tag (pas de doublon ; repère du texte tapé après un Ctrl + Z). */
export function usePills<T>(same: (a: T, b: T) => boolean) {
  const [s, setS] = useState<State<T>>(EMPTY);

  /** Nouvelle liste : l'étape d'avant entre dans l'historique, la suite est abandonnée. */
  const commit = (prev: State<T>, list: T[], caret: number, textAt: number): State<T> =>
    fix({ ...prev, list, caret, textAt, past: [...prev.past, { list: prev.list, caret: prev.caret }], future: [] });

  /** Revient à une étape de l'historique ; le texte tapé reste après la même pastille. */
  const restore = (prev: State<T>, to: Snapshot<T>, past: Snapshot<T>[], future: Snapshot<T>[]): State<T> => {
    const before = prev.textAt > 0 ? prev.list[prev.textAt - 1] : undefined;
    const index = before === undefined ? -1 : to.list.findIndex((item) => same(item, before));
    const textAt = before === undefined ? 0 : index >= 0 ? index + 1 : clamp(prev.textAt, to.list.length);
    return fix({ ...prev, list: to.list, caret: clamp(to.caret, to.list.length), textAt, past, future });
  };

  return {
    list: s.list,
    text: s.text,
    textAt: s.textAt,
    caret: s.caret,
    /** Le curseur est dans le texte tapé (ou le texte est vide). */
    inText: s.caret === s.textAt,
    setText: (text: string) => setS((p) => fix({ ...p, text })),
    /** Ajoute une pastille au curseur (rien si le tag y est déjà). */
    add: (item: T) =>
      setS((p) => {
        if (p.list.some((other) => same(other, item))) return p;
        const at = p.caret;
        return commit(p, [...p.list.slice(0, at), item, ...p.list.slice(at)], at + 1, p.textAt >= at ? p.textAt + 1 : p.textAt);
      }),
    /** Efface la pastille `index` (Retour arrière, Suppr, croix). */
    removeAt: (index: number) =>
      setS((p) => {
        if (index < 0 || index >= p.list.length) return p;
        const shift = (n: number) => (n > index ? n - 1 : n);
        return commit(p, p.list.filter((_, i) => i !== index), shift(p.caret), shift(p.textAt));
      }),
    /** Place le curseur entre deux pastilles (pas une étape de l'historique). */
    moveTo: (caret: number) => setS((p) => fix({ ...p, caret: clamp(caret, p.list.length) })),
    undo: () => setS((p) => (p.past.length ? restore(p, p.past[p.past.length - 1], p.past.slice(0, -1), [{ list: p.list, caret: p.caret }, ...p.future]) : p)),
    redo: () => setS((p) => (p.future.length ? restore(p, p.future[0], [...p.past, { list: p.list, caret: p.caret }], p.future.slice(1)) : p)),
    /** Tout vider, historique compris (« Appliquer »). */
    clear: () => setS(EMPTY),
  };
}
