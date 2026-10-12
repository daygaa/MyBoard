// État de la visionneuse : média affiché et sa position dans TOUS les résultats de la vue
// courante (filtres, recherche, tri), pour passer d'une page à l'autre sans couture (VIEW-04)
// et rouvrir la grille sur la page du média regardé (VIEW-05).

import { create } from "zustand";

import type { ListQuery, MediaItem } from "@/lib/api";
import { useLibrary } from "./library";
import { useSearch } from "./search";

export type ListBase = Omit<ListQuery, "page">;

type ViewerState = {
  open: boolean;
  /** Position du média dans tous les résultats (0 = le premier). */
  index: number;
  item: MediaItem | null;
  /** Requête figée à l'ouverture (même découpage en pages que la grille). */
  base: ListBase | null;
  total: number;
  /** Lecture en boucle des vidéos (VIEW-26) : activée par défaut, désactivable dans le lecteur. */
  loop: boolean;
  openAt: (index: number, item: MediaItem, pageSize: number) => void;
  show: (index: number, item: MediaItem, total: number) => void;
  close: () => void;
  setLoop: (loop: boolean) => void;
};

export const useViewer = create<ViewerState>()((set, get) => ({
  open: false,
  index: 0,
  item: null,
  base: null,
  total: 0,
  loop: true,
  openAt: (index, item, pageSize) => {
    const { kinds, sort, seed } = useLibrary.getState();
    const { terms } = useSearch.getState();
    set({ open: true, index, item, base: { kinds, terms, sort, seed, pageSize } });
  },
  show: (index, item, total) => set({ index, item, total }),
  close: () => {
    const { base, index } = get();
    // La grille s'ouvre sur la page du média regardé (VIEW-05).
    if (base) useLibrary.getState().setPage(Math.floor(index / base.pageSize) + 1);
    set({ open: false, item: null, base: null });
  },
  setLoop: (loop) => set({ loop }),
}));
