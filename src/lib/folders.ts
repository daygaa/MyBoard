// Actions sur les dossiers (FOLD-01 à FOLD-04, FOLD-07, FOLD-09), partagées par le menu burger, les
// menus du clic droit et la visionneuse. Tout ce qui en dépend est relu ensuite : liste des dossiers
// et leurs compteurs, grille (vignettes, page d'un dossier), fiches de la visionneuse. Ordre des listes
// choisi par l'utilisateur (FOLD-10, stores/folderSort.ts).

import { useFolderSort, type FolderSortKey, type SortDirection } from "@/stores/folderSort";
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

/** Ordre de l'Explorateur de Windows (« dossier 2 » avant « dossier 10 »), sans tenir compte des accents ni des
 *  majuscules, comme le tri des noms de la grille (FILT-09). */
const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });
const byName = (a: Folder, b: Folder) => collator.compare(a.name, b.name);
/** Rang de la couleur dans la palette (FOLD-07) ; une autre couleur vient après. */
const paletteRank = (color: string) => {
  const i = FOLDER_COLORS.findIndex((c) => c.color === color);
  return i < 0 ? FOLDER_COLORS.length : i;
};
const COMPARE: Record<FolderSortKey, (a: Folder, b: Folder) => number> = {
  name: byName,
  media: (a, b) => b.mediaCount - a.mediaCount,
  created: (a, b) => b.createdAt - a.createdAt,
  color: (a, b) => paletteRank(a.color) - paletteRank(b.color),
  opened: (a, b) => b.openedAt - a.openedAt,
};

/** Dossiers dans l'ordre choisi (FOLD-10) ; à égalité (même nombre de médias, même couleur…), par nom A → Z. */
export function sortFolders(folders: Folder[], key: FolderSortKey, direction: SortDirection): Folder[] {
  const sign = direction === "down" ? 1 : -1;
  return [...folders].sort((a, b) => sign * COMPARE[key](a, b) || byName(a, b));
}

/** Dossiers déjà lus (le menu burger les lit au lancement), dans l'ordre choisi : pour les menus, calculés au
 *  clic droit. */
export function cachedFolders(): Folder[] {
  const { key, dirs } = useFolderSort.getState();
  return sortFolders(queryClient.getQueryData<Folder[]>(["folders"]) ?? [], key, dirs[key]);
}

/** Appelle le cœur Rust, affiche une erreur éventuelle, puis relit les dossiers ; renvoie la réponse
 *  (`undefined` en cas d'erreur). */
async function run<T>(action: string, call: () => Promise<T>): Promise<T | undefined> {
  let result: T | undefined;
  try {
    result = await call();
  } catch (error) {
    useViewer.getState().setError({ action, code: null, message: String(error) });
  }
  await refreshFolders();
  return result;
}

/** Ajoute (`on`) ou retire des médias d'un dossier (FOLD-03, FOLD-09) ; renvoie le nombre de médias
 *  réellement ajoutés ou retirés. */
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
