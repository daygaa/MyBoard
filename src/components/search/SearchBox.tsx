// Recherche par tags de la barre latérale (SRCH-01 à SRCH-07), apparence v8 : champ avec
// autocomplétion + bouton doré ; les termes actifs s'affichent en pastilles dessous, et
// uniquement là (SRCH-07, SearchTerms). Entrée ou le bouton lancent une nouvelle recherche avec les
// tags tapés, et eux seuls (SRCH-24) ; les boutons + / − des suggestions ajoutent un tag à la
// recherche en cours (SRCH-21). Un synonyme tapé (TAGM-15) donne la pastille de son tag principal.
// Un tag déjà dans la recherche reste proposé normalement (le choisir prépare une nouvelle recherche,
// SRCH-24) ; seul son bouton + (déjà inclus) ou − (déjà exclu) est grisé, avec une bulle (SRCH-29).

import { useState } from "react";
import { Search } from "lucide-react";

import { SearchTerms } from "@/components/search/SearchTerms";
import { TagInput } from "@/components/tags/TagInput";
import { api } from "@/lib/api";
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

export function SearchBox() {
  const [text, setText] = useState("");
  const terms = useSearch((s) => s.terms);
  const addTerms = useSearch((s) => s.addTerms);
  const setTerms = useSearch((s) => s.setTerms);
  const route = useRoute();
  // Recherche limitée à la vue (FAV-02, FOLD-04), comme les titres de la v8.
  const title = route === "favorites" ? "Recherche dans les favoris" : route === "folder" ? "Recherche dans le dossier" : "Recherche";

  const submit = (raw: string) => {
    const parsed = parseTerms(raw);
    setText("");
    if (parsed.length > 0) void withMainTags(parsed).then(setTerms);
  };

  return (
    <section data-zone="barre-laterale.recherche">
      <h3 className="mb-2 px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{title}</h3>
      <div className="flex gap-2">
        <TagInput
          zone="barre-laterale.recherche.champ"
          value={text}
          onChange={setText}
          onSubmit={submit}
          onAddTerm={(tag, exclude) => addTerms([`${exclude ? "-" : ""}${tag.name}`])}
          termTaken={(tag, exclude) => {
            if (exclude) return terms.includes(`-${tag.name}`) ? "Ce tag est déjà exclu de cette recherche" : null;
            return terms.includes(tag.name) ? "Ce tag est déjà inclus dans cette recherche" : null;
          }}
          placeholder="Ajouter un tag à la recherche…"
          className="h-[38px] flex-1"
        />
        <button
          type="button"
          data-zone="barre-laterale.recherche.bouton"
          onClick={() => submit(text)}
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
