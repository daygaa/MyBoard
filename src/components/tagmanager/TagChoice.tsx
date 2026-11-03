// Pièces communes aux pop-ins de fusion du gestionnaire (tags proches, fusion de tags cochés) : nom coloré
// avec son nombre de médias, choix du nom gardé (radio, loupe de recherche en option, TAGM-13.1), classes
// des boutons.

import { Search, Star } from "lucide-react";

import { useCategories } from "@/hooks/useCategories";
import type { ManagedTag } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { displayTag } from "@/lib/tags";
import { cn } from "@/lib/utils";

export const CANCEL = "text-foreground hover:bg-secondary hover:text-foreground";
export const RED = "bg-destructive text-white hover:bg-destructive/90";
export const GOLD = "bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f] disabled:hover:bg-[#d9a94e]";

/** Nom coloré selon la catégorie, avec son nombre de médias. */
export function TagName({ tag }: { tag: ManagedTag }) {
  const { color } = useCategories();
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate font-mono" style={{ color: color(tag.categoryId) }}>
        {displayTag(tag.name)}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatNumber(tag.mediaCount)}</span>
    </span>
  );
}

/** Étoile d'un tag principal de son groupe de synonymes (retouche du point TAGM-11.4, 03/11). */
export function PrincipalStar() {
  return <Star aria-label="Tag principal de son groupe" className="h-3 w-3 shrink-0 fill-[#d9a94e] text-[#d9a94e]" />;
}

/** Liste de noms à choisir (radio) : le tag principal d'un groupe à créer. Avec `onSearch`, une loupe au bout de
 *  chaque ligne lance la recherche du tag (la ligne, elle, choisit toujours le nom gardé) ; `principals` : tags déjà
 *  principaux de leur groupe, marqués d'une étoile (bulle Windows). */
export function KeepChoice({
  tags,
  value,
  onChange,
  onSearch,
  principals,
}: {
  tags: ManagedTag[];
  value: number;
  onChange: (id: number) => void;
  onSearch?: (tag: ManagedTag) => void;
  principals?: Set<number>;
}) {
  const stars = principals !== undefined && tags.some((t) => principals.has(t.id));
  return (
    <div className="space-y-0.5">
      {tags.map((t) => (
        <label
          key={t.id}
          title={principals?.has(t.id) ? `« ${displayTag(t.name)} » est déjà le tag principal de son groupe de synonymes` : undefined}
          className={cn("flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-secondary/50", value === t.id && "bg-secondary/60")}
        >
          <input type="radio" checked={value === t.id} onChange={() => onChange(t.id)} className="accent-[#d9a94e]" />
          {stars && (principals?.has(t.id) ? <PrincipalStar /> : <span className="w-3 shrink-0" />)}
          <TagName tag={t} />
          {onSearch && (
            <button
              type="button"
              data-zone="tags-proches.rechercher"
              onClick={(e) => {
                e.preventDefault(); // pas de choix du nom gardé
                onSearch(t);
              }}
              aria-label={`Rechercher « ${displayTag(t.name)} »`}
              title={`Rechercher « ${displayTag(t.name)} »`}
              className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
      ))}
    </div>
  );
}

/** Le plus utilisé est proposé comme nom gardé. */
export const mostUsed = (tags: ManagedTag[]) => tags.reduce((a, b) => (b.mediaCount > a.mediaCount ? b : a)).id;

/** Tag gardé parmi `tags`. */
export const kept = (tags: ManagedTag[], id: number) => tags.find((t) => t.id === id) ?? tags[0];
