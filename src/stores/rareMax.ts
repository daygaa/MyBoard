// Seuil du filtre « Rares » du gestionnaire de tags (TAGM-25) : tags portés par 1 à N médias, N de 1 à 5 (1 par
// défaut, comme avant). Gardé d'un lancement à l'autre, comme le tri des dossiers : un réglage, pas un filtre du moment.

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Seuils proposés. */
export const RARE_CHOICES = [1, 2, 3, 4, 5] as const;

type RareMaxState = { max: number; setMax: (max: number) => void };

export const useRareMax = create<RareMaxState>()(
  persist((set) => ({ max: 1, setMax: (max) => set({ max }) }), { name: "myboard.gestionnaire.rares", partialize: ({ max }) => ({ max }) }),
);
