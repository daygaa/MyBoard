// Section « Rechercher un fichier » du menu burger (SRCH-26), sous la navigation, au-dessus des
// dossiers : Entrée ou le bouton loupe ferment le menu et la grille montre les médias de la vue en
// cours dont le nom contient le texte (sans tenir compte des majuscules), en plus des tags ; le texte
// devient une pastille blanche parmi les termes de la recherche (SearchTerms).

import { useState } from "react";
import { Search } from "lucide-react";

import { searchFile } from "@/stores/search";

export function FileSearch({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const submit = () => {
    if (!text.trim()) return;
    searchFile(text);
    setText("");
    onDone();
  };
  return (
    <div data-zone="menu.fichier" className="mt-2 border-t border-border p-2">
      <h3 className="px-3 py-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Rechercher un fichier</h3>
      <form
        className="flex items-center gap-1.5 px-1"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          data-zone="menu.fichier.champ"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nom ou partie du nom…"
          spellCheck={false}
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-[#d9a94e]/60"
        />
        <button
          type="submit"
          data-zone="menu.fichier.chercher"
          disabled={!text.trim()}
          aria-label="Rechercher ce nom de fichier"
          title="Rechercher (Entrée)"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#d9a94e] text-[#1a1408] transition hover:bg-[#e3b75f] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#d9a94e]"
        >
          <Search className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
