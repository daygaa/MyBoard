// Menu du clic droit d'une vignette de la grille (CTX-05, ordre et libellés de l'utilisateur).
// Aucun raccourci affiché : ceux de la visionneuse ne marchent pas dans la grille. Favoris,
// dossiers, sélection et suppression : grisés jusqu'à leur phase (FAV, FOLD, SEL, DEL). Un échec
// (fichier introuvable…) s'affiche dans une pop-in (CTX-19).

import { copyFile, copyPath, openFile, revealFile } from "@/components/viewer/mediaActions";
import type { MediaItem } from "@/lib/api";
import type { MenuEntry } from "@/lib/contextMenu";
import { useViewer } from "@/stores/viewer";

export function tileMenu(item: MediaItem, index: number, pageSize: number): MenuEntry[] {
  return [
    { label: "Ouvrir", run: () => useViewer.getState().openAt(index, item, pageSize) },
    { label: "Copier le fichier", run: () => void copyFile(item) },
    "separator",
    { label: "Ajouter aux favoris" },
    { label: "Ajouter à un dossier", disabled: true, submenu: [{ label: "Créer un dossier" }] },
    { label: "Sélectionner" },
    "separator",
    { label: "Ouvrir avec l'application par défaut", run: () => openFile(item) },
    { label: "Afficher dans l'explorateur de fichiers", run: () => revealFile(item) },
    { label: "Copier le chemin du fichier", run: () => copyPath(item) },
    "separator",
    { label: "Supprimer de la bibliothèque…", danger: true },
  ];
}
