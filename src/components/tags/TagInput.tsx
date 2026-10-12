// Champ de saisie de tag avec autocomplétion (SRCH-06, VIEW-21, IMP-31) — un seul composant
// pour la recherche de la barre latérale, la visionneuse et les tags par défaut de l'import.
// Suggestions dès la première lettre : tags qui commencent par le texte, puis qui le
// contiennent (D-016). ↑ / ↓ ou Tab pour choisir, Entrée pour valider, Échap pour fermer.
// Liste ouverte au-dessus du champ (visionneuse) : ordre inversé, le tag le plus utilisé est
// en bas, au plus près du champ (VIEW-21) ; la flèche ↑ monte donc vers les suivants.

import { useState, type KeyboardEvent, type Ref } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useCategories } from "@/hooks/useCategories";
import { api, type TagInfo } from "@/lib/api";
import { useEscape } from "@/lib/escape";
import { formatNumber } from "@/lib/format";
import { displayTag, normalizeTag } from "@/lib/tags";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Entrée sans suggestion choisie : le texte tel quel. */
  onSubmit: (text: string) => void;
  /** Suggestion choisie ; `negated` : le texte commençait par « - » (exclusion, SRCH-03). */
  onPick: (tag: TagInfo, negated: boolean) => void;
  placeholder: string;
  /** Côté où s'ouvrent les suggestions (« top » dans la visionneuse, VIEW-21). */
  dropdown?: "top" | "bottom";
  /** « -tag » autorisé (recherche) : les suggestions portent sur le texte après le « - ». */
  allowNegation?: boolean;
  zone: string;
  className?: string;
  /** Ajustements du champ lui-même (taille, fond…). */
  inputClassName?: string;
  inputRef?: Ref<HTMLInputElement>;
};

export function TagInput({
  value,
  onChange,
  onSubmit,
  onPick,
  placeholder,
  dropdown = "bottom",
  allowNegation = false,
  zone,
  className,
  inputClassName,
  inputRef,
}: Props) {
  const { color } = useCategories();
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const negated = allowNegation && value.trimStart().startsWith("-");
  const text = normalizeTag(value);

  const { data: suggestions = [] } = useQuery({
    queryKey: ["autocomplete", text],
    queryFn: () => api.autocompleteTags(text),
    enabled: text.length > 0,
    placeholderData: keepPreviousData,
  });
  const open = focused && text.length > 0 && suggestions.length > 0;
  // Échap ferme d'abord les suggestions, sans fermer la visionneuse derrière.
  useEscape(open, () => setFocused(false));

  const pick = (tag: TagInfo) => {
    onPick(tag, negated);
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
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setHighlight(-1);
          setFocused(true);
        }}
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
            "absolute right-0 left-0 z-50 max-h-72 min-w-56 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg",
            // Au-dessus : liste à l'envers (le plus utilisé en bas), qui s'ouvre défilée en bas.
            dropdown === "top" ? "bottom-full mb-1 flex flex-col-reverse" : "top-full mt-1",
          )}
        >
          {suggestions.map((tag, i) => (
            <li key={tag.id}>
              <button
                type="button"
                // Garde le focus dans le champ : le clic ne doit pas fermer la liste avant d'agir.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(tag)}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm",
                  i === highlight ? "bg-secondary" : "hover:bg-secondary",
                )}
              >
                <span className="min-w-0 flex-1 truncate" style={{ color: color(tag.categoryId) }}>
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
