// Champ de saisie de tag avec autocomplétion (SRCH-06, VIEW-21, IMP-31) — un seul composant
// pour la recherche de la barre latérale, la visionneuse et les tags par défaut de l'import.
// Suggestions (liste commune : TagSuggestions.tsx) : ↑ / ↓ ou Tab pour choisir, Entrée pour valider,
// Échap pour fermer.
// Recherche de la barre latérale (`onAddTerm`) : plusieurs termes séparés par des espaces, les
// suggestions portent sur le mot en cours (SRCH-20) ; le nom choisi s'écrit dans le champ à la
// place de ce mot, les boutons + / − l'ajoutent tout de suite à la recherche (SRCH-21).
// `source` : suggestions prises dans une liste donnée, dans le même ordre que l'autocomplétion.
// Tags déjà là (SRCH-29) : grisés avec leur bulle (`taken`) ; dans la recherche, seulement les autres mots
// déjà tapés dans le champ (choisir un tag de la recherche en cours prépare une nouvelle recherche, SRCH-24),
// et ses boutons + / − sont grisés quand ils ne changeraient rien (`termTaken`).

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import type { TagInfo } from "@/lib/api";
import { useEscape } from "@/lib/escape";
import { normalizeTag, parseTerms, splitTerm, wordAt } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { moveHighlight, SuggestionList, useTagSuggestions, type Dropdown, type Taken, type TermTaken } from "./TagSuggestions";

/** Bulle d'un tag déjà tapé dans le champ (recherche, barre de la sélection). */
export const IN_FIELD = "Ce tag est déjà inclus dans le champ textuel";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Entrée sans suggestion choisie : le texte tel quel. */
  onSubmit: (text: string) => void;
  /** Suggestion choisie (visionneuse, import). */
  onPick?: (tag: TagInfo) => void;
  /** Recherche de la barre latérale : boutons + / − des suggestions (`exclude` pour « − »), plusieurs
   *  termes, « -tag » tapé pour exclure (SRCH-03). */
  onAddTerm?: (tag: TagInfo, exclude: boolean) => void;
  placeholder: string;
  /** Côté où s'ouvrent les suggestions (« top » dans la visionneuse, VIEW-21) ; « auto » : en dessous, ou
   *  au-dessus quand la place manque en bas de la fenêtre (tags par défaut de l'import, IMP-52). */
  dropdown?: Dropdown | "auto";
  zone: string;
  className?: string;
  /** Ajustements du champ lui-même (taille, fond…). */
  inputClassName?: string;
  /** Suggestions prises dans cette liste (déjà triée par usage) plutôt que parmi tous les tags. */
  source?: TagInfo[];
  /** Tags déjà là (sur le média, dans la liste…) : grisés, avec la raison en bulle. */
  taken?: Taken;
  /** Recherche : boutons + / − sans effet (tag déjà inclus ou déjà exclu). */
  termTaken?: TermTaken;
};

