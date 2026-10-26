// État de l'interface générale : menu burger (mémorisé, comme dans la v8) ; niveau de détection des tags
// proches (retour T3, point TAGM-13.5, retenu au choix de l'utilisateur).

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { SimilarLevel } from "@/lib/tagManager";

type UIState = {
  burgerOpen: boolean;
  setBurgerOpen: (open: boolean) => void;
  toggleBurger: () => void;
  similarLevel: SimilarLevel;
  setSimilarLevel: (level: SimilarLevel) => void;
};

export const useUI = create<UIState>()(
  persist(
    (set, get) => ({
      burgerOpen: false,
      setBurgerOpen: (burgerOpen) => set({ burgerOpen }),
      toggleBurger: () => set({ burgerOpen: !get().burgerOpen }),
      similarLevel: "strict",
      setSimilarLevel: (similarLevel) => set({ similarLevel }),
    }),
    { name: "myboard.interface" },
  ),
);
