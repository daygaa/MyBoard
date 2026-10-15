// Réglages du lecteur vidéo personnalisé (VIEW-29) : le volume (et le mode muet) est retenu
// d'une vidéo à l'autre et entre deux lancements ; la boucle (VIEW-26, activée par défaut) et
// la vitesse valent pour la session. Partagés par la barre de lecture et le menu du clic droit
// de la vidéo (CTX-07).

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/** Vitesse affichée : « 1,25× ». */
export const speedLabel = (speed: number) => `${String(speed).replace(".", ",")}×`;

type PlayerState = {
  volume: number;
  muted: boolean;
  loop: boolean;
  speed: number;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  setLoop: (loop: boolean) => void;
  setSpeed: (speed: number) => void;
  /** Couper / rétablir le son (bouton haut-parleur, menu de la vidéo). */
  toggleSound: () => void;
};

/** Son coupé, ou volume à zéro. */
export const isSilent = ({ muted, volume }: Pick<PlayerState, "muted" | "volume">) => muted || volume === 0;

export const usePlayer = create<PlayerState>()(
  persist(
    (set, get) => ({
      volume: 1,
      muted: false,
      loop: true,
      speed: 1,
      // Monter le volume enlève le mode muet, comme dans tous les lecteurs.
      setVolume: (volume) => set({ volume, muted: volume === 0 }),
      setMuted: (muted) => set({ muted }),
      setLoop: (loop) => set({ loop }),
      setSpeed: (speed) => set({ speed }),
      // Rétablir le son alors que le volume est à zéro : on remet un volume moyen.
      toggleSound: () => {
        const { volume } = get();
        if (!isSilent(get())) set({ muted: true });
        else if (volume === 0) get().setVolume(0.5);
        else set({ muted: false });
      },
    }),
    {
      name: "myboard.lecteur",
      partialize: ({ volume, muted }) => ({ volume, muted }),
    },
  ),
);
