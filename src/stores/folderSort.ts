// Ordre de la liste des dossiers (FOLD-10, retour AUT.13, choix de l'utilisateur du 07/11) : menu burger et listes
// à cocher « Ajouter à un dossier » (FOLD-09). Une entrée par critère, qui montre son sens : un clic sur une autre
// entrée l'applique telle qu'affichée, un clic sur l'entrée en cours inverse son sens ; chaque entrée garde le
// dernier sens utilisé. Par défaut : A → Z ↓. Gardé d'un lancement à l'autre.

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FolderSortKey = "name" | "media" | "created" | "color" | "opened";
/** ↓ : ordre « naturel » (A en haut, le plus de médias, le plus récent, la palette dans l'ordre) ; ↑ : l'inverse. */
export type SortDirection = "down" | "up";

/** Entrées du menu, dans cet ordre, avec leur libellé dans chaque sens. */
export const FOLDER_SORTS: { key: FolderSortKey; label: Record<SortDirection, string> }[] = [
  { key: "name", label: { down: "A → Z ↓", up: "A ← Z ↑" } },
  { key: "media", label: { down: "Médias + ↓", up: "Médias - ↑" } },
  { key: "created", label: { down: "Créés : récents ↓", up: "Créés : anciens ↑" } },
  { key: "color", label: { down: "Couleur ↓", up: "Couleur ↑" } },
  { key: "opened", label: { down: "Ouverts : récents ↓", up: "Ouverts : anciens ↑" } },
];

type FolderSortState = {
  key: FolderSortKey;
  dirs: Record<FolderSortKey, SortDirection>;
  /** Clic sur une entrée du menu. */
  choose: (key: FolderSortKey) => void;
};

export const useFolderSort = create<FolderSortState>()(
  persist(
    (set) => ({
      key: "name",
      dirs: { name: "down", media: "down", created: "down", color: "down", opened: "down" },
      choose: (key) =>
        set((s) => (s.key === key ? { dirs: { ...s.dirs, [key]: s.dirs[key] === "down" ? "up" : "down" } } : { key })),
    }),
    { name: "myboard.dossiers.tri", partialize: ({ key, dirs }) => ({ key, dirs }) },
  ),
);
