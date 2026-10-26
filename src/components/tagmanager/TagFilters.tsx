// Filtres du gestionnaire de tags (TAGM-04) : nom, catégorie, « Masqués », « Rares » (TAGM-11), puis
// « x / N tags ». Au bout du champ du nom, une croix efface le texte tapé (retour T3, point TAGM-04.11) ;
// toujours affichée, grisée (sans bulle) quand le champ est vide ; le curseur reste dans le champ. Le
// compteur garde la largeur du total : il ne rétrécit pas quand x baisse, et les filtres ne bougent pas
// (retour T3, point TAGM-04.12).

import { useRef } from "react";
import { Search, X } from "lucide-react";

import { CategorySelect } from "@/components/tags/CategorySelect";
import { formatNumber, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Filters } from "./useTagList";

const SEGMENT = "rounded-md px-2.5 py-1 text-xs font-medium transition";

type Props = {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  /** Tags du filtre en cours, et tous les tags. */
  shown: number;
  total: number;
};

export function TagFilters({ filters, setFilters, shown, total }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const toggle = (key: "hidden" | "rare") => setFilters((f) => ({ ...f, [key]: !f[key] }));
  return (
    <div data-zone="gestionnaire-tags.filtres" className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative min-w-60 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          data-zone="gestionnaire-tags.filtre-nom"
          value={filters.text}
          onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value }))}
          placeholder="Filtrer par nom…"
          spellCheck={false}
          className="h-8 w-full rounded-lg border border-border bg-card/60 pr-8 pl-8 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-[#d9a94e]/60"
        />
        <button
          type="button"
          data-zone="gestionnaire-tags.filtre-nom.effacer"
          disabled={filters.text === ""}
          // Le champ garde le focus pendant le clic.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setFilters((f) => ({ ...f, text: "" }));
            inputRef.current?.focus();
          }}
          aria-label="Effacer"
          title={filters.text === "" ? undefined : "Effacer"}
          className="absolute top-1/2 right-1.5 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-muted-foreground transition enabled:hover:bg-secondary enabled:hover:text-foreground disabled:text-muted-foreground/35"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <CategorySelect
        zone="gestionnaire-tags.filtre-categorie"
        value={filters.category}
        onChange={(category) => setFilters((f) => ({ ...f, category }))}
        allLabel="Toutes les catégories"
        className="h-8 w-48 text-xs"
      />
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card/60 p-0.5">
        {(["hidden", "rare"] as const).map((key) => (
          <button
            key={key}
            type="button"
            data-zone={`gestionnaire-tags.filtre-${key === "hidden" ? "masques" : "rares"}`}
            aria-pressed={filters[key]}
            onClick={() => toggle(key)}
            title={key === "hidden" ? "Seulement les tags masqués de la recherche" : "Seulement les tags portés par un seul média"}
            className={cn(SEGMENT, filters[key] ? "bg-[#d9a94e]/15 text-[#d9a94e]" : "text-muted-foreground hover:text-foreground")}
          >
            {key === "hidden" ? "Masqués" : "Rares"}
          </button>
        ))}
      </div>
      <span data-zone="gestionnaire-tags.filtres.compteur" className="ml-auto text-xs text-muted-foreground tabular-nums">
        {/* Même case que le total, invisible : la place du plus grand nombre possible reste prise. */}
        <span className="inline-grid justify-items-end">
          <span aria-hidden className="invisible col-start-1 row-start-1">
            {formatNumber(total)}
          </span>
          <span className="col-start-1 row-start-1">{formatNumber(shown)}</span>
        </span>{" "}
        / {formatNumber(total)} {plural(total, "tag")}
      </span>
    </div>
  );
}
