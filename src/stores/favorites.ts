// Favoris (FAV-01, FAV-03) : l'étoile change tout de suite partout (vignette, visionneuse, menus),
// sans attendre la réponse du cœur Rust ni la relecture de la grille. Chaque vignette ne lit que son
// entrée : seule celle qui change se redessine (D-008).

import { create } from "zustand";

import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useViewer } from "./viewer";

type FavoritesState = {
  /** État choisi depuis le chargement de la page, par média (prioritaire sur celui reçu). */
  chosen: Record<number, boolean>;
};

export const useFavorites = create<FavoritesState>()(() => ({ chosen: {} }));

/** Le média est-il favori ? `known` : état reçu avec le média (grille, fiche de la visionneuse). */
export function useIsFavorite(id: number, known: boolean): boolean {
  return useFavorites((s) => s.chosen[id]) ?? known;
}

export function isFavorite(id: number, known: boolean): boolean {
  return useFavorites.getState().chosen[id] ?? known;
}

function choose(ids: number[], on: boolean | undefined) {
  useFavorites.setState((s) => {
    const chosen = { ...s.chosen };
    for (const id of ids) {
      if (on === undefined) delete chosen[id];
      else chosen[id] = on;
    }
    return { chosen };
  });
}

/** Ajoute aux favoris (ou en retire) ; la vue Favoris, les fiches et le titre sont relus ensuite. */
export async function setFavorite(ids: number[], on: boolean) {
  choose(ids, on);
  try {
    await api.setFavorite(ids, on);
  } catch (error) {
    choose(ids, undefined);
    useViewer.getState().setError({ action: on ? "Ajouter aux favoris" : "Retirer des favoris", code: null, message: String(error) });
    return;
  }
  void queryClient.invalidateQueries({ queryKey: ["media"] });
  void queryClient.invalidateQueries({ queryKey: ["stats"] });
  for (const id of ids) void queryClient.invalidateQueries({ queryKey: ["media-detail", id] });
}

/** Médias supprimés : leur état choisi est oublié (un nouveau média peut reprendre leur numéro). */
export function forgetFavorites(ids: number[]) {
  choose(ids, undefined);
}
