// État d'un champ à pastilles (SEL-07, SEL-12) : son contenu (lib/pillText.ts), la sélection, et
// l'historique comme dans un éditeur de texte (SEL-07.2) : un seul historique pour les textes tapés et
// les pastilles ; une frappe continue (ou une suite d'effacements de lettres) est une étape, chaque
// pastille ajoutée ou effacée en est une ; Ctrl + Z revient à l'étape précédente, Ctrl + Y avance, une
// nouvelle étape après des Ctrl + Z abandonne la suite.

import { useState } from "react";

import { caretAt, hasRawText, START, type PillDoc, type Sel } from "@/lib/pillText";

type Snapshot<T> = { doc: PillDoc<T>; sel: Sel };
type State<T> = Snapshot<T> & { past: Snapshot<T>[]; future: Snapshot<T>[]; group: string | null };

const INITIAL: State<never> = { doc: { texts: [""], pills: [] }, sel: caretAt(START), past: [], future: [], group: null };

export type Pills<T> = ReturnType<typeof usePills<T>>;

/** `same` : deux pastilles du même tag (pas de doublon). */
export function usePills<T>(same: (a: T, b: T) => boolean) {
  const [s, setS] = useState<State<T>>(INITIAL);
  return {
    doc: s.doc,
    sel: s.sel,
    list: s.doc.pills,
    /** Du texte tapé pas encore validé, quelque part dans le champ. */
    hasText: hasRawText(s.doc),
    canUndo: s.past.length > 0,
    same,
    /** Modifie le contenu (`null` : rien) ; `group` : les modifications d'un même groupe qui se suivent
     *  (frappe…) forment une seule étape. */
    edit: (change: (doc: PillDoc<T>, sel: Sel) => Snapshot<T> | null, group: string | null = null) =>
      setS((p) => {
        const next = change(p.doc, p.sel);
        if (!next) return p;
        const merge = group !== null && group === p.group;
        return { ...next, past: merge ? p.past : [...p.past, { doc: p.doc, sel: p.sel }], future: [], group };
      }),
    /** Déplace le curseur ou la sélection (pas une étape ; la frappe suivante en commence une). */
    select: (sel: Sel) => setS((p) => ({ ...p, sel, group: null })),
    undo: () =>
      setS((p) => {
        const to = p.past[p.past.length - 1];
        return to ? { ...to, past: p.past.slice(0, -1), future: [{ doc: p.doc, sel: p.sel }, ...p.future], group: null } : p;
      }),
    redo: () =>
      setS((p) => {
        const to = p.future[0];
        return to ? { ...to, past: [...p.past, { doc: p.doc, sel: p.sel }], future: p.future.slice(1), group: null } : p;
      }),
    /** Tout vider, historique compris (« Appliquer », fin du mode sélection). */
    clear: () => setS(INITIAL),
  };
}
