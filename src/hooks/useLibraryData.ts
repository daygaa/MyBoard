// Données de la bibliothèque : page de médias affichée et statistiques.

import { useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { THUMB, api, type ListQuery } from "@/lib/api";
import { pageSizeForDensity } from "@/lib/grid";
import { useLibrary } from "@/stores/library";
import { useSearch } from "@/stores/search";

/** Requête de la grille sans la page : filtres, recherche, tri, nombre par page.
 *  La visionneuse s'en sert aussi pour passer d'une page à l'autre (VIEW-04). */
export function useListBase(): Omit<ListQuery, "page"> {
  const pageDensity = useLibrary((s) => s.pageDensity);
  const kinds = useLibrary((s) => s.kinds);
  const sort = useLibrary((s) => s.sort);
  const seed = useLibrary((s) => s.seed);
  const terms = useSearch((s) => s.terms);
  return { kinds, terms, sort, seed, pageSize: pageSizeForDensity(pageDensity) };
}

/** Page courante de la grille selon la densité, les filtres, la recherche et le tri. */
export function useMediaPage() {
  const page = useLibrary((s) => s.page);
  const query: ListQuery = { ...useListBase(), page };

  const result = useQuery({
    queryKey: ["media", query],
    queryFn: () => api.listMedia(query),
    // L'ancienne page reste affichée pendant le chargement de la suivante : pas de clignotement.
    placeholderData: keepPreviousData,
  });

  const data = result.data;
  useEffect(() => {
    if (!data) return;
    // Page demandée hors limites (bibliothèque réduite…) : on suit la page réellement renvoyée.
    if (data.page !== useLibrary.getState().page) useLibrary.getState().setPage(data.page);
    // Miniatures manquantes de cette page : à faire en priorité (LIB-06).
    const todo = data.items.filter((m) => m.thumbStatus === THUMB.todo).map((m) => m.id);
    if (todo.length > 0) void api.prioritizeThumbs(todo);
  }, [data]);

  return result;
}

/** Compteurs de l'en-tête (NAV-03) et de la page d'import.
 *  `followThumbs` : relit chaque seconde tant que des miniatures restent à créer. */
export function useStats(followThumbs = false) {
  return useQuery({
    queryKey: ["stats"],
    queryFn: api.stats,
    refetchInterval: (query) => (followThumbs && (query.state.data?.thumbsPending ?? 0) > 0 ? 1000 : false),
  });
}
