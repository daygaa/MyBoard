// Grands aperçus 640 et 1 280 px (LIB-09, LIB-16) : aperçus prêts, et demandes / annulations
// envoyées au cœur Rust par petits lots (une seule commande toutes les 50 ms au plus).

import { create } from "zustand";

import { api, type PreviewKey, type PreviewSize } from "@/lib/api";

/** Une taille prête = un bit : une seule valeur par média, quelle que soit la taille. */
const BIT: Record<PreviewSize, number> = { 640: 1, 1280: 2 };

type PreviewsState = {
  ready: Record<number, number>;
  /** Change quand des fichiers sont revus (fin d'un import, emplacement rebranché : LIB-05, LIB-14) : les vignettes
   *  visibles redemandent leur aperçu, que le cœur Rust réessaie (sinon elles restaient en 320 px, retour du 11/11). */
  retry: number;
  bumpRetry: () => void;
  markReady: (keys: PreviewKey[]) => void;
  /** Médias supprimés (DEL-02) : un nouveau média peut reprendre leur numéro. */
  forget: (ids: number[]) => void;
};

export const usePreviews = create<PreviewsState>()((set) => ({
  ready: {},
  retry: 0,
  bumpRetry: () => set((state) => ({ retry: state.retry + 1 })),
  markReady: (keys) =>
    set((state) => {
      const ready = { ...state.ready };
      for (const { id, size } of keys) ready[id] = (ready[id] ?? 0) | BIT[size];
      return { ready };
    }),
  forget: (ids) =>
    set((state) => {
      const ready = { ...state.ready };
      for (const id of ids) delete ready[id];
      return { ready };
    }),
}));

/** L'aperçu de cette taille est-il prêt ? (ne redessine que si la réponse change) */
export function usePreviewReady(id: number, size: PreviewSize): boolean {
  return usePreviews((s) => ((s.ready[id] ?? 0) & BIT[size]) !== 0);
}

/** Même question, lue une fois (hors affichage). */
export const previewReady = (id: number, size: PreviewSize): boolean => ((usePreviews.getState().ready[id] ?? 0) & BIT[size]) !== 0;

const keyOf = ({ id, size }: PreviewKey) => `${id}:${size}`;
const want = new Map<string, PreviewKey>();
const cancel = new Map<string, PreviewKey>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    if (want.size === 0 && cancel.size === 0) return;
    void api.requestPreviews([...want.values()], [...cancel.values()]);
    want.clear();
    cancel.clear();
  }, 50);
}

/** La vignette est visible depuis assez longtemps : son aperçu est demandé. */
export function wantPreview(key: PreviewKey) {
  cancel.delete(keyOf(key));
  want.set(keyOf(key), key);
  scheduleFlush();
}

/** La vignette a quitté l'écran (ou change de taille) : sa demande est annulée si elle n'est pas
 *  encore traitée. */
export function cancelPreview(key: PreviewKey) {
  if (want.delete(keyOf(key))) return; // pas encore envoyée : rien à annuler côté Rust
  cancel.set(keyOf(key), key);
  scheduleFlush();
}
