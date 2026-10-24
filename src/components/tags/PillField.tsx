// Champ à pastilles (SEL-07, SEL-12) : les tags choisis deviennent des pastilles dans le champ, la case
// de saisie (TagInput, fournie par `children`) se place entre elles. Un seul composant pour la barre de
// la sélection, puis la recherche (SRCH-28) et les règles du gestionnaire (TAGM-15.5).
// Clavier, comme pour du texte (choix du 24/10) :
// - ← / → passent d'une pastille à l'autre, Début / Fin vont au début / à la fin ; Retour arrière
//   efface la pastille avant le curseur, Suppr celle d'après ; un tag validé s'insère au curseur ;
// - texte tapé pas encore validé : il ne bouge pas, le curseur peut le quitter (curseur dessiné à
//   part, sans suggestions) ; hors du texte, les lettres sont ignorées et Entrée ne fait rien ;
// - Ctrl + Z / Ctrl + Y : historique des pastilles (usePills), sauf dans un texte tapé (le sien) ;
// - Entrée dans un champ vide : `onEnterEmpty` (« Appliquer », SEL-07.3).
// Souris : un clic sur une pastille place le curseur après elle, un clic dans le vide à la fin.

import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

import type { Pills } from "@/hooks/usePills";
import { cn } from "@/lib/utils";

/** Ce que le champ demande à sa case de saisie (à poser sur le TagInput). */
export type PillBox = {
  inputRef: (el: HTMLInputElement | null) => void;
  className: string;
  inputClassName: string;
  /** Liste de suggestions permise (curseur dans le texte). */
  suggest: boolean;
  /** Texte d'aide affiché (case de saisie à la fin du champ). */
  placeholder: boolean;
};

type Props<T> = {
  zone: string;
  pills: Pills<T>;
  pillKey: (item: T) => string | number;
  /** Pastille ; `remove` l'efface (croix). */
  renderPill: (item: T, remove: () => void) => ReactNode;
  children: (box: PillBox) => ReactNode;
  onEnterEmpty?: () => void;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
};

const INPUT = "h-7 rounded-none border-0 bg-transparent px-1 focus:border-0";

/** Curseur entre deux pastilles : au milieu de l'écart de 4 px, sans décaler les pastilles. */
const CARET = (
  <span key="curseur" aria-hidden className="invisible relative left-[1.5px] -mr-px -ml-1 h-4 w-px group-focus-within:visible">
    <span className="curseur-pastilles absolute inset-0 bg-foreground" />
  </span>
);

