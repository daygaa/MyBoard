// Menu du clic droit d'une vignette de la grille (CTX-05, ordre et libellés de l'utilisateur).
// Aucun raccourci affiché : ceux de la visionneuse ne marchent pas dans la grille. Sélection : grisée
// jusqu'à son lot (SEL). Favori : libellé selon l'état (CTX-01). Dossiers : liste à cocher (FOLD-09) ;
// dans la page d'un dossier, « Retirer de ce dossier » (FOLD-03).
// Suppression : pop-in avec sa case (DEL-04). Un échec (fichier introuvable…) s'affiche dans une
// pop-in (CTX-19).

import { folderPickEntries } from "@/components/folders/folderMenus";
import { copyFile, copyPath, openFile, revealFile } from "@/components/viewer/mediaActions";
import type { MediaItem } from "@/lib/api";
import type { MenuEntry } from "@/lib/contextMenu";
import { setFolderMedia } from "@/lib/folders";
import { folderIdOf } from "@/lib/router";
import { deleteMedia } from "@/stores/deletion";
import { isFavorite, setFavorite } from "@/stores/favorites";
import { useViewer } from "@/stores/viewer";
import { deleteEntry } from "./DeleteDialog";

export function tileMenu(item: MediaItem, index: number, pageSize: number): MenuEntry[] {
  const favorite = isFavorite(item.id, item.favorite);
  const folder = folderIdOf(window.location.hash);
  return [
    { label: "Ouvrir", run: () => useViewer.getState().openAt(index, item, pageSize) },
    { label: "Copier le fichier", run: () => void copyFile(item) },
    "separator",
    { label: favorite ? "Retirer des favoris" : "Ajouter aux favoris", run: () => void setFavorite([item.id], !favorite) },
    { label: "Ajouter à un dossier", submenu: folderPickEntries(item.id, item.folders) },
    { label: "Sélectionner" },
    "separator",
    { label: "Ouvrir avec l'application par défaut", run: () => openFile(item) },
    { label: "Afficher dans l'explorateur de fichiers", run: () => revealFile(item) },
    { label: "Copier le chemin du fichier", run: () => copyPath(item) },
    "separator",
    ...(folder !== null ? [{ label: "Retirer de ce dossier", run: () => void setFolderMedia(folder, [item.id], false) }] : []),
    deleteEntry([item], (deleteFiles) => void deleteMedia([item.id], deleteFiles)),
  ];
}
