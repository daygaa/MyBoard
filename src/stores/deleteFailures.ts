// Fichiers qui n'ont pas pu être effacés (DEL-04, DEL-08) : leurs médias sont revenus dans la
// bibliothèque ; la pop-in `DeleteFailedDialog` les liste. « Supprimer quand même » (fichiers en
// lecture seule) relance leur suppression : ceux qui échouent encore remplacent la liste, sans le
// bouton ; si tous partent, la pop-in se ferme.

import { create } from "zustand";

import type { FailedFile } from "@/lib/api";

type State = {
  failures: FailedFile[];
  /** Suppression forcée en cours : identifiants attendus. */
  forcing: number[];
  /** Après « Supprimer quand même » : la liste n'a plus de bouton. */
  forced: boolean;
};

export const useDeleteFailures = create<State>()(() => ({ failures: [], forcing: [], forced: false }));

/** Nouveaux échecs reçus du cœur Rust. */
export function addFailures(files: FailedFile[]) {
  useDeleteFailures.setState((s) => {
    const known = new Set(files.map((f) => f.id));
    const failures = [...s.failures.filter((f) => !known.has(f.id)), ...files];
    const forced = files.some((f) => s.forcing.includes(f.id));
    return forced ? { failures, forcing: s.forcing.filter((id) => !known.has(id)), forced: true } : { failures };
  });
}

/** Médias réellement supprimés : ils quittent la liste ; plus rien d'attendu ni d'affiché : fermée. */
export function settleFailures(deleted: number[]) {
  const gone = new Set(deleted);
  useDeleteFailures.setState((s) => {
    const forcing = s.forcing.filter((id) => !gone.has(id));
    const failures = s.failures.filter((f) => !gone.has(f.id));
    const finished = s.forcing.length > 0 && forcing.length === 0;
    if (finished && failures.length === 0) return { failures: [], forcing: [], forced: false };
    return { forcing, failures, forced: s.forced || finished };
  });
}

export function startForcing(ids: number[]) {
  useDeleteFailures.setState((s) => ({ forcing: ids, failures: s.failures.filter((f) => !ids.includes(f.id)) }));
}

export const closeFailures = () => useDeleteFailures.setState({ failures: [], forcing: [], forced: false });
