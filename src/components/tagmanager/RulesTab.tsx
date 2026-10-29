// Onglet « Synonymes et parents » du gestionnaire de tags (TAGM-15, TAGM-16, refonte TAGM-20) : tout en un
// seul endroit, en deux colonnes côte à côte. Synonymes : le formulaire de création (GroupForm), un filtre
// par nom, puis les groupes (GroupLine) ; parents : deux champs, un filtre, les règles (interrupteur, D10 ;
// corbeille). La page ne défile pas : les tableaux s'arrêtent au bas de la fenêtre et chaque liste a sa
// barre de défilement (demande du 26/10), qui garde la molette (GEN-24).

import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { create } from "zustand";

import type { RulesIndex } from "@/hooks/useTagRules";
import type { ManagedTag } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { addParent } from "@/lib/tagRules";
import { normalizeTag } from "@/lib/tags";
import { GroupForm } from "./GroupForm";
import { GroupLine } from "./GroupLine";
import { RuleForm, useTagResolver } from "./RuleForm";
import { ParentLine, type TagOf } from "./RuleLines";

/** Filtre des synonymes, réglable d'ailleurs (lien « Gérer dans « Synonymes et parents » » du tableau). */
export const useGroupFilter = create<{ text: string }>(() => ({ text: "" }));

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
    // Côte à côte, les deux tableaux partagent les rangées de la grille (titre, texte, formulaire, filtre, liste) :
    // chaque rangée prend la hauteur de la plus haute, les barres « Filtrer par nom » restent alignées (TAGM-15.5).
    <section data-zone={zone} className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border bg-card/40 p-3 lg:row-span-5 lg:grid lg:grid-cols-[minmax(0,1fr)] lg:grid-rows-subgrid">

      <div className="mb-1 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{formatNumber(count)}</span>
      </div>
      <p className="mb-3 text-xs whitespace-pre-line text-muted-foreground">{help}</p>
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
  const groupFilter = useGroupFilter((s) => s.text);
  const [parentFilter, setParentFilter] = useState("");
  const g = normalizeTag(groupFilter);
  const p = normalizeTag(parentFilter);

  // Un groupe passe le filtre si un de ses noms (principal, relié ou fusionné) le contient.
  const groups = rules.groups
    .filter((r) => matches(g, name(r.principalId), ...r.names.map((n) => n.name)))
    .sort((x, y) => name(x.principalId).localeCompare(name(y.principalId)));
  const parents = rules.parents
    .filter((r) => matches(p, name(r.childId), name(r.parentId)))
    .sort((x, y) => name(x.childId).localeCompare(name(y.childId)) || name(x.parentId).localeCompare(name(y.parentId)));

  // Pop-in « Créer un nouveau tag » ou confirmation annulée : les champs gardent leur texte (TAGM-16.2).
  const createParent = async (child: string, parent: string) => {
    const from = await resolve(child);
    if (!from) return false;
    const to = await resolve(parent);
    return to ? addParent(from, to) : false;
  };

  return (
    <div data-zone="regles" className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-4 lg:grid-cols-2 lg:grid-rows-[auto_auto_auto_auto_minmax(0,1fr)] lg:gap-y-0">
      <Panel
        zone="regles.synonymes"
        title="Synonymes"
        count={rules.groups.length}
        help={"Rechercher un tag affichera tous les médias portant ce tag ainsi que ceux portant son/ses synonymes.\nLa fusion permet de rassembler tous les synonymes d'un groupe sous un seul tag principal et peut être désactivée à tout moment."}
        form={<GroupForm tags={tags} tagOf={tagOf} />}
        filter={groupFilter}
        onFilter={(text) => useGroupFilter.setState({ text })}
        empty={rules.groups.length ? "Aucun groupe ne correspond au filtre." : "Aucun synonyme pour le moment."}
      >
        {groups.map((row) => (
          <GroupLine key={row.id} group={row} tagOf={tagOf} />
        ))}
      </Panel>
      <Panel
        zone="regles.parents"
        title="Tags parents"
        count={rules.parents.length}
        help="Quand un tag enfant est ajouté à un média il est automatiquement accompagné de son tag parent ; peut fonctionner en chaîne (A → B puis B → C...). Désactiver une règle ne retire aucun tag, cela met seulement en pause l'ajout automatique des parents."
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
