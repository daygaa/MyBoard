// Contenu d'un champ à pastilles (SEL-07, SEL-12), sans rien d'affiché : des textes tapés et des
// pastilles en alternance. Il y a toujours un texte (souvent vide) avant, entre et après les pastilles :
// `texts.length === pills.length + 1`, la pastille n° k est entre les textes k et k + 1. Le curseur est
// donc toujours dans un texte : « entre deux pastilles », c'est dans le texte vide qui les sépare, et
// l'on peut y taper (plusieurs textes en attente, retour du 25/10).

export type PillDoc<T> = { texts: string[]; pills: T[] };
/** Position : dans le texte n° `t`, après `o` caractères. */
export type Pos = { t: number; o: number };
export type Sel = { anchor: Pos; focus: Pos };

export const START: Pos = { t: 0, o: 0 };
export const endOf = <T>(doc: PillDoc<T>): Pos => ({ t: doc.texts.length - 1, o: doc.texts[doc.texts.length - 1].length });
export const caretAt = (pos: Pos): Sel => ({ anchor: pos, focus: pos });
export const samePos = (a: Pos, b: Pos) => a.t === b.t && a.o === b.o;
export const sameSel = (a: Sel, b: Sel) => samePos(a.anchor, b.anchor) && samePos(a.focus, b.focus);
export const isCollapsed = (s: Sel) => samePos(s.anchor, s.focus);
const isBefore = (a: Pos, b: Pos) => a.t < b.t || (a.t === b.t && a.o < b.o);

/** Début et fin de la sélection, dans l'ordre. */
export function bounds(s: Sel): [Pos, Pos] {
  return isBefore(s.focus, s.anchor) ? [s.focus, s.anchor] : [s.anchor, s.focus];
}

/** Un texte qui deviendrait un tag (des espaces seuls ne comptent pas). */
export const isRaw = (text: string) => text.trim() !== "";
export const hasRawText = <T>(doc: PillDoc<T>) => doc.texts.some(isRaw);

/** Texte où se trouve toute la sélection (le curseur), ou `null` si elle passe par une pastille. */
export function textAt(s: Sel): number | null {
  const [from, to] = bounds(s);
  return from.t === to.t ? from.t : null;
}

/** La pastille n° k est-elle dans la sélection ? */
export function covers(s: Sel, k: number): boolean {
  const [from, to] = bounds(s);
  return from.t <= k && k < to.t;
}

/** Remplace la plage [from, to] (textes et pastilles) par `text`, suivi de `pill` s'il est donné. */
export function replace<T>(doc: PillDoc<T>, from: Pos, to: Pos, text = "", pill?: T): { doc: PillDoc<T>; caret: Pos } {
  const head = doc.texts[from.t].slice(0, from.o) + text;
  const tail = doc.texts[to.t].slice(to.o);
  const texts = doc.texts.slice(0, from.t);
  const pills = doc.pills.slice(0, from.t);
  let caret: Pos;
  if (pill === undefined) {
    texts.push(head + tail);
    caret = { t: from.t, o: head.length };
  } else {
    texts.push(head, tail);
    pills.push(pill);
    caret = { t: from.t + 1, o: 0 };
  }
  return { doc: { texts: [...texts, ...doc.texts.slice(to.t + 1)], pills: [...pills, ...doc.pills.slice(to.t)] }, caret };
}

/** Efface la pastille n° k (sa croix) ; le curseur ne bouge pas, il suit seulement le texte. */
export function removePill<T>(doc: PillDoc<T>, s: Sel, k: number): { doc: PillDoc<T>; sel: Sel } {
  const joined = doc.texts[k].length;
  const shift = (p: Pos): Pos => (p.t <= k ? p : { t: p.t - 1, o: p.t === k + 1 ? p.o + joined : p.o });
  const { doc: next } = replace(doc, { t: k, o: joined }, { t: k + 1, o: 0 });
  return { doc: next, sel: { anchor: shift(s.anchor), focus: shift(s.focus) } };
}

const isSpace = (c: string | undefined) => c !== undefined && /\s/.test(c);

/** Position voisine de `pos` (← : -1, → : 1) : un caractère, un mot avec Ctrl, ou de l'autre côté de la
 *  pastille voisine au bord d'un texte. */
export function step<T>(doc: PillDoc<T>, pos: Pos, dir: -1 | 1, word: boolean): Pos {
  const text = doc.texts[pos.t];
  if (dir < 0) {
    if (pos.o === 0) return pos.t > 0 ? { t: pos.t - 1, o: doc.texts[pos.t - 1].length } : pos;
    let o = pos.o - 1;
    if (word) {
      while (o > 0 && isSpace(text[o])) o--;
      while (o > 0 && !isSpace(text[o - 1])) o--;
    }
    return { t: pos.t, o };
  }
  if (pos.o === text.length) return pos.t < doc.texts.length - 1 ? { t: pos.t + 1, o: 0 } : pos;
  let o = pos.o + 1;
  if (word) {
    while (o < text.length && !isSpace(text[o])) o++;
    while (o < text.length && isSpace(text[o])) o++;
  }
  return { t: pos.t, o };
}

/** Texte de la plage, pour le presse-papiers : les pastilles par leur nom, séparées par des espaces. */
export function textOf<T>(doc: PillDoc<T>, s: Sel, name: (item: T) => string): string {
  const [from, to] = bounds(s);
  const parts: string[] = [];
  for (let t = from.t; t <= to.t; t++) {
    const piece = doc.texts[t].slice(t === from.t ? from.o : 0, t === to.t ? to.o : undefined).trim();
    if (piece) parts.push(piece);
    if (t < to.t) parts.push(name(doc.pills[t]));
  }
  return parts.join(" ");
}
