// Liste du gestionnaire de tags (TAGM-04) : tous les tags lus une fois, puis filtrés et triés dans
// l'interface (quelques milliers de tags : instantané). Filtres : nom, catégorie, « Masqués »,
// « Rares » (un seul média, TAGM-11) ; tri par colonne, clic sur l'en-tête (un 2e clic inverse).

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useCategories } from "@/hooks/useCategories";
import { api, type ManagedTag } from "@/lib/api";
import { normalizeTag } from "@/lib/tags";

export type SortKey = "name" | "category" | "count" | "created";
export type Sort = { key: SortKey; desc: boolean };

/** Sens d'un premier clic : A → Z pour les noms et catégories, les plus grands d'abord sinon. */
const FIRST_DESC: Record<SortKey, boolean> = { name: false, category: false, count: true, created: true };

export type Filters = { text: string; category: number | null; hidden: boolean; rare: boolean };

export function useTagList() {
  const { data } = useQuery({ queryKey: ["tag-manager"], queryFn: api.listManagedTags });
  const { byId } = useCategories();
  const [filters, setFilters] = useState<Filters>({ text: "", category: null, hidden: false, rare: false });
  const [sort, setSort] = useState<Sort>({ key: "count", desc: true });

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
    };
    const sign = sort.desc ? -1 : 1;
    // À égalité, par nom (toujours de A à Z).
    return list.sort((a, b) => sign * compare[sort.key](a, b) || (sort.key === "name" ? sign : 1) * a.name.localeCompare(b.name));
  }, [all, filters, sort, byId]);

  const filtered = filters.text.trim() !== "" || filters.category !== null || filters.hidden || filters.rare;
  const sortBy = (key: SortKey) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: FIRST_DESC[key] }));
  return { data, visible, filtered, filters, setFilters, sort, sortBy };
}
