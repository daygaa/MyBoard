// Recherche par tags de la barre latérale (SRCH-01 à SRCH-07), apparence v8 : champ avec
// autocomplétion + bouton doré ; les termes actifs s'affichent en pastilles dessous, et
// uniquement là (SRCH-07). Entrée ou le bouton lancent la recherche.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { TagInput } from "@/components/tags/TagInput";
import { TagPill } from "@/components/tags/TagPill";
import { FALLBACK_COLOR, useCategories } from "@/hooks/useCategories";
import { api } from "@/lib/api";
import { displayTag, parseTerms, splitTerm } from "@/lib/tags";
import { useSearch } from "@/stores/search";

/** Pastille d'un terme actif : couleur de la catégorie du tag s'il existe. */
function TermPill({ term }: { term: string }) {
  const removeTerm = useSearch((s) => s.removeTerm);
  const { color } = useCategories();
  const { exclude, name, prefix } = splitTerm(term);
  const { data: tag } = useQuery({ queryKey: ["tag", name], queryFn: () => api.findTag(name), enabled: !prefix });
  const label = `${exclude ? "−" : ""}${displayTag(name)}${prefix ? "*" : ""}`;
  return (
    <TagPill
      color={tag ? color(tag.categoryId) : prefix ? "#d9a94e" : FALLBACK_COLOR}
      onRemove={() => removeTerm(term)}
      removeLabel={`Retirer « ${label} » de la recherche`}
      title={exclude ? `Exclut ${displayTag(name)}` : undefined}
      className={exclude ? "line-through decoration-1" : undefined}
    >
      {label}
    </TagPill>
  );
}

export function SearchBox() {
  const [text, setText] = useState("");
  const terms = useSearch((s) => s.terms);
  const addTerms = useSearch((s) => s.addTerms);
  const setTerms = useSearch((s) => s.setTerms);

  const submit = (raw: string) => {
    const parsed = parseTerms(raw);
    if (parsed.length > 0) addTerms(parsed);
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
          onPick={(tag, negated) => {
            addTerms([`${negated ? "-" : ""}${tag.name}`]);
            setText("");
          }}
          allowNegation
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
      {terms.length > 0 && (
        <div data-zone="barre-laterale.recherche.termes" className="mt-3 flex flex-wrap items-center gap-1.5">
          {terms.map((term) => (
            <TermPill key={term} term={term} />
          ))}
          <button
            type="button"
            onClick={() => setTerms([])}
            className="px-1 text-xs text-muted-foreground transition hover:text-foreground"
          >
            Tout effacer
          </button>
        </div>
      )}
    </section>
  );
}
