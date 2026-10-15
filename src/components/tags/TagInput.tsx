// Champ de saisie de tag avec autocomplétion (SRCH-06, VIEW-21, IMP-31) — un seul composant
// pour la recherche de la barre latérale, la visionneuse et les tags par défaut de l'import.
// Suggestions dès la première lettre : tags qui commencent par le texte, puis qui le
// contiennent (D-016). ↑ / ↓ ou Tab pour choisir, Entrée pour valider, Échap pour fermer.
// Liste ouverte au-dessus du champ (visionneuse) : ordre inversé, le tag le plus utilisé est
// en bas, au plus près du champ (VIEW-21) ; la flèche ↑ monte donc vers les suivants.
// Recherche de la barre latérale (`onAddTerm`) : plusieurs termes séparés par des espaces, les
// suggestions portent sur le mot en cours (SRCH-20) ; le nom choisi s'écrit dans le champ à la
// place de ce mot, les boutons + / − l'ajoutent tout de suite à la recherche (SRCH-21).
// Noms longs : la liste s'élargit jusqu'au double, puis le nom passe sur 2 lignes (SRCH-22).

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type Ref } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";

import { useCategories } from "@/hooks/useCategories";
import { api, type TagInfo } from "@/lib/api";
import { useEscape } from "@/lib/escape";
import { formatNumber } from "@/lib/format";
import { displayTag, normalizeTag, wordAt } from "@/lib/tags";
import { cn } from "@/lib/utils";

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
  /** Côté où s'ouvrent les suggestions (« top » dans la visionneuse, VIEW-21). */
  dropdown?: "top" | "bottom";
  zone: string;
  className?: string;
  /** Ajustements du champ lui-même (taille, fond…). */
  inputClassName?: string;
  inputRef?: Ref<HTMLInputElement>;
};

/** Suggestion survolée ou choisie au clavier (SRCH-23) : gris plus clair que le fond de la liste
 *  (#1f2126), comme le survol des lignes de tags de la barre latérale. */
const ACTIVE = "bg-[#2a2c33]";

/** Garde le focus dans le champ : le clic ne doit pas fermer la liste avant d'agir. */
const keepFocus = (e: MouseEvent) => e.preventDefault();

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
  inputRef,
}: Props) {
  const { color } = useCategories();
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

  const { data: suggestions = [] } = useQuery({
    queryKey: ["autocomplete", text],
    queryFn: () => api.autocompleteTags(text),
    enabled: text.length > 0,
    placeholderData: keepPreviousData,
  });
  const open = focused && text.length > 0 && suggestions.length > 0;
  // Échap ferme d'abord les suggestions, sans fermer la visionneuse derrière.
  useEscape(open, () => setFocused(false));

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
    const reversed = dropdown === "top";
    const nextKey = reversed ? "ArrowUp" : "ArrowDown";
    const previousKey = reversed ? "ArrowDown" : "ArrowUp";
    if (e.key === nextKey || (e.key === "Tab" && !e.shiftKey && open)) {
      if (!open) return;
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === previousKey || (e.key === "Tab" && e.shiftKey && open)) {
      if (!open) return;
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === "Enter") {
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
        ref={(el) => {
          field.current = el;
          if (typeof inputRef === "function") inputRef(el);
          else if (inputRef) inputRef.current = el;
        }}
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
        <ul
          data-zone={`${zone}.suggestions`}
          className={cn(
            // Largeur d'origine : celle du champ, 14rem au moins ; jusqu'au double pour un nom long,
            // au-delà il passe sur 2 lignes, puis « … » (SRCH-22).
            "absolute left-0 z-50 max-h-72 w-max max-w-[calc(2*max(100%,14rem))] min-w-[max(100%,14rem)] overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg",
            // Au-dessus : liste à l'envers (le plus utilisé en bas), qui s'ouvre défilée en bas.
            dropdown === "top" ? "bottom-full mb-1 flex flex-col-reverse" : "top-full mt-1",
          )}
        >
          {suggestions.map((tag, i) => (
            <li
              key={tag.id}
              onMouseEnter={() => setHighlight(i)}
              className={cn("flex items-center rounded-md", search && "pl-1", i === highlight && ACTIVE)}
            >
              {search && (
                <>
                  <button
                    type="button"
                    onMouseDown={keepFocus}
                    onClick={() => addTerm(tag, false)}
                    aria-label={`Ajouter « ${displayTag(tag.name)} » à la recherche`}
                    title="Ajouter à la recherche"
                    className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground/70 transition hover:text-[#d9a94e]"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={keepFocus}
                    onClick={() => addTerm(tag, true)}
                    aria-label={`Exclure « ${displayTag(tag.name)} » de la recherche`}
                    title="Exclure de la recherche"
                    className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground/70 transition hover:text-rose-400"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                </>
              )}
              <button
                type="button"
                onMouseDown={keepFocus}
                onClick={() => pick(tag)}
                className={cn("flex min-w-0 flex-1 items-center gap-2 py-1 pr-2 text-left text-sm", search ? "pl-1" : "pl-2")}
              >
                <span className="line-clamp-2 min-w-0 flex-1 [overflow-wrap:anywhere]" style={{ color: color(tag.categoryId) }}>
                  {negated && "−"}
                  {displayTag(tag.name)}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatNumber(tag.mediaCount)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