export function PillField<T>({ zone, pills, pillKey, renderPill, children, onEnterEmpty, className, onFocus, onBlur }: Props<T>) {
  const input = useRef<HTMLInputElement | null>(null);
  const { list, textAt, caret, inText } = pills;
  const n = list.length;
  const typed = pills.text !== "";
  const outside = useRef(false);
  useLayoutEffect(() => {
    outside.current = !inText;
  });

  // Hors du texte tapé, rien ne s'y écrit (lettres, collage, couper…).
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    const guard = (e: InputEvent) => outside.current && e.preventDefault();
    el.addEventListener("beforeinput", guard);
    return () => el.removeEventListener("beforeinput", guard);
  }, []);

  /** Curseur à la place `slot` ; celle du texte tapé : dans le texte, au bord `edge`. */
  const go = (slot: number, edge: "start" | "end") => {
    pills.moveTo(slot);
    const el = input.current;
    if (!el || !typed) return;
    const at = slot === textAt && edge === "start" ? 0 : el.value.length;
    el.setSelectionRange(at, at);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const el = input.current;
    if (!el || e.target !== el || e.altKey) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    /** Touche prise par le champ : ni la case de saisie ni la page ne la reçoivent. */
    const act = (fn: () => void) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    };
    if (typed && inText) {
      // Dans le texte tapé : ses touches (sélection avec Maj, Ctrl + Z…), sauf aux bords, où l'on en
      // sort ou efface la pastille voisine, comme pour une lettre.
      if (e.shiftKey) return;
      const collapsed = el.selectionStart === el.selectionEnd;
      const atStart = collapsed && el.selectionStart === 0;
      const atEnd = collapsed && el.selectionStart === el.value.length;
      if (e.key === "ArrowLeft" && atStart && textAt > 0) act(() => go(textAt - 1, "end"));
      else if (e.key === "ArrowRight" && atEnd && textAt < n) act(() => go(textAt + 1, "start"));
      else if (e.key === "Home" && textAt > 0) act(() => go(0, "start"));
      else if (e.key === "End" && textAt < n) act(() => go(n, "end"));
      else if (e.key === "Backspace" && !ctrl && atStart && textAt > 0) act(() => pills.removeAt(textAt - 1));
      else if (e.key === "Delete" && !ctrl && atEnd && textAt < n) act(() => pills.removeAt(textAt));
      return;
    }
    if (ctrl && !e.shiftKey && key === "z") return act(pills.undo);
    if (ctrl && (key === "y" || (e.shiftKey && key === "z"))) return act(pills.redo);
    if (e.shiftKey) return;
    if (e.key === "ArrowLeft") act(() => caret > 0 && go(caret - 1, "end"));
    else if (e.key === "ArrowRight") act(() => caret < n && go(caret + 1, "start"));
    else if (e.key === "Home") act(() => go(0, "start"));
    else if (e.key === "End") act(() => go(n, "end"));
    else if (e.key === "Backspace" && !ctrl && caret > 0) {
      act(() => pills.removeAt(caret - 1));
      // La pastille effacée suivait le texte tapé : le curseur arrive à la fin du texte.
      if (caret - 1 === textAt) el.setSelectionRange(el.value.length, el.value.length);
    } else if (e.key === "Delete" && !ctrl && caret < n) {
      act(() => pills.removeAt(caret));
      // Elle le précédait : le curseur arrive au début du texte.
      if (caret + 1 === textAt) el.setSelectionRange(0, 0);
    } else if (e.key === "Enter" && !ctrl) {
      // Champ vide : « Appliquer » ; curseur hors du texte tapé : rien.
      act(() => !typed && onEnterEmpty?.());
    } else if (typed && ctrl && key === "a") {
      pills.moveTo(textAt); // Tout sélectionner : le texte tapé
    }
  };

  const onMouseDown = (e: MouseEvent) => {
    const el = input.current;
    if (!el || e.button !== 0 || !(e.target instanceof Element)) return;
    if (e.target === el) return pills.moveTo(textAt); // clic dans le texte : son curseur
    if (e.target.closest("ul")) return; // liste de suggestions : elle garde le focus elle-même
    // Le champ garde le focus (une pastille ou le vide ne le prennent pas) ; la croix agit au clic.
    e.preventDefault();
    el.focus();
    if (e.target.closest("button")) return;
    const pill = e.target.closest<HTMLElement>("[data-pastille]");
    if (pill) go(Number(pill.dataset.pastille) + 1, "start");
    else go(n, "end");
  };

  const pill = (item: T, index: number) => [
    !inText && caret === index && CARET,
    <span key={pillKey(item)} data-pastille={index} className="contents">
      {renderPill(item, () => pills.removeAt(index))}
    </span>,
  ];
  const atEnd = textAt === n;
  const box: PillBox = {
    inputRef: (el) => {
      input.current = el;
    },
    // À la fin : toute la place qui reste ; entre deux pastilles : la largeur du texte tapé ; vide, la
    // case (3 px) se loge au milieu de l'écart de 4 px, sans décaler les pastilles.
    className: atEnd ? "h-7 min-w-32 flex-1" : cn("h-7 shrink-0", !typed && "-mr-[5px] -ml-0.5"),
    inputClassName: cn(INPUT, !atEnd && "w-auto min-w-[3px] px-0 [field-sizing:content]", !inText && "caret-transparent"),
    suggest: inText,
    placeholder: atEnd,
  };

  return (
    <div
      data-zone={zone}
      data-champ-pastilles
      className={cn("group cursor-text", className)}
      onKeyDownCapture={onKeyDown}
      onMouseDown={onMouseDown}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {list.slice(0, textAt).flatMap((item, i) => pill(item, i))}
      {children(box)}
      {list.slice(textAt).flatMap((item, i) => pill(item, textAt + i))}
      {!inText && caret === n && CARET}
    </div>
  );
}
