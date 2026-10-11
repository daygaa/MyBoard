// Dernier état connu de l'import, tel qu'envoyé par le cœur Rust (événement `import-state`).

import { create } from "zustand";

import type { ImportSnapshot } from "@/lib/api";

type ImportState = {
  snapshot: ImportSnapshot | null;
  /** Inclure les sous-dossiers (IMP-04) : choix gardé pour le prochain dossier. */
  recursive: boolean;
  setSnapshot: (snapshot: ImportSnapshot) => void;
  setRecursive: (recursive: boolean) => void;
};

export const useImport = create<ImportState>()((set) => ({
  snapshot: null,
  recursive: true,
  setSnapshot: (snapshot) => set({ snapshot }),
  setRecursive: (recursive) => set({ recursive }),
}));
