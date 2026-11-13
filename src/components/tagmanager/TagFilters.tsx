// Filtres du gestionnaire de tags (TAGM-04) : nom, catégorie, « Masqués », « Rares » (TAGM-11), puis
// « x / N tags ». Au bout du champ du nom, une croix efface le texte tapé (retour T3, point TAGM-04.11) ;
// toujours affichée, grisée (sans bulle) quand le champ est vide ; le curseur reste dans le champ. Le
// compteur garde la largeur du total : il ne rétrécit pas quand x baisse, et les filtres ne bougent pas
// (retour T3, point TAGM-04.12). « Rares » montre son seuil (« Rares ≤ 2 ») ; un clic droit ou la petite flèche
// ouvre le choix de 1 à 5 médias, qui active le filtre (TAGM-25, réponse Q2 A du 13/11).

import { useRef } from "react";
import { ChevronDown, Search, X } from "lucide-react";

import { CategorySelect } from "@/components/tags/CategorySelect";
import { openContextMenu, openMenuAt, type MenuEntry } from "@/lib/contextMenu";
import { formatNumber, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RARE_CHOICES, useRareMax } from "@/stores/rareMax";
import type { Filters } from "./useTagList";

/** Bouton d'un choix à segments (« Masqués | Rares », « Strict | Large » des tags proches). */
export const segment = (on: boolean) =>
  cn("rounded-md px-2.5 py-1 text-xs font-medium transition", on ? "bg-[#d9a94e]/15 text-[#d9a94e]" : "text-muted-foreground hover:text-foreground");

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
  const rareMax = useRareMax((s) => s.max);
  const rareOn = filters.rare;
  const rareMenu = (): MenuEntry[] =>
    RARE_CHOICES.map((n) => ({
      label: `≤ ${n} ${plural(n, "média")}`,
      checked: n === rareMax,
      run: () => {
        useRareMax.getState().setMax(n);
        setFilters((f) => ({ ...f, rare: true }));
      },
    }));
  const rareTitle = rareMax === 1 ? "Seulement les tags portés par un seul média" : `Seulement les tags portés par 1 à ${rareMax} médias`;
  return (
    <div data-zone="gestionnaire-tags.filtres" className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative min-w-60 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          data-zone="gestionnaire-tags.filtre-nom"
          value={filters.text}
          onChange={(e) => setFilters((f) => ({ ...f, text: e.target.value }))}
          placeholder="Chercher un tag…"
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
        <button
          type="button"
          data-zone="gestionnaire-tags.filtre-masques"
          aria-pressed={filters.hidden}
          onClick={() => toggle("hidden")}
          title="Seulement les tags masqués de la recherche"
          className={segment(filters.hidden)}
        >
          Masqués
        </button>
        {/* Bouton et petite flèche dans un même segment, colorés ensemble quand le filtre est actif. */}
        <div
          onContextMenu={(e) => openContextMenu(e, rareMenu)}
          className={cn("flex items-center rounded-md text-xs font-medium transition", rareOn ? "bg-[#d9a94e]/15 text-[#d9a94e]" : "text-muted-foreground")}
        >
          <button
            type="button"
            data-zone="gestionnaire-tags.filtre-rares"
            aria-pressed={rareOn}
            onClick={() => toggle("rare")}
            title={`${rareTitle} (clic droit : changer le seuil)`}
            className={cn("py-1 pr-1 pl-2.5 tabular-nums transition", !rareOn && "hover:text-foreground")}
          >
            Rares ≤ {rareMax}
          </button>
          <button
            type="button"
            data-zone="gestionnaire-tags.filtre-rares.seuil"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              openMenuAt(r.left, r.bottom + 4, rareMenu(), e.detail === 0, { anchor: e.currentTarget });
            }}
            aria-label="Seuil du filtre Rares"
            title="Changer le seuil : 1 à 5 médias"
            className={cn("grid place-items-center self-stretch rounded-md pr-1.5 pl-0.5 transition", rareOn ? "hover:text-[#e3b75f]" : "hover:text-foreground")}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
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
