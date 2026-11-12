// Travail en arrière-plan sur les tags (TAGM-23) : les tags mis à la corbeille ou supprimés, et les lignes de la
// corbeille restaurées, sont cachés aussitôt partout (gestionnaire, barre latérale, visionneuse, suggestions, sélection,
// corbeille) en attendant que le cœur Rust ait fini ; l'avancement s'affiche dans un badge (TagJobBadge).

import { create } from "zustand";

/** Sorte du travail en cours (`tag_jobs.kind`) : 1 corbeille, 2 suppression définitive, 3 restauration. */
export type TagJobProgress = { kind: 1 | 2 | 3; done: number; total: number };

type State = {
  /** Tags en attente (identifiants, et noms pour les listes de noms). */
  tags: Set<number>;
  names: Set<string>;
  /** Lignes de la corbeille en cours de restauration. */
  trash: Set<number>;
  progress: TagJobProgress | null;
  /** Début du travail en cours (le badge n'apparaît qu'au-delà d'une demi-seconde). */
  since: number;
};

export const useTagJobs = create<State>(() => ({ tags: new Set(), names: new Set(), trash: new Set(), progress: null, since: 0 }));

/** Sans les tags en attente. */
export function withoutPending<T extends { id: number }>(list: T[]): T[] {
  const { tags } = useTagJobs.getState();
  return tags.size === 0 ? list : list.filter((t) => !tags.has(t.id));
}

export function withoutPendingNames(list: string[]): string[] {
  const { names } = useTagJobs.getState();
  return names.size === 0 ? list : list.filter((n) => !names.has(n));
}

/** Sans les lignes de la corbeille en cours de restauration. */
export function withoutRestoring<T extends { id: number }>(list: T[]): T[] {
  const { trash } = useTagJobs.getState();
  return trash.size === 0 ? list : list.filter((t) => !trash.has(t.id));
}
