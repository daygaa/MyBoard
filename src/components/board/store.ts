"use client";

// MyBoard — UI state global (sidebar mobile, sélection batch, visionneuse, densité grille).
// On garde ce store ici (dans /board) pour ne pas empiéter sur src/lib (API).
//
// IMPORTANT — cohérence SSR/CSR :
// `gridDensity` est initialisé avec DEFAULT_GRID_DENSITY pour que le rendu
// serveur ET le premier rendu client soient identiques (pas de mismatch
// d'hydration). La valeur réelle (depuis localStorage) est appliquée dans
// un useEffect post-mount côté client (voir useGridDensitySync).

import { create } from "zustand";
import type { MediaListItem } from "@/lib/types";
import type { ReactNode } from "react";

// Densité grille par défaut (cols cibles). Persistance localStorage.
const GRID_DENSITY_KEY = "myboard.gridDensity";
export const DEFAULT_GRID_DENSITY = 7; // 7 cols ~ Safebooru
export const GRID_DENSITY_MIN = 4;
export const GRID_DENSITY_MAX = 30;

// État du menu burger desktop (panneau latéral dépliant). Persistance localStorage.
const BURGER_OPEN_KEY = "myboard.burgerOpen";

function readGridDensityFromStorage(): number {
  if (typeof window === "undefined") return DEFAULT_GRID_DENSITY;
  try {
    const v = window.localStorage.getItem(GRID_DENSITY_KEY);
    const n = v ? parseInt(v, 10) : NaN;
    if (isFinite(n) && n >= GRID_DENSITY_MIN && n <= GRID_DENSITY_MAX) return n;
  } catch {
    /* ignore */
  }
  return DEFAULT_GRID_DENSITY;
}

function saveGridDensity(n: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GRID_DENSITY_KEY, String(n));
  } catch {
    /* ignore */
  }
}

function readBurgerOpenFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(BURGER_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function saveBurgerOpen(v: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BURGER_OPEN_KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

type BoardUIState = {
  // Sidebar mobile (Sheet) — contenu injecté par la page courante
  mobileSidebarOpen: boolean;
  setMobileSidebar: (v: boolean) => void;
  mobileSidebarContent: ReactNode | null;
  setMobileSidebarContent: (node: ReactNode | null) => void;

  // Menu burger desktop (panneau latéral dépliant gauche : Import / Groupes / Favoris / Paramètres)
  // SSR-safe : toujours `false` au 1er render, hydraté depuis localStorage après mount.
  burgerOpen: boolean;
  setBurgerOpen: (v: boolean) => void;
  toggleBurger: () => void;
  hydrateBurgerOpen: () => void;

  // Sélection batch (grille)
  selected: Set<number>;
  toggleSelect: (id: number) => void;
  selectRange: (ids: number[]) => void;
  selectAll: (ids: number[]) => void;
  clearSelection: () => void;
  batchMode: boolean;
  setBatchMode: (v: boolean) => void;
  lastSelectedIdx: number | null;
  setLastSelectedIdx: (i: number | null) => void;

  // Visionneuse plein écran
  lightbox: {
    open: boolean;
    items: MediaListItem[];
    index: number;
    query: string;
  } | null;
  openLightbox: (items: MediaListItem[], index: number, query: string) => void;
  closeLightbox: () => void;
  setLightboxIndex: (i: number) => void;

  // Cartes masquées (optimistic UI pour la suppression).
  // Quand l'utilisateur confirme la suppression (single ou bulk), on ajoute
  // les ids ici AVANT d'attendre la réponse serveur. La grille filtre ces ids
  // pour qu'ils disparaissent immédiatement. router.refresh() à la fin
  // resynchronise depuis la DB et on clear le Set.
  hiddenIds: Set<number>;
  addHidden: (ids: number[]) => void;
  clearHidden: () => void;

  // Densité grille (4 = très aéré, 30 = très compact). Persistance localStorage.
  gridDensity: number;
  setGridDensity: (n: number) => void;
  hydrateGridDensity: () => void;
};

export const useBoardUI = create<BoardUIState>((set, get) => ({
  mobileSidebarOpen: false,
  setMobileSidebar: (v) => {
    // Ouvre le Sheet mobile. Si on l'ouvre, on ferme le burger pour éviter
    // d'avoir deux panneaux superposés (expérience confuse).
    if (v) set({ mobileSidebarOpen: true, burgerOpen: false });
    else set({ mobileSidebarOpen: false });
  },
  mobileSidebarContent: null,
  setMobileSidebarContent: (node) => set({ mobileSidebarContent: node }),

  // Burger desktop — `false` au 1er render (SSR-safe), hydraté après mount.
  burgerOpen: false,
  setBurgerOpen: (v) => {
    if (v) {
      // Ouvre le burger : ferme le Sheet mobile s'il était ouvert.
      set({ burgerOpen: true, mobileSidebarOpen: false });
    } else {
      set({ burgerOpen: false });
    }
    saveBurgerOpen(v);
  },
  toggleBurger: () => {
    const next = !get().burgerOpen;
    get().setBurgerOpen(next);
  },
  hydrateBurgerOpen: () => {
    const stored = readBurgerOpenFromStorage();
    set({ burgerOpen: stored });
  },

  selected: new Set(),
  toggleSelect: (id) =>
    set((s) => {
      const next = new Set(s.selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selected: next };
    }),
  selectRange: (ids) =>
    set((s) => {
      const next = new Set(s.selected);
      for (const id of ids) next.add(id);
      return { selected: next };
    }),
  // IMPORTANT : selectAll ADD (pas REPLACE) pour préserver les sélections
  // des autres pages (voir modif_UI.txt ligne 58).
  selectAll: (ids) =>
    set((s) => {
      const next = new Set(s.selected);
      for (const id of ids) next.add(id);
      return { selected: next };
    }),
  clearSelection: () => set({ selected: new Set() }),
  batchMode: false,
  setBatchMode: (v) => set({ batchMode: v, selected: new Set() }),
  lastSelectedIdx: null,
  setLastSelectedIdx: (i) => set({ lastSelectedIdx: i }),

  lightbox: null,
  openLightbox: (items, index, query) =>
    set({ lightbox: { open: true, items, index, query } }),
  closeLightbox: () => set({ lightbox: null }),
  setLightboxIndex: (i) =>
    set((s) =>
      s.lightbox ? { lightbox: { ...s.lightbox, index: i } } : { lightbox: null }
    ),

  hiddenIds: new Set(),
  addHidden: (ids) =>
    set((s) => {
      if (ids.length === 0) return {};
      const next = new Set(s.hiddenIds);
      for (const id of ids) next.add(id);
      return { hiddenIds: next };
    }),
  clearHidden: () => set({ hiddenIds: new Set() }),

  // Densité grille — DEFAULT au 1er render (SSR-safe), hydratée après mount.
  gridDensity: DEFAULT_GRID_DENSITY,
  setGridDensity: (n) => {
    const clamped = Math.max(GRID_DENSITY_MIN, Math.min(GRID_DENSITY_MAX, Math.round(n)));
    saveGridDensity(clamped);
    set({ gridDensity: clamped });
  },
  hydrateGridDensity: () => {
    const stored = readGridDensityFromStorage();
    set({ gridDensity: stored });
  },
}));
