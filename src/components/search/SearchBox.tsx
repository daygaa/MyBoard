// Recherche par tags de la barre latérale (SRCH-01 à SRCH-07), apparence v8 : champ avec
// autocomplétion + bouton doré ; les termes actifs s'affichent en pastilles dessous, et
// uniquement là (SRCH-07, SearchTerms). Entrée ou le bouton lancent une nouvelle recherche avec les
// tags tapés, et eux seuls (SRCH-24) ; les boutons + / − des suggestions ajoutent un tag à la
// recherche en cours (SRCH-21).

import { useState } from "react";
import { Search } from "lucide-react";

import { SearchTerms } from "@/components/search/SearchTerms";
import { TagInput } from "@/components/tags/TagInput";
import { parseTerms } from "@/lib/tags";
import { useSearch } from "@/stores/search";

export function SearchBox() {
  const [text, setText] = useState("");
  const addTerms = useSearch((s) => s.addTerms);
  const setTerms = useSearch((s) => s.setTerms);

  const submit = (raw: string) => {
    const parsed = parseTerms(raw);
    if (parsed.length > 0) setTerms(parsed);
    setText("");
  };

  return (
    <section data-zone="barre-laterale.recherche">
      <h3 className="mb-2 px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Recherche</h3>
      <div className="flex gap-2">
        <TagInput
          zone="barre-laterale.recherche.champ"
          value={text}
          onChange={setText}
          onSubmit={submit}
          onAddTerm={(tag, exclude) => addTerms([`${exclude ? "-" : ""}${tag.name}`])}
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
