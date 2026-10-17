// Actions sur les dossiers (FOLD-01 à FOLD-04, FOLD-07, FOLD-09), partagées par le menu burger, les
// menus du clic droit et la visionneuse. Tout ce qui en dépend est relu ensuite : liste des dossiers
// et leurs compteurs, grille (vignettes, page d'un dossier), fiches de la visionneuse.

import { useViewer } from "@/stores/viewer";
import { api, type Folder } from "./api";
import { queryClient } from "./queryClient";
import { folderIdOf, navigate } from "./router";

/** Couleurs prédéfinies (FOLD-07), mêmes valeurs que le cœur Rust (`folders.rs`). */
export const FOLDER_COLORS = [
  { color: "#d9a94e", label: "Doré" },
  { color: "#4ade80", label: "Vert" },
  { color: "#5eead4", label: "Turquoise" },
  { color: "#f9a8d4", label: "Rose" },
  { color: "#c4b5fd", label: "Violet" },
  { color: "#fb923c", label: "Orange" },
  { color: "#f87171", label: "Rouge" },
  { color: "#a1a1aa", label: "Gris" },
];

/** Nom refusé par le cœur Rust : vide, ou déjà pris (nom libre proposé). */
export type NameError = { kind: "empty" } | { kind: "taken"; suggestion: string } | { kind: "failed"; message: string };

export function refreshFolders(): Promise<unknown> {
  const keys = [["folders"], ["media"], ["media-detail"]];
  return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

/** Dossiers déjà lus (le menu burger les lit au lancement) : pour les menus, calculés au clic droit. */
export function cachedFolders(): Folder[] {
  return queryClient.getQueryData<Folder[]>(["folders"]) ?? [];
}

async function run(action: string, call: () => Promise<void>) {
  try {
    await call();
  } catch (error) {
    useViewer.getState().setError({ action, code: null, message: String(error) });
  }
  await refreshFolders();
}

/** Ajoute (`on`) ou retire des médias d'un dossier (FOLD-03, FOLD-09). */
export function setFolderMedia(folderId: number, mediaIds: number[], on: boolean) {
  return run(on ? "Ajouter au dossier" : "Retirer du dossier", () => api.setFolderMedia(folderId, mediaIds, on));
}

export function setFolderHidden(id: number, hidden: boolean) {
  return run(hidden ? "Masquer le dossier" : "Ne plus masquer le dossier", () => api.setFolderHidden(id, hidden));
}

export function setFolderColor(id: number, color: string) {
  return run("Changer la couleur du dossier", () => api.setFolderColor(id, color));
}

/** Supprime le dossier (ses médias restent) ; s'il était affiché, retour à la bibliothèque. */
export function deleteFolder(id: number) {
  if (folderIdOf(window.location.hash) === id) navigate("library");
  return run("Supprimer le dossier", () => api.deleteFolder(id));
}
