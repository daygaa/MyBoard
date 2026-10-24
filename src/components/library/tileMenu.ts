// Menu du clic droit d'une vignette de la grille (CTX-05, ordre et libellés de l'utilisateur).
// Aucun raccourci affiché : ceux de la visionneuse ne marchent pas dans la grille. « Sélectionner » :
// coche la vignette et passe en mode sélection (SEL-01). Favori : libellé selon l'état (CTX-01).
// Dossiers : liste à cocher (FOLD-09) ; dans la page d'un dossier, « Retirer de ce dossier » (FOLD-03).
// Suppression : pop-in avec sa case (DEL-04). Un échec (fichier introuvable…) s'affiche dans une
// pop-in (CTX-19).
// Vignette cochée en mode sélection (`selection`, SEL-08) : favoris, dossiers, retrait du dossier et
// suppression agissent sur toute la sélection, avec le nombre dans le libellé ; « Désélectionner ».

import { folderListLabel, folderPickEntries } from "@/components/folders/folderMenus";
import { copyFile, copyPath, openFile, revealFile } from "@/components/viewer/mediaActions";
import type { MediaItem } from "@/lib/api";
import type { MenuEntry } from "@/lib/contextMenu";
import { cachedFolders, setFolderMedia } from "@/lib/folders";
import { folderIdOf } from "@/lib/router";
import { deleteMedia } from "@/stores/deletion";
import { isFavorite, setFavorite } from "@/stores/favorites";
import { addToSelection, isSelecting, removeFromSelection, startSelection } from "@/stores/selection";
import { useViewer } from "@/stores/viewer";
import { deleteEntry } from "./DeleteDialog";
import { deleteSelectionEntry, favoritesEntry, folderEntry, removeFromFolderEntry, type SelectionContext } from "./selectionMenu";

export function tileMenu(item: MediaItem, index: number, pageSize: number, selection?: SelectionContext): MenuEntry[] {
  const favorite = isFavorite(item.id, item.favorite);
  const folder = folderIdOf(window.location.hash);
  const folderName = cachedFolders().find((f) => f.id === folder)?.name ?? "";
  return [
    { label: "Ouvrir", run: () => useViewer.getState().openAt(index, item, pageSize) },
    { label: "Copier le fichier", run: () => void copyFile(item) },
    "separator",
    selection ? favoritesEntry(selection) : { label: favorite ? "Retirer des favoris" : "Ajouter aux favoris", run: () => void setFavorite([item.id], !favorite) },
    selection ? folderEntry(selection) : { label: folderListLabel(item.folders), submenu: folderPickEntries(item.id, item.folders) },
    selection
      ? { label: "Désélectionner", run: () => removeFromSelection([item.id]) }
      : { label: "Sélectionner", run: () => (isSelecting() ? addToSelection([item]) : startSelection([item])) },
    "separator",
    { label: "Ouvrir avec l'application par défaut", run: () => openFile(item) },
    { label: "Afficher dans l'explorateur de fichiers", run: () => revealFile(item) },
    { label: "Copier le chemin du fichier", run: () => copyPath(item) },
    "separator",
    ...(folder === null
      ? []
      : [selection ? removeFromFolderEntry(selection, folder, folderName) : { label: "Retirer de ce dossier", run: () => void setFolderMedia(folder, [item.id], false) }]),
    selection
      ? deleteSelectionEntry(selection)
      : deleteEntry({ count: 1, name: item.fileName }, (deleteFiles) => void deleteMedia([item.id], deleteFiles)),
  ];
}
