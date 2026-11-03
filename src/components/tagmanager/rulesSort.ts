// Tris des deux listes de l'onglet « Synonymes et parents » (retour T3, point TAGM-15.10, réponses du 03/11) : ordre
// alphabétique par défaut (2e clic : inversé) ; « Médias » (le plus d'abord, puis l'inverse) ; « Fusion » (groupes
// fusionnés en haut, fusions partielles entre les deux) ; « On/Off » (règles activées en haut) ; à égalité, toujours
// de A à Z. L'ordre obtenu est figé pour la page jusqu'au prochain clic sur un titre : une ligne dont l'interrupteur
// change ne bouge pas (comme un changement de principal, point TAGM-15.19) ; un nouvel élément prend sa place.

import { useEffect, useMemo } from "react";

import { groupState } from "@/lib/groupRules";
import type { GroupRow, ParentRow } from "@/lib/rulesApi";
import { frozenOrder, useRulesStore, useRulesTab, type GroupSortKey, type ParentSortKey } from "./rulesTabState";
import type { ColumnSort } from "./SortHeader";

type Compare<T> = (a: T, b: T) => number;

/** Sens d'un premier clic : A → Z pour les noms ; le plus de médias, les groupes fusionnés, les règles activées
 *  d'abord. */
const FIRST_DESC: Record<GroupSortKey | ParentSortKey, boolean> = { name: false, media: true, merged: true, enabled: true };

const next = <K extends GroupSortKey | ParentSortKey>(sort: ColumnSort<K>, key: K): ColumnSort<K> => (sort.key === key ? { key, desc: !sort.desc } : { key, desc: FIRST_DESC[key] });

/** Identifiants dans l'ordre du tri ; à égalité, par nom de A à Z (le tri par nom suit son sens). */
function sortedIds<T extends { id: number }, K extends string>(items: T[], sort: ColumnSort<K>, by: Record<K, Compare<T>>, byName: Compare<T>): number[] {
  const sign = sort.desc ? -1 : 1;
  return [...items].sort((a, b) => sign * by[sort.key](a, b) || (sort.key === "name" ? sign : 1) * byName(a, b)).map((x) => x.id);
}

/** Fusionné, à moitié, non fusionné. */
const fused = (g: GroupRow) => ({ true: 2, mixed: 1, false: 0 })[String(groupState(g)) as "true" | "mixed" | "false"];
const GROUP_BY: Record<GroupSortKey, Compare<GroupRow>> = {
  name: () => 0,
  media: (a, b) => a.media - b.media,
  merged: (a, b) => fused(a) - fused(b),
};
const PARENT_BY: Record<ParentSortKey, Compare<ParentRow>> = {
  name: () => 0,
  media: (a, b) => a.media - b.media,
  enabled: (a, b) => Number(a.enabled) - Number(b.enabled),
};

/** Ordre figé de la liste `field` (état de la page), refait quand il est vidé par un clic sur un titre. */
function useFrozen(ids: number[], field: "order" | "parentOrder"): number[] {
  const store = useRulesStore();
  const frozen = useRulesTab((s) => s[field]);
  const order = useMemo(() => frozenOrder(ids, frozen), [ids, frozen]);
  useEffect(() => {
    if (!frozen || order.length !== frozen.length || order.some((id, i) => id !== frozen[i])) store.setState(field === "order" ? { order } : { parentOrder: order });
  }, [store, order, frozen, field]);
  return order;
}

/** Ordre des groupes (le nom du principal vient avec le groupe : il ne dépend pas de la relecture des tags). */
export function useGroupOrder(groups: GroupRow[]): number[] {
  const sort = useRulesTab((s) => s.groupSort);
  const ids = useMemo(() => sortedIds(groups, sort, GROUP_BY, (a, b) => a.principalName.localeCompare(b.principalName)), [groups, sort]);
  return useFrozen(ids, "order");
}

/** Ordre des règles ; par nom : l'enfant, puis le parent. */
export function useParentOrder(parents: ParentRow[], name: (id: number) => string): number[] {
  const sort = useRulesTab((s) => s.parentSort);
  const ids = sortedIds(parents, sort, PARENT_BY, (a, b) => name(a.childId).localeCompare(name(b.childId)) || name(a.parentId).localeCompare(name(b.parentId)));
  // Mêmes identifiants dans le même ordre : même tableau (l'ordre figé n'est pas relu pour rien).
  const key = ids.join(",");
  const stable = useMemo(() => ids, [key]);
  return useFrozen(stable, "parentOrder");
}

/** Clic sur un titre : nouveau tri, ordre refait. */
export function useSortBy() {
  const store = useRulesStore();
  return {
    groups: (key: GroupSortKey) => store.setState((s) => ({ groupSort: next(s.groupSort, key), order: null })),
    parents: (key: ParentSortKey) => store.setState((s) => ({ parentSort: next(s.parentSort, key), parentOrder: null })),
  };
}
