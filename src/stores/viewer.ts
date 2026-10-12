// État de la visionneuse : média affiché et sa position dans TOUS les résultats de la vue
// courante (filtres, recherche, tri), pour passer d'une page à l'autre sans couture (VIEW-04)
// et rouvrir la grille sur la page du média regardé (VIEW-05).
// Aussi : plein écran total (VIEW-18), message d'erreur d'une ouverture externe (VIEW-28) et
// réouverture par le bouton 4 de la souris (VIEW-27).

import { getCurrentWindow } from "@tauri-apps/api/window";
import { create } from "zustand";

import type { ListQuery, MediaItem } from "@/lib/api";
import { setBackFallback } from "@/lib/escape";
import { useLibrary } from "./library";
import { useSearch } from "./search";

export type ListBase = Omit<ListQuery, "page">;

/** Échec d'une ouverture externe (VIEW-28) : action, code d'erreur Windows, message. */
export type ExternalError = { action: string; code: number | null; message: string };

type Closed = { index: number; item: MediaItem; base: ListBase; snapshot: string };

type ViewerState = {
  open: boolean;
  /** Position du média dans tous les résultats (0 = le premier). */
  index: number;
  item: MediaItem | null;
  /** Requête figée à l'ouverture (même découpage en pages que la grille). */
  base: ListBase | null;
  total: number;
  fullscreen: boolean;
  error: ExternalError | null;
  /** Dernière visionneuse fermée, que le bouton 4 peut rouvrir (VIEW-27). */
  lastClosed: Closed | null;
  /** La visionneuse actuelle a été rouverte par le bouton 4 : la refermer ne réarme pas la
   *  réouverture (pas de va-et-vient sans fin). */
  reopened: boolean;
  openAt: (index: number, item: MediaItem, pageSize: number) => void;
  show: (index: number, item: MediaItem, total: number) => void;
  close: () => void;
  /** Fermeture pour lancer une recherche (clic sur une pastille) : nouvelle vue, page 1. */
  closeForSearch: () => void;
  setFullscreen: (on: boolean) => void;
  setError: (error: ExternalError | null) => void;
};

/** Ce qui doit être resté identique pour que le bouton 4 rouvre la visionneuse : page, filtres,
 *  tri, recherche, densité et page de l'application. */
function librarySnapshot(): string {
  const { page, kinds, sort, seed, pageDensity } = useLibrary.getState();
  return JSON.stringify([page, kinds, sort, seed, pageDensity, useSearch.getState().terms, location.hash]);
}

export const useViewer = create<ViewerState>()((set, get) => ({
  open: false,
  index: 0,
  item: null,
  base: null,
  total: 0,
  fullscreen: false,
  error: null,
  lastClosed: null,
  reopened: false,
  openAt: (index, item, pageSize) => {
    const { kinds, sort, seed } = useLibrary.getState();
    const { terms } = useSearch.getState();
    set({ open: true, index, item, base: { kinds, terms, sort, seed, pageSize }, lastClosed: null, reopened: false });
  },
  show: (index, item, total) => set({ index, item, total, error: null }),
  close: () => {
    const { base, index, item, reopened } = get();
    // La grille s'ouvre sur la page du média regardé (VIEW-05).
    if (base) useLibrary.getState().setPage(Math.floor(index / base.pageSize) + 1);
    get().setFullscreen(false);
    const lastClosed = base && item && !reopened ? { index, item, base, snapshot: librarySnapshot() } : null;
    set({ open: false, item: null, base: null, error: null, lastClosed, reopened: false });
  },
  closeForSearch: () => {
    get().setFullscreen(false);
    set({ open: false, item: null, base: null, error: null, lastClosed: null, reopened: false });
  },
  setFullscreen: (on) => {
    if (get().fullscreen === on) return;
    set({ fullscreen: on });
    void getCurrentWindow().setFullscreen(on);
  },
  setError: (error) => set({ error }),
}));

// Bouton 4 quand rien n'est ouvert : rouvre la dernière image vue si rien d'autre n'a été fait
// depuis sa fermeture (VIEW-27) ; sinon, retour arrière normal.
setBackFallback({
  can: () => {
    const { open, lastClosed } = useViewer.getState();
    return !open && lastClosed !== null && lastClosed.snapshot === librarySnapshot();
  },
  run: () => {
    const { lastClosed } = useViewer.getState();
    if (!lastClosed) return;
    const { index, item, base } = lastClosed;
    useViewer.setState({ open: true, index, item, base, lastClosed: null, reopened: true, error: null });
  },
});
