// Recherche par tags en cours (SRCH-02 à SRCH-07). Non mémorisée au redémarrage (D-016),
// mais conservée en ouvrant puis fermant la visionneuse. Changer la recherche ramène à la
// page 1 ; les filtres par type et le tri n'y touchent jamais (FILT-03).
// Chaque recherche est une étape de l'historique de la fenêtre (NAV-06) : précédent / suivant
// (flèches de la barre de titre, boutons 4 / 5 de la souris, Alt + ← / →) passent d'une
// recherche à l'autre.
// La bibliothèque, les favoris et chaque dossier ont leur propre recherche : entrer dans une autre vue
// repart d'une recherche vide, revenir en arrière retrouve celle d'avant (FAV-06).

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

/** Vue qui a sa propre recherche (FAV-06) ; la page Importer n'en a pas (`null`). */
function searchView(hash: string): string | null {
  if (hash.startsWith("#/import")) return null;
  if (hash.startsWith("#/favoris")) return "favoris";
  return /^#\/dossier\/\d+/.exec(hash)?.[0] ?? "bibliotheque";
}
let lastView = searchView(window.location.hash) ?? "bibliotheque";

// Étape de départ : aucune recherche.
window.history.replaceState({ ...window.history.state, terms: [] }, "");
// Étape créée par un changement de page de l'application : dans une autre vue (favoris, dossier,
// bibliothèque), la recherche repart de zéro, page 1 ; sinon (Importer…), la recherche du moment y est
// notée, pour la retrouver en y revenant.
window.addEventListener("hashchange", () => {
  const view = searchView(window.location.hash);
  const changed = view !== null && view !== lastView;
  if (view !== null) lastView = view;
  if (changed) useLibrary.getState().setPage(1); // aussi en revenant en arrière : autre vue, page 1
  if (termsOf(window.history.state)) return; // retour / avance : popstate a remis la recherche
  const terms = changed ? [] : useSearch.getState().terms;
  window.history.replaceState({ ...window.history.state, terms }, "");
  if (changed) useSearch.setState(apply(terms, false));
});
// Retour ou avance dans l'historique : la recherche de cette étape revient, sans nouvelle étape.
window.addEventListener("popstate", (e) => {
  const terms = termsOf(e.state);
  if (terms && !same(terms, useSearch.getState().terms)) useSearch.setState(apply(terms, false));
});
