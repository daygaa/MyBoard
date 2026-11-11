// Dernier état de la vérification des fichiers (LIB-05, LIB-14) et choix de l'utilisateur pour cette séance : pop-in des
// fichiers disparus fermée par Échap ou la croix (elle revient à l'ouverture suivante, ou si d'autres fichiers
// disparus sont trouvés), bandeau des emplacements inaccessibles fermé.

import { create } from "zustand";

import type { CheckState } from "@/lib/libraryCheck";

type State = {
  check: CheckState;
  /** Liste des médias disparus (son numéro) quand la pop-in a été fermée sans réponse. */
  dismissedVersion: number;
  /** Emplacements dont le bandeau a été fermé. */
  closedRoots: Set<string>;
  setCheck: (check: CheckState) => void;
  dismissDialog: () => void;
  closeBanner: () => void;
};

export const useLibraryCheck = create<State>()((set, get) => ({
  check: { running: false, missing: [], missingTotal: 0, missingVersion: 0, offline: [] },
  dismissedVersion: 0,
  closedRoots: new Set(),
  setCheck: (check) => set({ check }),
  dismissDialog: () => set({ dismissedVersion: get().check.missingVersion }),
  closeBanner: () => set({ closedRoots: new Set(get().check.offline.map((o) => o.root)) }),
}));
