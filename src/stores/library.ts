// État de la grille : densité, filtres, tri, page.
// Densité, filtres et tri sont mémorisés entre deux lancements (FILT-06) ;
// changer de filtre ou de tri ne touche jamais à la densité (GRID-07).

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { MediaKind } from "@/lib/api";
import { DENSITY_DEFAULT, clampDensity, pageSizeForDensity, type SortValue } from "@/lib/grid";

/** Délai avant d'adapter le nombre de médias par page à une nouvelle densité. */
const PAGE_SIZE_DELAY = 250;

type LibraryState = {
  /** Colonnes affichées : appliqué immédiatement (simple calcul d'affichage, D-008). */
  density: number;
  /** Densité qui fixe le nombre de médias par page (GRID-05) : suit `density` après
   *  PAGE_SIZE_DELAY, pour qu'une rotation de molette de 10 crans ne charge qu'une page. */
  pageDensity: number;
  /** Types cochés ; vide = « Tout ». */
  kinds: MediaKind[];
  sort: SortValue;
  /** Graine du tri aléatoire : nouvelle à chaque choix de « Aléatoire ». */
  seed: number;
  page: number;
  setDensity: (n: number) => void;
  toggleKind: (kind: MediaKind) => void;
  showAllKinds: () => void;
  setSort: (sort: SortValue) => void;
  setPage: (page: number) => void;
};

const newSeed = () => Math.floor(Math.random() * 1_000_000_000);
let pageSizeTimer: ReturnType<typeof setTimeout> | undefined;

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      density: DENSITY_DEFAULT,
      pageDensity: DENSITY_DEFAULT,
      kinds: [],
      sort: "recent",
      seed: newSeed(),
      page: 1,

      setDensity: (n) => {
        const next = clampDensity(n);
        if (next === get().density) return;
        set({ density: next });
        clearTimeout(pageSizeTimer);
        pageSizeTimer = setTimeout(() => {
          const { density, pageDensity, page } = get();
          if (density === pageDensity) return;
          // On garde à l'écran la page qui contient le premier média affiché,
          // au lieu de revenir à la page 1.
          const firstIndex = (page - 1) * pageSizeForDensity(pageDensity);
          set({ pageDensity: density, page: Math.floor(firstIndex / pageSizeForDensity(density)) + 1 });
        }, PAGE_SIZE_DELAY);
      },

      toggleKind: (kind) => {
        const { kinds } = get();
        const next = kinds.includes(kind) ? kinds.filter((k) => k !== kind) : [...kinds, kind];
        set({ kinds: next, page: 1 });
      },

      showAllKinds: () => set({ kinds: [], page: 1 }),

      setSort: (sort) => set({ sort, page: 1, ...(sort === "random" ? { seed: newSeed() } : {}) }),

      setPage: (page) => set({ page: Math.max(1, Math.floor(page)) }),
    }),
    {
      name: "myboard.grille",
      // La page n'est pas mémorisée : au lancement, on repart de la page 1.
      partialize: ({ density, kinds, sort, seed }) => ({ density, kinds, sort, seed }),
      // Au lancement, le nombre par page correspond directement à la densité mémorisée.
      merge: (persisted, current) => {
        const saved = persisted as Partial<LibraryState> | undefined;
        const density = saved?.density ?? current.density;
        return { ...current, ...saved, density, pageDensity: density };
      },
    },
  ),
);
