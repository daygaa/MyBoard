// Case de saisie d'un tag avec autocomplétion (SRCH-06, VIEW-21, IMP-31) : ajout de tag de la
// visionneuse, tags par défaut de l'import, règles du gestionnaire. Tout le texte forme un seul tag.
// Suggestions (liste commune : TagSuggestions.tsx) : ↑ / ↓ ou Tab pour choisir, Entrée pour valider,
// Échap pour fermer ; `hidden` : tags déjà là, jamais proposés (SRCH-29). Les champs à plusieurs tags
// (barre de la sélection, recherche) sont des champs à pastilles (PillField).
// `source` : suggestions prises dans une liste donnée, dans le même ordre que l'autocomplétion.

import { useState, type KeyboardEvent } from "react";

import type { TagInfo } from "@/lib/api";
import { useEscape } from "@/lib/escape";
import { normalizeTag } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { moveHighlight, SuggestionList, useTagSuggestions, type Dropdown } from "./TagSuggestions";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Entrée sans suggestion choisie : le texte tel quel. */
  onSubmit: (text: string) => void;
  /** Suggestion choisie. */
  onPick?: (tag: TagInfo) => void;
  placeholder: string;
  /** Côté où s'ouvrent les suggestions (« top » dans la visionneuse, VIEW-21). */
  dropdown?: Dropdown;
  zone: string;
  className?: string;
  /** Ajustements du champ lui-même (taille, fond…). */
  inputClassName?: string;
  /** Suggestions prises dans cette liste (déjà triée par usage) plutôt que parmi tous les tags. */
  source?: TagInfo[];
  /** Noms des tags à ne pas proposer (déjà sur le média, déjà dans la liste…). */
  hidden?: string[];
};

export function TagInput({ value, onChange, onSubmit, onPick, placeholder, dropdown = "bottom", zone, className, inputClassName, source, hidden }: Props) {
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const text = normalizeTag(value);
  const suggestions = useTagSuggestions(text, source, hidden);
  const open = focused && text.length > 0 && suggestions.length > 0;
  // Échap ferme d'abord les suggestions, sans fermer la visionneuse derrière ; les boutons 4 / 5 et
  // les flèches de la barre de titre les ignorent (NAV-07).
  useEscape(open, () => setFocused(false), { escapeOnly: true });

  const pick = (tag: TagInfo) => {
    setHighlight(-1);
    onPick?.(tag);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (open && moveHighlight(e, suggestions.length, dropdown, setHighlight)) return;
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
        <SuggestionList
          zone={zone}
          suggestions={suggestions}
          highlight={highlight}
          setHighlight={setHighlight}
          dropdown={dropdown}
          onPick={pick}
          className="left-0"
        />
      )}
    </div>
  );
}
