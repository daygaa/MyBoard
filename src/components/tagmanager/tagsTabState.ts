// État de l'onglet « Tags » du gestionnaire, un par page de l'historique (retour T3, point TAGM-04.14, 31/10), comme
// celui de l'onglet « Synonymes et parents » (rulesTabState.ts) : une ouverture de l'onglet par un clic part de
// zéro ; un retour arrière / avant sur une page de l'onglet retrouve ses filtres, son tri, le nombre de tags
// affichés, les tags cochés et la position dans la liste (réponse C du 31/10). Numéro de la page : `ongletTags`.

import { useCallback, useEffect, useLayoutEffect, useRef, type SetStateAction } from "react";
import { useStore, type StoreApi } from "zustand";

import { historyPageStates } from "@/lib/pageStates";
import { tagTabOf } from "@/lib/router";
import { scroller } from "@/lib/scroller";
import type { Filters, Sort } from "./useTagList";

export type TagsTabState = {
  filters: Filters;
  sort: Sort;
  /** Tags affichés (« Afficher 100 de plus », TAGM-04.5). */
  limit: number;
  checked: Set<number>;
  /** Position dans la page. */
  scroll: number;
};

/** Tags affichés à la fois, puis en plus à chaque « Afficher 100 de plus » (TAGM-04.5). */
export const STEP = 100;
export const NO_FILTERS: Filters = { text: "", category: null, hidden: false, rare: false };

export const freshTagsTab = (): TagsTabState => ({ filters: NO_FILTERS, sort: { key: "count", desc: true }, limit: STEP, checked: new Set(), scroll: 0 });

const FIELD = "ongletTags";

/** Page de l'onglet affichée, relue à chaque retour arrière / avant ; son état. */
export const useTagsEntry = historyPageStates<TagsTabState>(FIELD, (hash) => tagTabOf(hash) === "tags", freshTagsTab);

/** Nombre de tags affichés et tags cochés de la page ; sa position, remise une fois les tags lus (`ready`). */
export function useTagsTab(store: StoreApi<TagsTabState>, ready: boolean) {
  useTagsScroll(store, ready);
  const limit = useStore(store, (s) => s.limit);
  const checked = useStore(store, (s) => s.checked);
  const setChecked = useCallback(
    (v: SetStateAction<Set<number>>) => store.setState((s) => ({ checked: typeof v === "function" ? v(s.checked) : v })),
    [store],
  );
  return { limit, checked, setChecked };
}

/** Position dans la page : notée à chaque défilement tant que cette page est affichée (la quitter fait défiler la
 *  zone avant que l'onglet disparaisse), remise à son retour. */
function useTagsScroll(store: StoreApi<TagsTabState>, ready: boolean) {
  const restored = useRef(false);
  useLayoutEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    scroller().scrollTop = store.getState().scroll;
  }, [ready, store]);
  useEffect(() => {
    const area = scroller();
    const key = (window.history.state as Record<string, unknown> | null)?.[FIELD];
    const onScroll = () => {
      const here = tagTabOf(window.location.hash) === "tags" && (window.history.state as Record<string, unknown> | null)?.[FIELD] === key;
      if (here && restored.current) store.setState({ scroll: area.scrollTop });
    };
    area.addEventListener("scroll", onScroll, { passive: true });
    return () => area.removeEventListener("scroll", onScroll);
  }, [store]);
}
