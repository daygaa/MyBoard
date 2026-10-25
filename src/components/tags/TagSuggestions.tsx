// Suggestions de tags (SRCH-06, VIEW-21, IMP-31), communes à la case de saisie d'un tag (TagInput) et au
// champ à pastilles (PillField, SEL-12). Dès la première lettre : tags qui commencent par le texte, puis
// qui le contiennent (D-016) ; ↑ / ↓ ou Tab pour choisir. Liste ouverte au-dessus du champ (visionneuse,
// barre de la sélection) : ordre inversé, le tag le plus utilisé est en bas, au plus près du champ
// (VIEW-21) ; la flèche ↑ monte donc vers les suivants.
// Noms longs : la liste s'élargit jusqu'au double, puis le nom passe sur 2 lignes, puis « … » avec le nom
// complet dans une bulle au survol (SRCH-22). Synonyme (TAGM-15) : proposé « synonyme → tag ».
// Recherche de la barre latérale (`onAddTerm`) : boutons + / − devant chaque tag (SRCH-21).

import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Minus, Plus } from "lucide-react";

import { useCategories } from "@/hooks/useCategories";
import { api, type TagInfo } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { displayTag } from "@/lib/tags";
import { cn, titleIfCut } from "@/lib/utils";

/** Suggestions au plus, comme l'autocomplétion du cœur Rust (D-016). */
const MAX_SUGGESTIONS = 10;

/** Même ordre que l'autocomplétion : les tags qui commencent par le texte, puis ceux qui le contiennent. */
function suggestionsIn(source: TagInfo[], text: string): TagInfo[] {
  const starts = source.filter((t) => t.name.startsWith(text));
  const contains = source.filter((t) => !t.name.startsWith(text) && t.name.includes(text));
  return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
}

/** Suggestions pour `text` (déjà normalisé) : parmi tous les tags, ou dans `source` (champ « Retirer
 *  des tags » de la sélection : seulement les tags qu'elle porte, SEL-07). `hidden` : noms des tags
 *  déjà écrits ou déjà là, jamais proposés (SRCH-29). */
export function useTagSuggestions(text: string, source?: TagInfo[], hidden: string[] = []): TagInfo[] {
  const { data: found = [] } = useQuery({
    queryKey: ["autocomplete", text, hidden],
    queryFn: () => api.autocompleteTags(text, hidden),
    enabled: text.length > 0 && !source,
    placeholderData: keepPreviousData,
  });
  return source ? suggestionsIn(source.filter((t) => !hidden.includes(t.name)), text) : found;
}

export type Dropdown = "top" | "bottom";

/** ↑ / ↓ (ou Tab, Maj + Tab) dans une liste ouverte de `count` suggestions ; vrai si la touche a servi. */
export function moveHighlight(e: KeyboardEvent, count: number, dropdown: Dropdown, setHighlight: (fn: (h: number) => number) => void): boolean {
  const reversed = dropdown === "top";
  const next = e.key === (reversed ? "ArrowUp" : "ArrowDown") || (e.key === "Tab" && !e.shiftKey);
  const previous = e.key === (reversed ? "ArrowDown" : "ArrowUp") || (e.key === "Tab" && e.shiftKey);
  if (!next && !previous) return false;
  e.preventDefault();
  setHighlight((h) => (next ? (h + 1) % count : h <= 0 ? count - 1 : h - 1));
  return true;
}

/** Suggestion survolée ou choisie au clavier (SRCH-23) : gris plus clair que le fond de la liste
 *  (#1f2126), comme le survol des lignes de tags de la barre latérale. */
const ACTIVE = "bg-[#2a2c33]";

/** Garde le focus dans le champ : le clic ne doit pas fermer la liste avant d'agir. */
const keepFocus = (e: MouseEvent) => e.preventDefault();

type Props = {
  zone: string;
  suggestions: TagInfo[];
  highlight: number;
  setHighlight: (index: number) => void;
  dropdown: Dropdown;
  onPick: (tag: TagInfo) => void;
  /** Recherche : « -tag » tapé, la suggestion est affichée « −tag ». */
  negated?: boolean;
  onAddTerm?: (tag: TagInfo, exclude: boolean) => void;
  className?: string;
  style?: CSSProperties;
};

export function SuggestionList({ zone, suggestions, highlight, setHighlight, dropdown, onPick, negated, onAddTerm, className, style }: Props) {
  const { color } = useCategories();
  const search = onAddTerm !== undefined;
  return (
    <ul
      data-zone={`${zone}.suggestions`}
      style={style}
      className={cn(
        // Largeur d'origine : celle du champ, 14rem au moins ; jusqu'au double pour un nom long, au-delà il
        // passe sur 2 lignes, puis « … » (SRCH-22). Hauteur : celle des suggestions (10 au plus), toutes
        // affichées, sans barre de défilement (SRCH-25).
        "absolute z-50 w-max max-w-[calc(2*max(100%,14rem))] min-w-[max(100%,14rem)] rounded-lg border border-border bg-popover p-1 shadow-lg",
        // Au-dessus : liste à l'envers (le plus utilisé en bas, au plus près du champ).
        dropdown === "top" ? "bottom-full mb-1 flex flex-col-reverse" : "top-full mt-1",
        className,
      )}
    >
      {suggestions.map((tag, i) => (
        <li key={tag.id} onMouseEnter={() => setHighlight(i)} className={cn("flex items-center rounded-md", search && "pl-1", i === highlight && ACTIVE)}>
          {search && (
            <>
              <button
                type="button"
                onMouseDown={keepFocus}
                onClick={() => onAddTerm(tag, false)}
                aria-label={`Ajouter « ${displayTag(tag.name)} » à la recherche`}
                title="Ajouter à la recherche"
                className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground/70 transition hover:text-[#d9a94e]"
              >
                <Plus className="h-3 w-3" />
              </button>
              <button
                type="button"
                onMouseDown={keepFocus}
                onClick={() => onAddTerm(tag, true)}
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
            onClick={() => onPick(tag)}
            className={cn("flex min-w-0 flex-1 items-center gap-2 py-1 pr-2 text-left text-sm", search ? "pl-1" : "pl-2")}
          >
            <span
              onMouseEnter={(e) => titleIfCut(e.currentTarget)}
              className="line-clamp-2 min-w-0 flex-1 [overflow-wrap:anywhere]"
              style={{ color: color(tag.categoryId) }}
            >
              {negated && "−"}
              {tag.alias && <span className="text-muted-foreground">{displayTag(tag.alias)} → </span>}
              {displayTag(tag.name)}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatNumber(tag.mediaCount)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
