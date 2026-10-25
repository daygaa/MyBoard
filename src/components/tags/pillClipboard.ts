// Copier-coller des pastilles (retour du 25/10, SEL-12) : copiées comme pastilles, elles redeviennent des
// pastilles au collage dans un champ à pastilles de MyBoard ; ailleurs (autre application, case de saisie
// ordinaire), c'est leur nom qui se colle, en texte brut séparé par des espaces. Le morceau copié voyage
// dans le presse-papiers sous un type réservé à MyBoard, à côté du texte. Le menu du clic droit, qui lit
// le presse-papiers par le cœur Rust (texte seul), le retrouve par le dernier morceau copié ici.

import { endOf, mapPills, pieceOf, START, textOf, type PillDoc, type Sel } from "@/lib/pillText";

/** Pastille copiée : de quoi la refaire dans n'importe quel champ à pastilles. */
export type ClipPill = { name: string; categoryId: number };

/** Type réservé du presse-papiers (WebView2 le garde avec le texte). */
const TYPE = "application/x-myboard-pastilles";

let last: { text: string; piece: PillDoc<ClipPill> } | null = null;

/** Copie la sélection dans le presse-papiers (Ctrl + C, Ctrl + X, menu du clic droit). */
export function copyPiece<T>(data: DataTransfer, doc: PillDoc<T>, sel: Sel, toClip: (item: T) => ClipPill) {
  const piece = mapPills(pieceOf(doc, sel), toClip);
  const text = textOf(piece, { anchor: START, focus: endOf(piece) }, (c) => c.name);
  data.setData("text/plain", text);
  data.setData(TYPE, JSON.stringify(piece));
  last = { text, piece };
}

/** Morceau collé, s'il vient d'un champ à pastilles de MyBoard ; sinon `null` (texte brut). */
export function pastedPiece(data: DataTransfer | null, text: string): PillDoc<ClipPill> | null {
  const raw = data?.getData(TYPE);
  if (raw) {
    try {
      return JSON.parse(raw) as PillDoc<ClipPill>;
    } catch {
      // Contenu illisible : collé comme du texte.
    }
  }
  return last && last.text === text ? last.piece : null;
}
