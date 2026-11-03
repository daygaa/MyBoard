// Actions sur les tags, communes au gestionnaire (TAGM-04) et aux menus des tags (CTX-04, CTX-12) :
// appel au cœur Rust, erreur éventuelle dans la pop-in d'erreur, puis relecture de tout ce qui montre
// des tags (gestionnaire, synonymes et parents, barre latérale, suggestions, visionneuse, grille).
// Tags proches (TAGM-13) : lib/similarTags.ts. Code de partage d'une liste de tags : lib/shareCode.ts.

import { currentTerms, renameSearchTag } from "@/stores/search";
import { useViewer } from "@/stores/viewer";
import { api } from "./api";
import { queryClient } from "./queryClient";

export function refreshTags(): Promise<unknown> {
  // Aperçu du formulaire des synonymes compris : une fusion changée dans la liste s'y voit tout de suite.
  const keys = [["tag-manager"], ["tag-rules"], ["page-tags"], ["autocomplete"], ["tag"], ["media-detail"], ["media"], ["stats"], ["selection-tags"], ["group-preview"]];
  return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

/** Appel au cœur Rust ; renvoie sa réponse, ou `undefined` en cas d'erreur (affichée). */
export async function runTagAction<T>(action: string, call: () => Promise<T>): Promise<T | undefined> {
  try {
    return await call();
  } catch (error) {
    useViewer.getState().setError({ action, code: null, message: String(error) });
    return undefined;
  } finally {
    await refreshTags();
  }
}

export const setTagsCategory = (ids: number[], categoryId: number) => runTagAction("Changer de catégorie", () => api.setTagsCategory(ids, categoryId));
export const setTagsHidden = (ids: number[], hidden: boolean) =>
  runTagAction(hidden ? "Masquer de la recherche" : "Ne plus masquer de la recherche", () => api.setTagsHidden(ids, hidden));
export const deleteTags = (ids: number[], withMerged = false, strip = false, removePosed = false) =>
  runTagAction("Supprimer le tag", () => api.deleteTags(ids, withMerged, strip, removePosed));
/** Tag renommé ou fusionné (SRCH-27) : la recherche en cours (et celle de la visionneuse ouverte)
 *  prend le nouveau nom. */
export function followRename(from: string, to: string) {
  renameSearchTag(from, to);
  const { base } = useViewer.getState();
  if (base) useViewer.setState({ base: { ...base, terms: currentTerms(base.terms) } });
}

export const setTagDescription = (id: number, text: string) => runTagAction("Description du tag", () => api.setTagDescription(id, text));
