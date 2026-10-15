// Recherche par tags en cours (SRCH-02 à SRCH-07). Non mémorisée au redémarrage (D-016),
// mais conservée en ouvrant puis fermant la visionneuse. Changer la recherche ramène à la
// page 1 ; les filtres par type et le tri n'y touchent jamais (FILT-03).

import { create } from "zustand";

import { useLibrary } from "./library";

type SearchState = {
  /** Termes actifs, dans l'ordre d'ajout : `tag`, `-tag` (exclusion), `tag*` (joker). */
  terms: string[];
  /** Remplace toute la recherche (clic sur un tag, SRCH-12). */
  setTerms: (terms: string[]) => void;
  /** Ajoute des termes (bouton « + », champ de recherche) ; un terme contraire est remplacé. */
  addTerms: (terms: string[]) => void;
  removeTerm: (term: string) => void;
  /** Inclure ↔ exclure un terme, à sa place dans la recherche (menu du clic droit, CTX-12). */
  invertTerm: (term: string) => void;
};

/** « tag » et « -tag » sont contraires : on ne garde que le dernier choisi. */
const opposite = (term: string) => (term.startsWith("-") ? term.slice(1) : `-${term}`);

function apply(terms: string[]) {
  useLibrary.getState().setPage(1);
  return { terms };
}

export const useSearch = create<SearchState>()((set, get) => ({
  terms: [],
  setTerms: (terms) => set(apply([...new Set(terms)])),
  addTerms: (added) => {
    let terms = get().terms;
    for (const term of added) {
      terms = terms.filter((t) => t !== term && t !== opposite(term));
      terms = [...terms, term];
    }
    set(apply(terms));
  },
  removeTerm: (term) => set(apply(get().terms.filter((t) => t !== term))),
  invertTerm: (term) => set(apply(get().terms.map((t) => (t === term ? opposite(term) : t)))),
}));
