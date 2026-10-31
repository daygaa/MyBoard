// Suggestions de tags (SRCH-06, VIEW-21, IMP-31), communes à la case de saisie d'un tag (TagInput) et au
// champ à pastilles (PillField, SEL-12). Dès la première lettre : tags qui commencent par le texte, puis
// qui le contiennent (D-016) ; ↑ / ↓ ou Tab pour choisir. Liste ouverte au-dessus du champ (visionneuse,
// barre de la sélection) : ordre inversé, le tag le plus utilisé est en bas, au plus près du champ
// (VIEW-21) ; la flèche ↑ monte donc vers les suivants.
// Noms longs : la liste s'élargit jusqu'au double, puis le nom passe sur 2 lignes, puis « … » avec le nom
// complet dans une bulle au survol (SRCH-22). Tag fusionné (TAGM-15) : proposé « tag fusionné → principal ». Tag
// d'un groupe : icône « = » à gauche de son nombre ; au survol, ses autres noms reliés (retour T3, point TAGM-15.26).
// Recherche de la barre latérale (`onAddTerm`) : boutons + / − devant chaque tag (SRCH-21).
// Tag déjà là (`taken`, SRCH-29, choix du 25/10) : il garde sa place, son nom est grisé avec une bulle qui
// dit pourquoi ; un clic sur son nom ne fait rien et les flèches le sautent. Recherche (`termTaken`) : le
// bouton + ou − qui ne changerait rien à la recherche en cours est grisé, avec sa bulle ; l'autre reste
// actif (un tag inclus peut passer en exclusion, et inversement).

import { useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Equal, Minus, Plus, Star } from "lucide-react";

import { HoverCard } from "@/components/ui/hover-card";
import { useCategories } from "@/hooks/useCategories";
import { api, type Synonym, type TagInfo } from "@/lib/api";
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
 *  des tags » de la sélection : seulement les tags qu'elle porte, SEL-07). */
export function useTagSuggestions(text: string, source?: TagInfo[]): TagInfo[] {
  const { data: found = [] } = useQuery({
    queryKey: ["autocomplete", text],
    queryFn: () => api.autocompleteTags(text),
    enabled: text.length > 0 && !source,
    placeholderData: keepPreviousData,
  });
  return source ? suggestionsIn(source, text) : found;
}

/** Tag déjà là : la raison, dite par la bulle de sa suggestion grisée ; `null` : proposé normalement. */
export type Taken = (tag: TagInfo) => string | null;
/** Recherche : bouton + (`exclude` faux) ou − (vrai) sans effet sur la recherche en cours, et pourquoi. */
export type TermTaken = (tag: TagInfo, exclude: boolean) => string | null;

export type Dropdown = "top" | "bottom";

/** ↑ / ↓ (ou Tab, Maj + Tab) dans une liste ouverte ; les tags déjà là sont sautés. Vrai si la touche a
 *  servi. */
export function moveHighlight(e: KeyboardEvent, suggestions: TagInfo[], dropdown: Dropdown, setHighlight: (fn: (h: number) => number) => void, taken?: Taken): boolean {
  const reversed = dropdown === "top";
  const next = e.key === (reversed ? "ArrowUp" : "ArrowDown") || (e.key === "Tab" && !e.shiftKey);
  const previous = e.key === (reversed ? "ArrowDown" : "ArrowUp") || (e.key === "Tab" && e.shiftKey);
  if (!next && !previous) return false;
  e.preventDefault();
  const count = suggestions.length;
  const step = (i: number) => (next ? (i + 1) % count : i <= 0 ? count - 1 : i - 1);
  setHighlight((h) => {
    let i = h;
    for (let k = 0; k < count; k++) {
      i = step(i);
      if (!taken?.(suggestions[i])) return i;
    }
    return -1;
  });
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
  taken?: Taken;
  termTaken?: TermTaken;
  className?: string;
  style?: CSSProperties;
};

