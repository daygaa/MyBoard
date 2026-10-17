// Menu du clic droit d'une vignette de la grille (CTX-05, ordre et libellés de l'utilisateur).
// Aucun raccourci affiché : ceux de la visionneuse ne marchent pas dans la grille. Dossiers et
// sélection : grisés jusqu'à leur lot (FOLD, SEL). Favori : libellé selon l'état (CTX-01).
// Suppression : pop-in avec sa case (DEL-04). Un échec (fichier introuvable…) s'affiche dans une
// pop-in (CTX-19).

import { copyFile, copyPath, openFile, revealFile } from "@/components/viewer/mediaActions";
import type { MediaItem } from "@/lib/api";
import type { MenuEntry } from "@/lib/contextMenu";
import { deleteMedia } from "@/stores/deletion";
import { isFavorite, setFavorite } from "@/stores/favorites";
import { useViewer } from "@/stores/viewer";
import { deleteEntry } from "./DeleteDialog";

export function tileMenu(item: MediaItem, index: number, pageSize: number): MenuEntry[] {
  const favorite = isFavorite(item.id, item.favorite);
  return [
    { label: "Ouvrir", run: () => useViewer.getState().openAt(index, item, pageSize) },
    { label: "Copier le fichier", run: () => void copyFile(item) },
    "separator",
    { label: favorite ? "Retirer des favoris" : "Ajouter aux favoris", run: () => void setFavorite([item.id], !favorite) },
    { label: "Ajouter à un dossier", disabled: true, submenu: [{ label: "Créer un dossier" }] },
    { label: "Sélectionner" },
    "separator",
    { label: "Ouvrir avec l'application par défaut", run: () => openFile(item) },
    { label: "Afficher dans l'explorateur de fichiers", run: () => revealFile(item) },
    { label: "Copier le chemin du fichier", run: () => copyPath(item) },
    "separator",
    deleteEntry([item], (deleteFiles) => void deleteMedia([item.id], deleteFiles)),
  ];
}
