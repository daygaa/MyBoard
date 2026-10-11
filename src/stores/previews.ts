// Grands aperçus 640 px (LIB-09) : aperçus prêts, et demandes / annulations envoyées au
// cœur Rust par petits lots (une seule commande toutes les 50 ms au plus).

import { create } from "zustand";

import { api } from "@/lib/api";

type PreviewsState = {
  ready: Record<number, true>;
  markReady: (ids: number[]) => void;
};

export const usePreviews = create<PreviewsState>()((set) => ({
  ready: {},
  markReady: (ids) =>
    set((state) => {
      const ready = { ...state.ready };
      for (const id of ids) ready[id] = true;
      return { ready };
    }),
}));

const want = new Set<number>();
const cancel = new Set<number>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    if (want.size === 0 && cancel.size === 0) return;
    void api.requestPreviews([...want], [...cancel]);
    want.clear();
    cancel.clear();
  }, 50);
}

/** La vignette est visible depuis assez longtemps : son aperçu est demandé. */
export function wantPreview(id: number) {
  cancel.delete(id);
  want.add(id);
  scheduleFlush();
}

/** La vignette a quitté l'écran : sa demande est annulée si elle n'est pas encore traitée. */
export function cancelPreview(id: number) {
  if (want.delete(id)) return; // pas encore envoyée : rien à annuler côté Rust
  cancel.add(id);
  scheduleFlush();
}