/** Bouton + ou − d'une suggestion de la recherche (SRCH-21) ; `off` : sans effet, grisé avec sa bulle. */
function TermButton({ tag, exclude, off, onAdd }: { tag: TagInfo; exclude: boolean; off: string | null; onAdd: (tag: TagInfo, exclude: boolean) => void }) {
  const Icon = exclude ? Minus : Plus;
  const label = exclude ? `Exclure « ${displayTag(tag.name)} » de la recherche` : `Ajouter « ${displayTag(tag.name)} » à la recherche`;
  return (
    <button
      type="button"
      onMouseDown={keepFocus}
      onClick={() => off === null && onAdd(tag, exclude)}
      aria-label={label}
      aria-disabled={off !== null || undefined}
      title={off ?? (exclude ? "Exclure de la recherche" : "Ajouter à la recherche")}
      className={cn(
        "grid h-5 w-5 shrink-0 place-items-center rounded transition",
        off ? "cursor-default text-muted-foreground/25" : cn("text-muted-foreground/70", exclude ? "hover:text-rose-400" : "hover:text-[#d9a94e]"),
      )}
    >
      <Icon className="h-3 w-3" />
    </button>
  );
}

/** Icône « = » d'un tag d'un groupe ; au survol, à côté de la liste, ses autres noms reliés avec leur nombre de
 *  médias, le principal d'abord avec son étoile (retour T3, point TAGM-15.26). */
function SynonymsHint({ synonyms }: { synonyms: Synonym[] }) {
  const { color } = useCategories();
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  return (
    <span
      data-zone="tag.suggestions.synonymes"
      onMouseEnter={(e) => {
        const row = e.currentTarget.closest("li")?.getBoundingClientRect();
        const list = e.currentTarget.closest("ul")?.getBoundingClientRect();
        if (row && list) setAnchor(new DOMRect(list.left, row.top, list.width, row.height));
      }}
      onMouseLeave={() => setAnchor(null)}
      className="grid shrink-0 place-items-center text-muted-foreground transition hover:text-[#d9a94e]"
    >
      <Equal className="h-3.5 w-3.5" />
      {anchor && (
        <HoverCard anchor={anchor} place="side" zone="tag.suggestions.synonymes.liste">
          {synonyms.map((s) => (
            <div key={s.name} className="flex h-7 items-center gap-1.5 text-sm">
              {s.principal ? <Star className="h-3 w-3 shrink-0 fill-[#d9a94e] text-[#d9a94e]" /> : <span className="w-3 shrink-0" />}
              <span className="min-w-0 truncate" style={{ color: color(s.categoryId) }}>
                {displayTag(s.name)}
              </span>
              <span className="ml-auto shrink-0 pl-4 text-xs text-muted-foreground tabular-nums">{formatNumber(s.mediaCount)}</span>
            </div>
          ))}
        </HoverCard>
      )}
    </span>
  );
}

export function SuggestionList({ zone, suggestions, highlight, setHighlight, dropdown, onPick, negated, onAddTerm, taken, termTaken, className, style }: Props) {
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
      {suggestions.map((tag, i) => {
        const reason = taken?.(tag) ?? null;
        return (
        <li
          key={tag.id}
          data-deja-la={reason ? "" : undefined}
          onMouseEnter={() => setHighlight(reason ? -1 : i)}
          className={cn("flex items-center rounded-md", search && "pl-1", i === highlight && ACTIVE, reason && "hover:bg-[#2a2c33]")}
        >
          {search && (
            <>
              <TermButton tag={tag} exclude={false} off={termTaken?.(tag, false) ?? null} onAdd={onAddTerm} />
              <TermButton tag={tag} exclude off={termTaken?.(tag, true) ?? null} onAdd={onAddTerm} />
            </>
          )}
          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={() => reason === null && onPick(tag)}
            title={reason ?? undefined}
            aria-disabled={reason !== null || undefined}
            className={cn("flex min-w-0 flex-1 items-center gap-2 py-1 pr-2 text-left text-sm", search ? "pl-1" : "pl-2", reason && "cursor-default")}
          >
            <span
              onMouseEnter={(e) => !reason && titleIfCut(e.currentTarget)}
              className={cn("line-clamp-2 min-w-0 flex-1 [overflow-wrap:anywhere]", reason && "text-muted-foreground/60")}
              style={reason ? undefined : { color: color(tag.categoryId) }}
            >
              {negated && "−"}
              {tag.alias && <span className="text-muted-foreground">{displayTag(tag.alias)} → </span>}
              {displayTag(tag.name)}
            </span>
            {!tag.alias && tag.synonyms?.length ? <SynonymsHint synonyms={tag.synonyms} /> : null}
            <span className={cn("shrink-0 text-xs tabular-nums", reason ? "text-muted-foreground/60" : "text-muted-foreground")}>{formatNumber(tag.mediaCount)}</span>
          </button>
        </li>
        );
      })}
    </ul>
  );
}
