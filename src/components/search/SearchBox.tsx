// Recherche par tags de la barre latérale (SRCH-01 à SRCH-07, SRCH-28), apparence v8 : champ à pastilles
// + bouton doré ; les termes actifs s'affichent en pastilles dessous, et uniquement là (SRCH-07,
// SearchTerms). Le champ prépare une nouvelle recherche (choix du 25/10) : chaque mot tapé devient une
// pastille à l'espace ou au choix d'une suggestion ; Entrée ou le bouton lancent la recherche avec tout ce
// qui est écrit, et cela seul (SRCH-24), puis le champ se vide. Les boutons + / − des suggestions ajoutent
// un tag à la recherche en cours (SRCH-21). Un synonyme tapé (TAGM-15) donne la pastille de son tag
// principal. Les suggestions ne proposent ni les tags déjà cherchés ni ceux déjà écrits (SRCH-29).

import { Search } from "lucide-react";

import { SearchTerms, TermPill } from "@/components/search/SearchTerms";
import { PillField } from "@/components/tags/PillField";
import { usePills } from "@/hooks/usePills";
import { api, type TagInfo } from "@/lib/api";
import { collect } from "@/lib/pillText";
import { queryClient } from "@/lib/queryClient";
import { useRoute } from "@/lib/router";
import { parseTerms, splitTerm } from "@/lib/tags";
import { useSearch } from "@/stores/search";

/** Termes avec le tag principal à la place d'un synonyme : la pastille montre le tag vraiment cherché.
 *  Un joker (« tag* ») ne porte que sur les vrais noms de tags. */
function withMainTags(terms: string[]): Promise<string[]> {
  return Promise.all(
    terms.map(async (term) => {
      const { exclude, name, prefix } = splitTerm(term);
      if (prefix) return term;
      const found = await api.findTag(name).catch(() => null);
      return found?.alias ? `${exclude ? "-" : ""}${found.name}` : term;
    }),
  );
}

/** Un mot tapé → son terme (« -tag » exclut, « tag* » est un joker, SRCH-03, SRCH-04). */
const termOf = (word: string) => parseTerms(word)[0] ?? null;
const sameTerm = (a: string, b: string) => a === b;

const FIELD = "flex min-h-[38px] min-w-0 flex-1 items-center rounded-lg border border-border bg-background px-1.5 py-1 focus-within:border-[#d9a94e]/60";

export function SearchBox() {
  const field = usePills<string>(sameTerm);
  const terms = useSearch((s) => s.terms);
  const addTerms = useSearch((s) => s.addTerms);
  const setTerms = useSearch((s) => s.setTerms);
  const route = useRoute();
  // Recherche limitée à la vue (FAV-02, FOLD-04), comme les titres de la v8.
  const title = route === "favorites" ? "Recherche dans les favoris" : route === "folder" ? "Recherche dans le dossier" : "Recherche";

  const launch = (items: string[]) => {
    field.clear();
    if (items.length > 0) void withMainTags(items).then(setTerms);
  };

  return (
    <section data-zone="barre-laterale.recherche">
      <h3 className="mb-2 px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</h3>
      <div className="flex items-start gap-2">
        <PillField
          zone="barre-laterale.recherche.champ"
          editorZone="barre-laterale.recherche.saisie"
          pills={field}
          words
          pillKey={(term) => term}
          renderPill={(term, remove) => <TermPill term={term} onRemove={remove} />}
          resolve={termOf}
          toItem={(tag, negated) => `${negated ? "-" : ""}${tag.name}`}
          toClip={(term) => {
            const { exclude, name, prefix } = splitTerm(term);
            const tag = queryClient.getQueryData<TagInfo | null>(["tag", name]);
            return { name, categoryId: tag?.categoryId ?? null, exclude, prefix };
          }}
          fromClip={(c) => `${c.exclude ? "-" : ""}${c.name}${c.prefix ? "*" : ""}`}
          hidden={terms.map((t) => splitTerm(t).name)}
          onAddTerm={(tag, exclude) => addTerms([`${exclude ? "-" : ""}${tag.name}`])}
          onSubmit={launch}
          dropdown="bottom"
          placeholder="Ajouter un tag à la recherche…"
          className={FIELD}
        />
        <button
          type="button"
          data-zone="barre-laterale.recherche.bouton"
          onClick={() => launch(collect(field.doc, termOf, sameTerm))}
          aria-label="Rechercher"
          className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-lg bg-[#d9a94e] text-[#1a1408] transition hover:bg-[#e3b75f]"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>
      <SearchTerms />
    </section>
  );
}
