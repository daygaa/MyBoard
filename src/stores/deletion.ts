// Suppression (DEL-01) : les médias disparaissent de l'écran à l'instant du clic. Leurs vignettes sont
// cachées tout de suite (leur place reste vide jusqu'à la relecture de la grille, sans saut), puis le
// cœur Rust les retire en arrière-plan (DEL-02) et prévient l'interface (`media-deleted`).

import { create } from "zustand";

import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useViewer } from "./viewer";

export const useDeletion = create<{ hidden: Record<number, true> }>()(() => ({ hidden: {} }));

function setHidden(ids: number[], hidden: boolean) {
  useDeletion.setState((s) => {
    const next = { ...s.hidden };
    for (const id of ids) {
      if (hidden) next[id] = true;
      else delete next[id];
    }
    return { hidden: next };
  });
}

/** Tout ce qui dépend des médias présents : grille, compteurs, tags de la page et leurs compteurs,
 *  nombre de médias des dossiers. */
export function refreshLibrary(): Promise<unknown> {
  const keys = [["media"], ["stats"], ["page-tags"], ["autocomplete"], ["tag"], ["folders"]];
  return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

/** Supprime des médias (DEL-04 : `deleteFiles` = effacer aussi leurs fichiers). Vrai si la demande
 *  est partie ; la grille est alors déjà relue sans eux. */
export async function deleteMedia(ids: number[], deleteFiles: boolean): Promise<boolean> {
  setHidden(ids, true);
  try {
    await api.deleteMedia(ids, deleteFiles);
  } catch (error) {
    setHidden(ids, false);
    useViewer.getState().setError({ action: "Supprimer", code: null, message: String(error) });
    return false;
  }
  await refreshLibrary();
  return true;
}

/** « Supprimer quand même » (DEL-08) : fichiers en lecture seule effacés en retirant la lecture seule. */
export async function forceDeleteMedia(ids: number[]): Promise<boolean> {
  setHidden(ids, true);
  try {
    await api.deleteMedia(ids, true, true);
  } catch (error) {
    setHidden(ids, false);
    useViewer.getState().setError({ action: "Supprimer quand même", code: null, message: String(error) });
    return false;
  }
  await refreshLibrary();
  return true;
}

/** Médias retirés pour de bon, ou revenus après un échec (DEL-04) : la grille est relue, puis leurs
 *  vignettes ne sont plus cachées (un nouveau média peut reprendre leur numéro). */
export async function settleDeletion(ids: number[]) {
  await refreshLibrary();
  setHidden(ids, false);
}
