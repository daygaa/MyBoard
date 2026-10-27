// Onglet « Synonymes et parents » du gestionnaire de tags (TAGM-15, TAGM-16) : toutes les règles en un
// seul endroit, en deux colonnes côte à côte. Chacune : un champ pour ajouter une règle, un filtre par
// nom, puis la liste (synonymes : case pour désactiver / réactiver ; parents : interrupteur, refonte D10 ;
// corbeille). La page ne défile pas : les tableaux s'arrêtent au bas de la fenêtre et chaque liste a sa
// barre de défilement (demande du 26/10), qui garde la molette (GEN-24).

import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";

import type { RulesIndex } from "@/hooks/useTagRules";
import type { ManagedTag } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { addAlias, addParent } from "@/lib/tagRules";
import { normalizeTag } from "@/lib/tags";
import { RuleForm, useTagResolver } from "./RuleForm";
import { AliasLine, ParentLine, type TagOf } from "./RuleLines";

function Panel({ zone, title, count, help, form, filter, onFilter, children, empty }: {
  zone: string;
  title: string;
  count: number;
  help: string;
  form: ReactNode;
  filter: string;
  onFilter: (text: string) => void;
  children: ReactNode[];
  empty: string;
}) {
  return (
    <section data-zone={zone} className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border bg-card/40 p-3">
      <div className="mb-1 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{formatNumber(count)}</span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{help}</p>
      {form}
      <div className="relative mt-3 mb-2">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          data-zone={`${zone}.filtre`}
          value={filter}
          onChange={(e) => onFilter(e.target.value)}
          placeholder="Filtrer par nom…"
          spellCheck={false}
          className="h-8 w-full rounded-lg border border-border bg-card/60 pr-3 pl-8 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-[#d9a94e]/60"
        />
      </div>
      <div data-zone={`${zone}.liste`} className="min-h-24 flex-1 space-y-0.5 overflow-y-auto overscroll-contain">
        {children.length ? children : <p className="px-1.5 py-2 text-xs text-muted-foreground">{empty}</p>}
      </div>
    </section>
  );
}

/** Texte cherché dans un des noms (sans tenir compte des « _ » ni des majuscules). */
const matches = (needle: string, ...names: string[]) => !needle || names.some((n) => n.includes(needle));

export function RulesTab({ tags, rules }: { tags: ManagedTag[]; rules: RulesIndex }) {
  const byId = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const tagOf: TagOf = (id) => byId.get(id);
  const name = (id: number) => byId.get(id)?.name ?? "";
  const { resolve, dialog } = useTagResolver();
  const [aliasFilter, setAliasFilter] = useState("");
  const [parentFilter, setParentFilter] = useState("");
  const a = normalizeTag(aliasFilter);
  const p = normalizeTag(parentFilter);

  const aliases = rules.aliases
    .filter((r) => matches(a, r.alias, name(r.tagId)))
    .sort((x, y) => name(x.tagId).localeCompare(name(y.tagId)) || x.alias.localeCompare(y.alias));
  const parents = rules.parents
    .filter((r) => matches(p, name(r.childId), name(r.parentId)))
    .sort((x, y) => name(x.childId).localeCompare(name(y.childId)) || name(x.parentId).localeCompare(name(y.parentId)));

  const createAlias = async (alias: string, target: string) => {
    const tag = await resolve(target);
    return tag ? addAlias(alias, tag) : null;
  };
  // Pop-in « Créer un nouveau tag » ou confirmation annulée : les champs gardent leur texte (TAGM-16.2).
  const createParent = async (child: string, parent: string) => {
    const from = await resolve(child);
    if (!from) return false;
    const to = await resolve(parent);
    return to ? addParent(from, to) : false;
  };

  return (
    <div data-zone="regles" className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-4 lg:grid-cols-2 lg:grid-rows-1">
      <Panel
        zone="regles.synonymes"
        title="Synonymes"
        count={rules.aliases.length}
        help="Taper, importer ou chercher le synonyme donne le tag principal. Un tag existant devient synonyme par fusion ; décocher la défait."
        form={<RuleForm zone="regles.synonymes.ajout" placeholders={["Synonyme…", "Tag principal…"]} onAdd={createAlias} />}
        filter={aliasFilter}
        onFilter={setAliasFilter}
        empty={rules.aliases.length ? "Aucun synonyme ne correspond au filtre." : "Aucun synonyme pour le moment."}
      >
        {aliases.map((row) => (
          <AliasLine key={row.id} row={row} tagOf={tagOf} />
        ))}
      </Panel>
      <Panel
        zone="regles.parents"
        title="Tags parents"
        count={rules.parents.length}
        help="Poser l'enfant pose aussi le parent, en chaîne (chat → animal → être vivant). Éteindre une règle ne retire rien : les nouveaux ajouts ne posent simplement plus le parent."
        form={<RuleForm zone="regles.parents.ajout" placeholders={["Enfant…", "Parent…"]} onAdd={createParent} />}
        filter={parentFilter}
        onFilter={setParentFilter}
        empty={rules.parents.length ? "Aucune règle ne correspond au filtre." : "Aucune règle pour le moment."}
      >
        {parents.map((row) => (
          <ParentLine key={row.id} row={row} tagOf={tagOf} />
        ))}
      </Panel>
      {dialog}
    </div>
  );
}
