// Dernier état connu de l'import, tel qu'envoyé par le cœur Rust (événement `import-state`),
// tags par défaut choisis pour le prochain import (IMP-30) et options de l'import. Les options (sous-dossiers,
// compression et sa qualité) retiennent le dernier choix, même après la fermeture de MyBoard, en attendant la page
// Paramètres (IMP-29, SET-05).

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ImportSnapshot, NewTag } from "@/lib/api";

/** Qualité de compression : 20 à 95, 85 par défaut (comme la v8, IMP-20). */
export const QUALITY = { min: 20, max: 95, initial: 85 } as const;

type ImportState = {
  snapshot: ImportSnapshot | null;
  /** Inclure les sous-dossiers (IMP-04). */
  recursive: boolean;
  /** « Compresser les images » (IMP-20) et sa qualité. */
  compress: boolean;
  quality: number;
  /** Tags ajoutés à tous les fichiers du prochain import (IMP-30) ; vidés une fois appliqués. */
  defaultTags: NewTag[];
  setSnapshot: (snapshot: ImportSnapshot) => void;
  setRecursive: (recursive: boolean) => void;
  setCompress: (compress: boolean) => void;
  setQuality: (quality: number) => void;
  addDefaultTag: (tag: NewTag) => void;
  removeDefaultTag: (name: string) => void;
};

export const useImport = create<ImportState>()(
  persist(
    (set, get) => ({
      snapshot: null,
      recursive: true,
      compress: false,
      quality: QUALITY.initial,
      defaultTags: [],
      setSnapshot: (snapshot) => {
        // Import terminé : les tags par défaut ont été appliqués, la carte revient à zéro
        // (comme l'encadré de dépôt, IMP-50).
        const finished = snapshot.phase === "finished" && get().snapshot?.phase === "importing";
        set(finished ? { snapshot, defaultTags: [] } : { snapshot });
      },
      setRecursive: (recursive) => set({ recursive }),
      setCompress: (compress) => set({ compress }),
      setQuality: (quality) => set({ quality: Math.min(QUALITY.max, Math.max(QUALITY.min, Math.round(quality))) }),
      addDefaultTag: (tag) => {
        if (get().defaultTags.some((t) => t.name === tag.name)) return;
        set({ defaultTags: [...get().defaultTags, tag] });
      },
      removeDefaultTag: (name) => set({ defaultTags: get().defaultTags.filter((t) => t.name !== name) }),
    }),
    {
      name: "myboard.import-options",
      // Seules les options sont gardées ; l'état de l'import vient toujours du cœur Rust.
      partialize: (s) => ({ recursive: s.recursive, compress: s.compress, quality: s.quality }),
    },
  ),
);