export function TagInput({
  value,
  onChange,
  onSubmit,
  onPick,
  onAddTerm,
  placeholder,
  dropdown = "bottom",
  zone,
  className,
  inputClassName,
  source,
  taken,
  termTaken,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [caret, setCaret] = useState(0);
  const field = useRef<HTMLInputElement | null>(null);
  /** Curseur de saisie à replacer après un texte réécrit ici (SRCH-21). */
  const nextCaret = useRef<number | null>(null);
  const search = onAddTerm !== undefined;
  // Recherche : seul le mot en cours compte (SRCH-20) ; ailleurs, tout le texte forme un seul tag.
  const word = search ? wordAt(value, Math.min(caret, value.length)) : { start: 0, end: value.length };
  const typed = value.slice(word.start, word.end);
  const negated = search && typed.startsWith("-");
  const text = normalizeTag(typed);

  const suggestions = useTagSuggestions(text, source);
  // Recherche : les autres mots du champ comptent comme déjà là.
  const others = search ? parseTerms(value.slice(0, word.start) + " " + value.slice(word.end)).map((t) => splitTerm(t).name) : [];
  const takenHere: Taken = (tag) => (others.includes(tag.name) ? IN_FIELD : (taken?.(tag) ?? null));
  const open = focused && text.length > 0 && suggestions.length > 0;
  // Échap ferme d'abord les suggestions, sans fermer la visionneuse derrière ; les boutons 4 / 5 et
  // les flèches de la barre de titre les ignorent (NAV-07).
  useEscape(open, () => setFocused(false), { escapeOnly: true });

  // « auto » (IMP-52) : la liste mesurée avant d'être montrée passe au-dessus si elle dépasserait du bas de la
  // fenêtre et qu'il y a plus de place en haut ; recalculé quand les suggestions changent.
  const [above, setAbove] = useState(false);
  const side: Dropdown = dropdown === "auto" ? (above ? "top" : "bottom") : dropdown;
  useLayoutEffect(() => {
    const box = field.current?.getBoundingClientRect();
    const list = field.current?.parentElement?.querySelector("ul");
    if (dropdown !== "auto" || !open || !box || !list) return;
    const below = window.innerHeight - box.bottom;
    setAbove(list.getBoundingClientRect().height + 8 > below && box.top > below);
  }, [dropdown, open, suggestions]);

  useLayoutEffect(() => {
    const at = nextCaret.current;
    if (at === null || !field.current) return;
    nextCaret.current = null;
    field.current.setSelectionRange(at, at);
  }, [value]);

  /** Nouveau texte écrit ici, curseur de saisie placé en `at`. */
  const rewrite = (next: string, at: number) => {
    setCaret(at);
    if (next === value) field.current?.setSelectionRange(at, at);
    else nextCaret.current = at;
    onChange(next);
  };

  const pick = (tag: TagInfo) => {
    setHighlight(-1);
    if (!search) return onPick?.(tag);
    // Le tag remplace le mot en cours, suivi d'un espace : la liste se ferme, on tape le tag
    // suivant ou Entrée pour lancer la recherche (SRCH-21, choix du 15/10). Au milieu du texte,
    // l'espace est ajouté quand même : ce qu'on tape ensuite forme un nouveau mot.
    const written = `${negated ? "-" : ""}${tag.name} `;
    rewrite(value.slice(0, word.start) + written + value.slice(word.end), word.start + written.length);
  };

  /** + / − : le tag part dans la recherche ; le mot en cours est effacé, les autres restent. */
  const addTerm = (tag: TagInfo, exclude: boolean) => {
    setHighlight(-1);
    onAddTerm?.(tag, exclude);
    rewrite(value.slice(0, word.start) + value.slice(word.end), word.start);
  };

  /** Le curseur de saisie a bougé (flèches, clic) : les suggestions suivent son mot (SRCH-20). */
  const followCaret = (input: HTMLInputElement) => {
    const at = input.selectionStart ?? input.value.length;
    if (!search || at === caret) return;
    setCaret(at);
    setHighlight(-1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (open && moveHighlight(e, suggestions, side, setHighlight, takenHere)) return;
    if (e.key === "Enter") {
      e.preventDefault();
      const chosen = open && highlight >= 0 ? suggestions[highlight] : undefined;
      if (chosen) pick(chosen);
      else if (value.trim()) onSubmit(value);
      setHighlight(-1);
    }
  };

  return (
    <div data-zone={zone} className={cn("relative min-w-0", className)}>
      <input
        ref={field}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart ?? e.target.value.length);
          setHighlight(-1);
          setFocused(true);
        }}
        onSelect={(e) => followCaret(e.currentTarget)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className={cn(
          "h-full w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d9a94e]/60 focus:outline-none",
          inputClassName,
        )}
      />
      {open && (
        <SuggestionList
          zone={zone}
          suggestions={suggestions}
          highlight={highlight}
          setHighlight={setHighlight}
          dropdown={side}
          onPick={pick}
          negated={negated}
          onAddTerm={search ? addTerm : undefined}
          taken={takenHere}
          termTaken={termTaken}
          className="left-0"
        />
      )}
    </div>
  );
}
