// Miniatures terminées depuis le chargement de la page (événement `thumbs-ready`).
// Chaque vignette lit uniquement sa propre entrée : seule celle qui change se redessine.

import { create } from "zustand";

import type { ThumbUpdate } from "@/lib/api";

type ThumbsState = {
  updates: Record<number, ThumbUpdate>;
  apply: (list: ThumbUpdate[]) => void;
};

export const useThumbs = create<ThumbsState>()((set) => ({
  updates: {},
  apply: (list) =>
    set((state) => {
      const updates = { ...state.updates };
      for (const u of list) updates[u.id] = u;
      return { updates };
    }),
}));
