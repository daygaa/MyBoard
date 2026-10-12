// Dernier état connu de l'import, tel qu'envoyé par le cœur Rust (événement `import-state`),
// et tags par défaut choisis pour le prochain import (IMP-30).

import { create } from "zustand";

import type { ImportSnapshot, NewTag } from "@/lib/api";

type ImportState = {
  snapshot: ImportSnapshot | null;
  /** Inclure les sous-dossiers (IMP-04) : choix gardé pour le prochain dossier. */
  recursive: boolean;
  /** Tags ajoutés à tous les fichiers du prochain import (IMP-30) ; vidés une fois appliqués. */
  defaultTags: NewTag[];
  setSnapshot: (snapshot: ImportSnapshot) => void;
  setRecursive: (recursive: boolean) => void;
  addDefaultTag: (tag: NewTag) => void;
  removeDefaultTag: (name: string) => void;
};

export const useImport = create<ImportState>()((set, get) => ({
  snapshot: null,
  recursive: true,
  defaultTags: [],
  setSnapshot: (snapshot) => {
    // Import terminé : les tags par défaut ont été appliqués, la carte revient à zéro
    // (comme l'encadré de dépôt, IMP-50).
    const finished = snapshot.phase === "finished" && get().snapshot?.phase === "importing";
    set(finished ? { snapshot, defaultTags: [] } : { snapshot });
  },
  setRecursive: (recursive) => set({ recursive }),
  addDefaultTag: (tag) => {
    if (get().defaultTags.some((t) => t.name === tag.name)) return;
    set({ defaultTags: [...get().defaultTags, tag] });
  },
  removeDefaultTag: (name) => set({ defaultTags: get().defaultTags.filter((t) => t.name !== name) }),
}));
