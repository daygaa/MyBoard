// État de l'interface générale : menu burger (mémorisé, comme dans la v8) ; niveau de détection des tags
// proches (retour T3, point TAGM-13.5, retenu au choix de l'utilisateur) ; case « Supprimer définitivement » de la
// pop-in des tags non utilisés (TAGM-19, retenue même après la fermeture de MyBoard, demande du 05/11).

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { SimilarLevel } from "@/lib/similarTags";

type UIState = {
  burgerOpen: boolean;
  setBurgerOpen: (open: boolean) => void;
  toggleBurger: () => void;
  similarLevel: SimilarLevel;
  setSimilarLevel: (level: SimilarLevel) => void;
  unusedPermanent: boolean;
  setUnusedPermanent: (on: boolean) => void;
};

export const useUI = create<UIState>()(
  persist(
    (set, get) => ({
      burgerOpen: false,
      setBurgerOpen: (burgerOpen) => set({ burgerOpen }),
      toggleBurger: () => set({ burgerOpen: !get().burgerOpen }),
      similarLevel: "strict",
      setSimilarLevel: (similarLevel) => set({ similarLevel }),
      unusedPermanent: false,
      setUnusedPermanent: (unusedPermanent) => set({ unusedPermanent }),
    }),
    { name: "myboard.interface" },
  ),
);
