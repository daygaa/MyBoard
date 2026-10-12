// Catégories de tags (TAGM-01, TAGM-03) : lues une fois en base, dans l'ordre défini.

import { useQuery } from "@tanstack/react-query";

import { api, type Category } from "@/lib/api";

/** Couleur de repli si une catégorie est inconnue (ne devrait pas arriver). */
export const FALLBACK_COLOR = "#8b8d96";

export function useCategories() {
  const { data } = useQuery({ queryKey: ["categories"], queryFn: api.tagCategories, staleTime: Infinity });
  const list: Category[] = data ?? [];
  const byId = new Map(list.map((c) => [c.id, c]));
  return { list, byId, color: (id: number) => byId.get(id)?.color ?? FALLBACK_COLOR };
}
