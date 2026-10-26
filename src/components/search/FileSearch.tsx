// Section « Rechercher un fichier » du menu burger (SRCH-26), sous la navigation, au-dessus des
// dossiers : Entrée ou le bouton loupe ferment le menu et la grille montre les médias de la vue en
// cours dont le nom contient le texte (sans tenir compte des majuscules), en plus des tags ; le texte
// devient une pastille blanche parmi les termes de la recherche (SearchTerms).
// Exclure (retour T3, point SRCH-26.2) : à droite du titre, un bouton « Contient » (doré, par défaut) qui
// passe à « Exclut » (rouge) au clic, et inversement ; ou un « - » devant le texte, comme pour les tags.
// Un seul nom de fichier à la fois ; après une recherche, le bouton revient à « Contient ».

import { useState } from "react";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { searchFile } from "@/stores/search";

export function FileSearch({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [exclude, setExclude] = useState(false);
  const dash = text.trim().startsWith("-");
  const bare = dash ? text.trim().slice(1).trim() : text.trim();
  const submit = () => {
    if (!bare) return;
    searchFile(exclude || dash ? `-${bare}` : bare);
    setText("");
    setExclude(false);
    onDone();
  };
  return (
    <div data-zone="menu.fichier" className="mt-2 border-t border-border p-2">
      {/* Bouton calé à droite sur la loupe du champ ; la ligne garde la hauteur du titre seul (28 px). */}
      <div className="flex h-7 items-center justify-between gap-2 pr-1 pl-3">
        <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Rechercher un fichier</h3>
        <button
          type="button"
          data-zone="menu.fichier.mode"
          aria-pressed={exclude}
          onClick={() => setExclude((on) => !on)}
          title={exclude ? "Les fichiers dont le nom ne contient pas le texte (clic : contient)" : "Les fichiers dont le nom contient le texte (clic : exclut)"}
          className={cn(
            "shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium transition",
            exclude ? "border-rose-400/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25" : "border-[#d9a94e]/40 bg-[#d9a94e]/15 text-[#d9a94e] hover:bg-[#d9a94e]/25",
          )}
        >
          {exclude ? "Exclut" : "Contient"}
        </button>
      </div>
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
          disabled={!bare}
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
