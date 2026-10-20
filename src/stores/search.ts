// Recherche par tags en cours (SRCH-02 à SRCH-07). Non mémorisée au redémarrage (D-016),
// mais conservée en ouvrant puis fermant la visionneuse. Changer la recherche ramène à la
// page 1 ; les filtres par type et le tri n'y touchent jamais (FILT-03).
// Chaque recherche est une étape de l'historique de la fenêtre (NAV-06) : précédent / suivant
// (flèches de la barre de titre, boutons 4 / 5 de la souris, Alt + ← / →) passent d'une
// recherche à l'autre.
// La bibliothèque, les favoris et chaque dossier ont leur propre recherche : entrer dans une autre vue
// repart d'une recherche vide, revenir en arrière retrouve celle d'avant (FAV-06). Le nom de fichier
// cherché (SRCH-26) fait partie de la recherche, au même titre que les tags.
// Un tag renommé ou fusionné (SRCH-27) : la recherche en cours prend son nouveau nom, et celles des
// étapes de l'historique aussi quand on y revient.

import { create } from "zustand";

import { navigate } from "@/lib/router";
import { useLibrary } from "./library";

type Search = {
  /** Termes actifs, dans l'ordre d'ajout : `tag`, `-tag` (exclusion), `tag*` (joker). */
  terms: string[];
  /** Texte cherché dans le nom des fichiers (SRCH-26), en plus des tags ; `null` = aucun. */
  file: string | null;
};

type SearchState = Search & {
  /** Remplace toute la recherche, nom de fichier compris (clic sur un tag, SRCH-12 ; champ de
   *  recherche, SRCH-24 ; « Tout effacer »). */
  setTerms: (terms: string[]) => void;
  /** Ajoute des termes (boutons + / − des lignes de tags et des suggestions) ; un terme contraire est
   *  remplacé. Le nom de fichier cherché reste. */
  addTerms: (terms: string[]) => void;
  removeTerm: (term: string) => void;
  /** Inclure ↔ exclure un terme, à sa place dans la recherche (menu du clic droit, CTX-12). */
  invertTerm: (term: string) => void;
  /** Nom de fichier cherché (menu burger, SRCH-26) ; les tags restent. */
  setFile: (file: string | null) => void;
};

/** « tag » et « -tag » sont contraires : on ne garde que le dernier choisi. */
const opposite = (term: string) => (term.startsWith("-") ? term.slice(1) : `-${term}`);

/** Termes ajoutés à la suite, sans doublon ; un terme contraire déjà présent est remplacé. */
function merge(terms: string[], added: string[]) {
  for (const term of added) terms = [...terms.filter((t) => t !== term && t !== opposite(term)), term];
  return terms;
}

const same = (a: Search, b: Search) => a.file === b.file && a.terms.length === b.terms.length && a.terms.every((t, i) => t === b.terms[i]);

/** Nouvelle recherche : page 1, et une étape de plus dans l'historique (`remember`). */
function apply(next: Search, remember = true): Search {
  useLibrary.getState().setPage(1);
  const { terms, file } = useSearch.getState();
  if (remember && !same(next, { terms, file })) window.history.pushState({ ...window.history.state, terms: next.terms, file: next.file }, "");
  return next;
}

export const useSearch = create<SearchState>()((set, get) => ({
  terms: [],
  file: null,
  setTerms: (terms) => set(apply({ terms: merge([], terms), file: null })),
  addTerms: (added) => set(apply({ terms: merge(get().terms, added), file: get().file })),
  removeTerm: (term) => set(apply({ terms: get().terms.filter((t) => t !== term), file: get().file })),
  invertTerm: (term) => set(apply({ terms: get().terms.map((t) => (t === term ? opposite(term) : t)), file: get().file })),
  setFile: (file) => set(apply({ terms: get().terms, file: file?.trim() || null })),
}));

/** Noms de tags renommés ou fusionnés pendant la session (SRCH-27) : ancien → nouveau. Les autres
 *  étapes de l'historique ne peuvent pas être réécrites : on corrige leur recherche quand on y revient. */
const renamed = new Map<string, string>();

