// Entrées des menus de la sélection multiple, avec les nombres dans les libellés (SEL-03, SEL-08) :
// menu ⋮ des outils de la sélection, et menu du clic droit d'une vignette cochée (tileMenu.ts). Ce que
// contient la sélection (favoris, dossiers) est demandé au cœur Rust à l'ouverture du menu : elle
// peut compter des médias qui ne sont plus affichés.

import { folderBadge, folderListLabelMany, folderPickManyEntries } from "@/components/folders/folderMenus";
import { api, type ListQuery, type SelectionInfo } from "@/lib/api";
import type { MenuEntry, MenuItem } from "@/lib/contextMenu";
import { setFolderMedia } from "@/lib/folders";
import { formatNumber, plural } from "@/lib/format";
import { showGridBadge } from "@/stores/badge";
import { deleteMedia } from "@/stores/deletion";
import { setFavorite } from "@/stores/favorites";
import { addToSelection, removeDeletedFromSelection, selectedIds, settleSelectionDeletion, singleName } from "@/stores/selection";
import { useViewer } from "@/stores/viewer";
import { deleteEntry } from "./DeleteDialog";
import { focusTagAdder, focusTagRemover } from "./SelectionBar";

/** La sélection au moment d'ouvrir le menu. */
export type SelectionContext = { ids: number[]; info: SelectionInfo };

const NOTHING: SelectionInfo = { favorites: 0, folders: [] };

/** En cas d'erreur, le menu s'ouvre quand même (sans favoris ni dossiers comptés). */
export async function loadSelection(): Promise<SelectionContext> {
  const ids = selectedIds();
  const info = ids.length > 0 ? await api.selectionInfo(ids).catch(() => NOTHING) : NOTHING;
  return { ids, info };
}

const n = formatNumber;

/** « Ajouter N aux favoris » (N = ceux qui ne le sont pas encore) ; tous favoris : « Retirer X des
 *  favoris ». */
export function favoritesEntry({ ids, info }: SelectionContext): MenuItem {
  const missing = ids.length - info.favorites;
  if (ids.length > 0 && missing === 0) {
    return {
      label: `Retirer ${n(ids.length)} des favoris`,
      run: () => void setFavorite(ids, false).then((c) => showGridBadge(`${n(c)} ${plural(c, "retiré")} des favoris`)),
    };
  }
  return {
    label: `Ajouter ${n(missing)} aux favoris`,
    disabled: missing === 0,
    run: () => void setFavorite(ids, true).then((c) => showGridBadge(`${n(c)} ${plural(c, "ajouté")} aux favoris`)),
  };
}

export function folderEntry({ ids, info }: SelectionContext): MenuItem {
  return { label: folderListLabelMany(ids.length, info.folders), disabled: ids.length === 0, submenu: folderPickManyEntries(ids, info.folders) };
}

/** Page d'un dossier : « Retirer X de ce dossier » (FOLD-03). */
export function removeFromFolderEntry({ ids }: SelectionContext, folderId: number, folderName: string): MenuItem {
  return {
    label: `Retirer ${n(ids.length)} de ce dossier`,
    disabled: ids.length === 0,
    run: () => void setFolderMedia(folderId, ids, false).then((c) => c !== undefined && folderBadge(c, false, folderName)),
  };
}

/** « Supprimer X de la bibliothèque… » : pop-in de DEL-04 au pluriel ; les médias supprimés quittent
 *  la sélection (ceux dont le fichier n'a pas pu être effacé y reviennent, DEL-08). */
export function deleteSelectionEntry({ ids }: SelectionContext): MenuItem {
  return deleteEntry(
    { count: ids.length, name: singleName() },
    // Retirés de la sélection avant l'envoi : la réponse du cœur Rust (échec d'un fichier) peut
    // arriver avant la fin de la demande, ils doivent alors pouvoir y revenir (DEL-08).
    (deleteFiles) => {
      removeDeletedFromSelection(ids);
      void deleteMedia(ids, deleteFiles).then((ok) => ok || settleSelectionDeletion(ids, true));
    },
    true,
  );
}

/** Menu ⋮ des outils de la sélection (SEL-03) ; `base` : requête de la grille (vue, recherche,
 *  types) pour « Sélectionner tous les résultats ». */
export function toolsMenu(selection: SelectionContext, base: Omit<ListQuery, "page">): MenuEntry[] {
  // « Sélectionner tous les résultats » en premier (retour du 23/10, SEL-01.3).
  return [
    {
      label: "Sélectionner tous les résultats",
      run: () =>
        void api
          .resultIds({ ...base, page: 1 })
          .then((ids) => addToSelection(ids.map((id) => ({ id }))))
          .catch((error) => useViewer.getState().setError({ action: "Sélectionner tous les résultats", code: null, message: String(error) })),
    },
    "separator",
    favoritesEntry(selection),
    folderEntry(selection),
    { label: "Ajouter des tags à la sélection", disabled: selection.ids.length === 0, run: focusTagAdder },
    { label: "Retirer des tags de la sélection", disabled: selection.ids.length === 0, run: focusTagRemover },
    "separator",
    deleteSelectionEntry(selection),
  ];
}
