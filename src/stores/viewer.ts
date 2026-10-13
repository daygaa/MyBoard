// État de la visionneuse : média affiché et sa position dans TOUS les résultats de la vue
// courante (filtres, recherche, tri), pour passer d'une page à l'autre sans couture (VIEW-04)
// et rouvrir la grille sur la page du média regardé (VIEW-05).
// Aussi : plein écran total (VIEW-18), message d'erreur d'une ouverture externe (VIEW-28),
// confirmation « Copié » (VIEW-35) et
// chemin des boutons 4 et 5 de la souris autour de la dernière visionneuse (VIEW-27, VIEW-30).

import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { create } from "zustand";

import type { ListQuery, MediaItem } from "@/lib/api";
import { setMouseFallbacks } from "@/lib/escape";
import { useLibrary } from "./library";
import { useSearch } from "./search";

export type ListBase = Omit<ListQuery, "page">;

/** Échec d'une ouverture externe (VIEW-28) : action, code d'erreur Windows, message. */
export type ExternalError = { action: string; code: number | null; message: string };

type Shown = { index: number; item: MediaItem; base: ListBase };

/** Chemin des boutons 4 et 5 (VIEW-27, VIEW-30) : quatre étapes [fermée, ouverte, fermée,
 *  ouverte] ; ouvrir un média par un clic place sur la dernière (3). Le bouton 4 recule d'une
 *  étape, le bouton 5 avance ; une étape impaire = visionneuse ouverte sur la dernière image
 *  vue. Hors de la visionneuse, le chemin ne sert que si rien n'a changé depuis (`snapshot`). */
type Trail = { shown: Shown; step: number; snapshot: string };
const LAST_STEP = 3;

type ViewerState = {
  open: boolean;
  /** Position du média dans tous les résultats (0 = le premier). */
  index: number;
  item: MediaItem | null;
  /** Requête figée à l'ouverture (même découpage en pages que la grille). */
  base: ListBase | null;
  total: number;
  fullscreen: boolean;
  /** Hauteur de la barre des tâches sous la fenêtre agrandie, en px (voir `taskbarGap`). */
  screenGap: number;
  error: ExternalError | null;
  /** Média dont le fichier vient d'être copié : « Copié » s'affiche ~1,5 s (VIEW-35). */
  copied: number | null;
  trail: Trail | null;
  openAt: (index: number, item: MediaItem, pageSize: number) => void;
  show: (index: number, item: MediaItem, total: number) => void;
  /** Fermeture (Échap, croix, clic sur le fond, bouton 4) : une étape en arrière. */
  close: () => void;
  /** Bouton 5 dans la visionneuse : une étape en avant, qui la ferme (VIEW-30). */
  forward: () => void;
  /** Fermeture pour lancer une recherche (clic sur une pastille) : nouvelle vue, page 1. */
  closeForSearch: () => void;
  setFullscreen: (on: boolean) => void;
  setError: (error: ExternalError | null) => void;
  markCopied: (id: number) => void;
};

/** Durée de la confirmation « Copié » (VIEW-35). */
const COPIED_MS = 1500;
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

/** Ce qui doit être resté identique pour que les boutons 4 et 5 rouvrent la visionneuse : page,
 *  filtres, tri, recherche, densité et page de l'application. */
function librarySnapshot(): string {
  const { page, kinds, sort, seed, pageDensity } = useLibrary.getState();
  return JSON.stringify([page, kinds, sort, seed, pageDensity, useSearch.getState().terms, location.hash]);
}

/** Espace entre le bas de la zone de travail de l'écran (au-dessus de la barre des tâches) et le
 *  bas de l'écran, en px. En plein écran, les commandes flottantes remontent d'autant pour rester
 *  au même endroit qu'avec la fenêtre agrandie (VIEW-32). */
async function taskbarGap(): Promise<number> {
  const monitor = await currentMonitor().catch(() => null);
  if (!monitor) return 0;
  const bottom = monitor.position.y + monitor.size.height;
  const workBottom = monitor.workArea.position.y + monitor.workArea.size.height;
  return Math.max(0, Math.round((bottom - workBottom) / monitor.scaleFactor));
}

export const useViewer = create<ViewerState>()((set, get) => {
  /** Ferme la visionneuse en se plaçant à l'étape `step` du chemin. */
  const closeAt = (step: number) => {
    const { base, index, item } = get();
    // La grille s'ouvre sur la page du média regardé (VIEW-05).
    if (base) useLibrary.getState().setPage(Math.floor(index / base.pageSize) + 1);
    get().setFullscreen(false);
    const trail = base && item ? { shown: { index, item, base }, step, snapshot: librarySnapshot() } : null;
    set({ open: false, item: null, base: null, error: null, trail });
  };
  /** Rouvre la dernière image vue à l'étape `step`. */
  const reopenAt = (step: number) => {
    const trail = get().trail;
    if (!trail) return;
    const { index, item, base } = trail.shown;
    set({ open: true, index, item, base, error: null, trail: { ...trail, step } });
    refreshGap();
  };
  /** Le chemin s'applique-t-il encore (rien n'a changé depuis la fermeture) ? */
  const trailValid = () => {
    const { open, trail } = get();
    return !open && trail !== null && trail.snapshot === librarySnapshot();
  };
  /** Relu à chaque ouverture et à chaque plein écran (la fenêtre a pu changer d'écran). */
  const refreshGap = () => void taskbarGap().then((screenGap) => set({ screenGap }));

  setMouseFallbacks(
    { can: () => trailValid() && (get().trail?.step ?? 0) > 0, run: () => reopenAt((get().trail?.step ?? 1) - 1) },
    { can: () => trailValid() && (get().trail?.step ?? LAST_STEP) < LAST_STEP, run: () => reopenAt((get().trail?.step ?? 0) + 1) },
  );

  return {
    open: false,
    index: 0,
    item: null,
    base: null,
    total: 0,
    fullscreen: false,
    screenGap: 0,
    error: null,
    copied: null,
    trail: null,
    openAt: (index, item, pageSize) => {
      const { kinds, sort, seed } = useLibrary.getState();
      const { terms } = useSearch.getState();
      const base = { kinds, terms, sort, seed, pageSize };
      // Nouveau média ouvert par un clic : nouveau chemin, placé sur sa dernière étape.
      set({ open: true, index, item, base, trail: { shown: { index, item, base }, step: LAST_STEP, snapshot: "" } });
      refreshGap();
    },
    show: (index, item, total) => set({ index, item, total, error: null }),
    close: () => closeAt(Math.max(0, (get().trail?.step ?? LAST_STEP) - 1)),
    forward: () => {
      const step = get().trail?.step ?? LAST_STEP;
      if (step < LAST_STEP) closeAt(step + 1); // sinon : plus rien après
    },
    closeForSearch: () => {
      get().setFullscreen(false);
      set({ open: false, item: null, base: null, error: null, trail: null });
    },
    setFullscreen: (on) => {
      if (get().fullscreen === on) return;
      set({ fullscreen: on });
      void getCurrentWindow().setFullscreen(on);
      if (on) refreshGap();
    },
    setError: (error) => set({ error }),
    markCopied: (id) => {
      clearTimeout(copiedTimer);
      set({ copied: id });
      copiedTimer = setTimeout(() => set({ copied: null }), COPIED_MS);
    },
  };
});
