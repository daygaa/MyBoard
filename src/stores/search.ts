// Recherche par tags en cours (SRCH-02 à SRCH-07). Non mémorisée au redémarrage (D-016),
// mais conservée en ouvrant puis fermant la visionneuse. Changer la recherche ramène à la
// page 1 ; les filtres par type et le tri n'y touchent jamais (FILT-03).
// Chaque recherche est une étape de l'historique de la fenêtre (NAV-06) : précédent / suivant
// (flèches de la barre de titre, boutons 4 / 5 de la souris, Alt + ← / →) passent d'une
// recherche à l'autre.

import { create } from "zustand";

import { useLibrary } from "./library";

type SearchState = {
  /** Termes actifs, dans l'ordre d'ajout : `tag`, `-tag` (exclusion), `tag*` (joker). */
  terms: string[];
  /** Remplace toute la recherche (clic sur un tag, SRCH-12 ; champ de recherche, SRCH-24). */
  setTerms: (terms: string[]) => void;
  /** Ajoute des termes (boutons + / − des lignes de tags et des suggestions) ; un terme contraire est
   *  remplacé. */
  addTerms: (terms: string[]) => void;
  removeTerm: (term: string) => void;
  /** Inclure ↔ exclure un terme, à sa place dans la recherche (menu du clic droit, CTX-12). */
  invertTerm: (term: string) => void;
};

/** « tag » et « -tag » sont contraires : on ne garde que le dernier choisi. */
const opposite = (term: string) => (term.startsWith("-") ? term.slice(1) : `-${term}`);

/** Termes ajoutés à la suite, sans doublon ; un terme contraire déjà présent est remplacé. */
function merge(terms: string[], added: string[]) {
  for (const term of added) terms = [...terms.filter((t) => t !== term && t !== opposite(term)), term];
  return terms;
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((t, i) => t === b[i]);

/** Nouvelle recherche : page 1, et une étape de plus dans l'historique (`remember`). */
function apply(terms: string[], remember = true) {
  useLibrary.getState().setPage(1);
  if (remember && !same(terms, useSearch.getState().terms)) window.history.pushState({ ...window.history.state, terms }, "");
  return { terms };
}

export const useSearch = create<SearchState>()((set, get) => ({
  terms: [],
  setTerms: (terms) => set(apply(merge([], terms))),
  addTerms: (added) => set(apply(merge(get().terms, added))),
  removeTerm: (term) => set(apply(get().terms.filter((t) => t !== term))),
  invertTerm: (term) => set(apply(get().terms.map((t) => (t === term ? opposite(term) : t)))),
}));

/** Recherche enregistrée dans une étape de l'historique ; absente : celle d'avant (étape créée par
 *  un changement de page de l'application). */
const termsOf = (state: unknown) => (state as { terms?: string[] } | null)?.terms;

// Étape de départ : aucune recherche.
window.history.replaceState({ ...window.history.state, terms: [] }, "");
// Étape créée par un changement de page de l'application (Importer…) : la recherche du moment y est
// notée, pour la retrouver en y revenant.
window.addEventListener("hashchange", () => {
  if (!termsOf(window.history.state)) window.history.replaceState({ ...window.history.state, terms: useSearch.getState().terms }, "");
});
// Retour ou avance dans l'historique : la recherche de cette étape revient, sans nouvelle étape.
window.addEventListener("popstate", (e) => {
  const terms = termsOf(e.state);
  if (terms && !same(terms, useSearch.getState().terms)) useSearch.setState(apply(terms, false));
});
