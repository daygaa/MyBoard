// Liste du gestionnaire de tags (TAGM-04) : tous les tags lus une fois, puis filtrés et triés dans
// l'interface (quelques milliers de tags : instantané). Filtres : nom, catégorie, « Masqués »,
// « Rares » (un seul média, TAGM-11) ; tri par colonne, clic sur l'en-tête (un 2e clic inverse).
// Tris Description, Synonymes, Parents (TAGM-04.7) : les tags qui en ont d'abord (le plus de synonymes /
// de parents en haut), puis ceux qui n'en ont pas ; à égalité, toujours de A à Z. Filtres et tri sont rangés dans
// l'état de la page d'historique (tagsTabState.ts, retour T3, point TAGM-04.14).

import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStore, type StoreApi } from "zustand";

import { useCategories } from "@/hooks/useCategories";
import type { RulesIndex } from "@/hooks/useTagRules";
import { api, type ManagedTag } from "@/lib/api";
import { glideToTop } from "@/lib/scroller";
import { normalizeTag } from "@/lib/tags";
import { STEP, type TagsTabState } from "./tagsTabState";

export type SortKey = "name" | "category" | "count" | "created" | "description" | "aliases" | "parents";
export type Sort = { key: SortKey; desc: boolean };

/** Sens d'un premier clic : A → Z pour les noms et catégories, les plus grands d'abord sinon. */
const FIRST_DESC: Record<SortKey, boolean> = { name: false, category: false, count: true, created: true, description: true, aliases: true, parents: true };

export type Filters = { text: string; category: number | null; hidden: boolean; rare: boolean };

export function useTagList(rules: RulesIndex, store: StoreApi<TagsTabState>) {
  const { data } = useQuery({ queryKey: ["tag-manager"], queryFn: api.listManagedTags });
  const { byId } = useCategories();
  const filters = useStore(store, (s) => s.filters);
  const sort = useStore(store, (s) => s.sort);
  // Un nouveau filtre ou tri repart des 100 premiers (TAGM-04.5), en haut de la page (retour T3, point TAGM-04.13).
  const change = useCallback(
    (patch: Partial<TagsTabState>) => {
      store.setState({ ...patch, limit: STEP });
      glideToTop();
    },
    [store],
  );
  const setFilters: Dispatch<SetStateAction<Filters>> = useCallback(
    (v) => change({ filters: typeof v === "function" ? v(store.getState().filters) : v }),
    [change, store],
  );

  const all = data?.tags;
  const visible = useMemo(() => {
    const text = normalizeTag(filters.text);
    const list = (all ?? []).filter(
      (t) =>
        (!text || t.name.includes(text)) &&
        (filters.category === null || t.categoryId === filters.category) &&
        (!filters.hidden || t.hidden) &&
        (!filters.rare || t.mediaCount === 1),
    );
    const order = (t: ManagedTag) => byId.get(t.categoryId)?.sortOrder ?? 99;
    const compare: Record<SortKey, (a: ManagedTag, b: ManagedTag) => number> = {
      name: () => 0,
      category: (a, b) => order(a) - order(b),
      count: (a, b) => a.mediaCount - b.mediaCount,
      created: (a, b) => a.createdAt - b.createdAt,
      description: (a, b) => Number(!!a.description) - Number(!!b.description),
      aliases: (a, b) => (rules.groupOf.get(a.id)?.names.length ?? 0) - (rules.groupOf.get(b.id)?.names.length ?? 0),
      parents: (a, b) => (rules.parentsOf.get(a.id)?.length ?? 0) - (rules.parentsOf.get(b.id)?.length ?? 0),
    };
    const sign = sort.desc ? -1 : 1;
    // À égalité, par nom (toujours de A à Z).
    return list.sort((a, b) => sign * compare[sort.key](a, b) || (sort.key === "name" ? sign : 1) * a.name.localeCompare(b.name));
  }, [all, filters, sort, byId, rules]);

  const filtered = filters.text.trim() !== "" || filters.category !== null || filters.hidden || filters.rare;
  const sortBy = (key: SortKey) => change({ sort: sort.key === key ? { key, desc: !sort.desc } : { key, desc: FIRST_DESC[key] } });
  return { data, visible, filtered, filters, setFilters, sort, sortBy };
}
