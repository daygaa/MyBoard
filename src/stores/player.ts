// Réglages du lecteur vidéo personnalisé (VIEW-29) : le volume (et le mode muet) est retenu
// d'une vidéo à l'autre et entre deux lancements ; la boucle (VIEW-26, activée par défaut) et
// la vitesse valent pour la session.

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

type PlayerState = {
  volume: number;
  muted: boolean;
  loop: boolean;
  speed: number;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setLoop: (loop: boolean) => void;
  setSpeed: (speed: number) => void;
};

export const usePlayer = create<PlayerState>()(
  persist(
    (set) => ({
      volume: 1,
      muted: false,
      loop: true,
      speed: 1,
      // Monter le volume enlève le mode muet, comme dans tous les lecteurs.
      setVolume: (volume) => set({ volume, muted: volume === 0 }),
      setMuted: (muted) => set({ muted }),
      setLoop: (loop) => set({ loop }),
      setSpeed: (speed) => set({ speed }),
    }),
    {
      name: "myboard.lecteur",
      partialize: ({ volume, muted }) => ({ volume, muted }),
    },
  ),
);
