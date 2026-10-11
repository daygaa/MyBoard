// État de l'interface générale : menu burger (mémorisé, comme dans la v8).

import { create } from "zustand";
import { persist } from "zustand/middleware";

type UIState = {
  burgerOpen: boolean;
  setBurgerOpen: (open: boolean) => void;
  toggleBurger: () => void;
};

export const useUI = create<UIState>()(
  persist(
    (set, get) => ({
      burgerOpen: false,
      setBurgerOpen: (burgerOpen) => set({ burgerOpen }),
      toggleBurger: () => set({ burgerOpen: !get().burgerOpen }),
    }),
    { name: "myboard.interface" },
  ),
);