/** Termes avec les noms à jour ; un joker (« tag* ») reste tel quel. */
export function currentTerms(terms: string[]): string[] {
  return merge(
    [],
    terms.map((term) => {
      const exclude = term.startsWith("-");
      const body = exclude ? term.slice(1) : term;
      if (body.endsWith("*")) return term;
      let name = body;
      for (let i = 0; i < 20 && renamed.has(name); i++) name = renamed.get(name)!;
      return exclude ? `-${name}` : name;
    }),
  );
}

/** Tag renommé (ou fusionné dans un autre) : la recherche en cours suit, sans nouvelle étape. */
export function renameSearchTag(from: string, to: string) {
  if (from === to) return;
  renamed.delete(to); // ce nom désigne désormais ce tag-ci
  renamed.set(from, to);
  const { terms, file } = useSearch.getState();
  const next = currentTerms(terms);
  if (same({ terms: next, file }, { terms, file })) return;
  useSearch.setState({ terms: next });
  window.history.replaceState({ ...window.history.state, terms: next, file }, "");
}

/** Recherche enregistrée dans une étape de l'historique ; absente : celle d'avant (étape créée par
 *  un changement de page de l'application). */
function searchOf(state: unknown): Search | undefined {
  const saved = state as { terms?: string[]; file?: string | null } | null;
  return saved?.terms ? { terms: currentTerms(saved.terms), file: saved.file ?? null } : undefined;
}

/** Vue qui a sa propre recherche (FAV-06) ; les pages Importer et Gestionnaire de tags n'en ont pas
 *  (`null`). */
function searchView(hash: string): string | null {
  if (hash.startsWith("#/import") || hash.startsWith("#/tags")) return null;
  if (hash.startsWith("#/favoris")) return "favoris";
  return /^#\/dossier\/\d+/.exec(hash)?.[0] ?? "bibliotheque";
}
let lastView = searchView(window.location.hash) ?? "bibliotheque";

const NONE: Search = { terms: [], file: null };

/** Clic sur un tag du gestionnaire (TAGM-04) : la bibliothèque s'ouvre avec ce tag dans la recherche,
 *  en une seule étape d'historique (le retour arrière ramène au gestionnaire). */
export function searchInLibrary(terms: string[]) {
  lastView = "bibliotheque";
  useSearch.setState(apply({ terms: merge([], terms), file: null }, false));
  navigate("library");
}

/** Recherche d'un fichier depuis une page sans recherche (Importer, gestionnaire de tags) : dans la
 *  bibliothèque ; ailleurs, dans la vue en cours (SRCH-26). */
export function searchFile(file: string) {
  if (searchView(window.location.hash) === null) {
    lastView = "bibliotheque";
    useSearch.setState(apply({ terms: [], file: file.trim() || null }, false));
    navigate("library");
  } else useSearch.getState().setFile(file);
}

// Étape de départ : aucune recherche.
window.history.replaceState({ ...window.history.state, ...NONE }, "");
// Étape créée par un changement de page de l'application : dans une autre vue (favoris, dossier,
// bibliothèque), la recherche repart de zéro, page 1 ; sinon (Importer…), la recherche du moment y est
// notée, pour la retrouver en y revenant.
window.addEventListener("hashchange", () => {
  const view = searchView(window.location.hash);
  const changed = view !== null && view !== lastView;
  if (view !== null) lastView = view;
  if (changed) useLibrary.getState().setPage(1); // aussi en revenant en arrière : autre vue, page 1
  if (searchOf(window.history.state)) return; // retour / avance : popstate a remis la recherche
  const { terms, file } = useSearch.getState();
  const next = changed ? NONE : { terms, file };
  window.history.replaceState({ ...window.history.state, ...next }, "");
  if (changed) useSearch.setState(apply(next, false));
});
// Retour ou avance dans l'historique : la recherche de cette étape revient, sans nouvelle étape.
window.addEventListener("popstate", (e) => {
  const saved = searchOf(e.state);
  const { terms, file } = useSearch.getState();
  if (saved) window.history.replaceState({ ...window.history.state, ...saved }, ""); // noms à jour
  if (saved && !same(saved, { terms, file })) useSearch.setState(apply(saved, false));
});
