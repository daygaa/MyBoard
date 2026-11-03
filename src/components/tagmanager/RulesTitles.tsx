// Lignes de titres des deux listes de l'onglet « Synonymes et parents » (retour T3, point TAGM-15.10 ; réponses du
// 03/11) : en haut de chaque liste, fixes pendant son défilement, alignées sur les colonnes des lignes, triables au clic
// (rulesSort.ts). « Tag principal » en doré léger, en doré classique quand sa colonne est le tri en cours. « Fusion »
// et « On/Off » commencent au bord gauche de leur interrupteur (« Fusion » et sa flèche débordent sur la place libre
// au-dessus de l'icône de suppression). Rien au-dessus des icônes de suppression.

import { useRulesTab } from "./rulesTabState";
import { useSortBy } from "./rulesSort";
import { SWITCH_COLUMN } from "./RuleLines";
import { SortHeader } from "./SortHeader";

/** Fond opaque de la couleur du cadre : les lignes passent dessous. */
const ROW =
  "sticky top-0 z-[1] flex h-7 items-center gap-2 border-b border-border bg-[color-mix(in_srgb,var(--card)_40%,var(--background))] px-1.5 text-xs font-medium text-muted-foreground";
/** Place d'une icône de 24 px des lignes (flèche de dépliage, suppression). */
const ICON_SPACE = <span className="w-6 shrink-0" />;

export function GroupTitles() {
  const sort = useRulesTab((s) => s.groupSort);
  const sortBy = useSortBy().groups;
  const label = (
    <span className="truncate">
      <span className={sort.key === "name" ? undefined : "text-[#d9a94e]/70"}>Tag principal</span> et synonymes
    </span>
  );
  return (
    <div data-zone="regles.synonymes.titres" className={ROW}>
      {ICON_SPACE}
      <SortHeader zone="regles.synonymes.titres.nom" label={label} sortKey="name" sort={sort} onSort={sortBy} className="min-w-0 flex-1" />
      <SortHeader zone="regles.synonymes.titres.medias" label="Médias" sortKey="media" sort={sort} onSort={sortBy} className="shrink-0" />
      <SortHeader zone="regles.synonymes.titres.fusion" label="Fusion" sortKey="merged" sort={sort} onSort={sortBy} className="w-7 shrink-0" />
      {ICON_SPACE}
    </div>
  );
}

export function ParentTitles() {
  const sort = useRulesTab((s) => s.parentSort);
  const sortBy = useSortBy().parents;
  return (
    <div data-zone="regles.parents.titres" className={ROW}>
      <SortHeader zone="regles.parents.titres.on-off" label="On/Off" sortKey="enabled" sort={sort} onSort={sortBy} className={SWITCH_COLUMN} />
      <SortHeader zone="regles.parents.titres.nom" label="Enfant → parent" sortKey="name" sort={sort} onSort={sortBy} className="min-w-0 flex-1" />
      <SortHeader zone="regles.parents.titres.medias" label="Médias" sortKey="media" sort={sort} onSort={sortBy} className="shrink-0" />
      {ICON_SPACE}
    </div>
  );
}
