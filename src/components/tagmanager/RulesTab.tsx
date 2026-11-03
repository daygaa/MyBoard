// Onglet « Synonymes et parents » du gestionnaire de tags (TAGM-15, TAGM-16, refonte TAGM-20) : tout en un
// seul endroit, en deux colonnes côte à côte. Synonymes : le formulaire de création (GroupForm), un filtre
// par nom, puis les groupes (GroupLine) ; parents : deux champs, un filtre, les règles (interrupteur, D10 ;
// corbeille). Chaque liste a sa ligne de titres triables (RulesTitles.tsx, retour T3, point TAGM-15.10). La page
// ne défile pas : les tableaux s'arrêtent au bas de la fenêtre et chaque liste a sa barre de défilement (demande du
// 26/10), qui garde la molette (GEN-24).

import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Search } from "lucide-react";

import type { RulesIndex } from "@/hooks/useTagRules";
import type { ManagedTag } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { addParent } from "@/lib/tagRules";
import { normalizeTag } from "@/lib/tags";
import { GroupForm } from "./GroupForm";
import { GroupLine } from "./GroupLine";
import { RuleForm } from "./RuleForm";
import { ParentLine, type TagOf } from "./RuleLines";
import { useGroupOrder, useParentOrder } from "./rulesSort";
import { RulesTabProvider, useRulesEntry, useRulesStore, useRulesTab } from "./rulesTabState";
import { GroupTitles, ParentTitles } from "./RulesTitles";

/** `titles` : ligne de titres en haut de la liste ; `sorted` : son tri (un nouveau tri repart du haut de la liste,
 *  comme le tableau des tags, retour T3, point TAGM-04.13). */
function Panel({ zone, title, count, help, form, filter, onFilter, titles, sorted, children, empty }: {
  zone: string;
  title: string;
  count: number;
  help: string;
  form: ReactNode;
  filter: string;
  onFilter: (text: string) => void;
  titles: ReactNode;
  sorted: string;
  children: ReactNode[];
  empty: string;
}) {
  // Retour arrière / avant : la liste reprend où elle en était (point TAGM-15.20).
  const store = useRulesStore();
  const listRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (listRef.current) listRef.current.scrollTop = store.getState().scroll[zone] ?? 0;
  }, [store, zone]);
  const lastSort = useRef(sorted);
  useEffect(() => {
    if (lastSort.current === sorted) return;
    lastSort.current = sorted;
    listRef.current?.scrollTo({ top: 0 });
  }, [sorted]);
  return (
    // Côte à côte, les deux tableaux partagent seulement les rangées du titre et du texte d'explication : les
    // formulaires commencent à la même hauteur ; le reste de chaque tableau est indépendant (un champ qui grandit
    // ne fait pas descendre l'autre tableau, retouches de R3, 29/10).
    <section data-zone={zone} className="flex min-h-0 min-w-0 flex-col rounded-xl border border-border bg-card/40 p-3 lg:row-span-3 lg:grid lg:grid-cols-[minmax(0,1fr)] lg:grid-rows-subgrid">
      <div className="mb-1 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">{formatNumber(count)}</span>
      </div>
      <p className="mb-3 text-xs whitespace-pre-line text-muted-foreground">{help}</p>
      <div className="flex min-h-0 flex-1 flex-col">
        {form}
        <div className="relative mt-3 mb-2">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            data-zone={`${zone}.filtre`}
            value={filter}
            onChange={(e) => onFilter(e.target.value)}
            placeholder="Chercher un tag…"
            spellCheck={false}
            className="h-8 w-full rounded-lg border border-border bg-card/60 pr-3 pl-8 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-[#d9a94e]/60"
          />
        </div>
        <div
          ref={listRef}
          data-zone={`${zone}.liste`}
          onScroll={(e) => {
            const top = e.currentTarget.scrollTop;
            store.setState((s) => ({ scroll: { ...s.scroll, [zone]: top } }));
          }}
          className="min-h-24 flex-1 space-y-0.5 overflow-y-auto overscroll-contain"
        >
          {titles}
          {children.length ? children : <p className="px-1.5 py-2 text-xs text-muted-foreground">{empty}</p>}
        </div>
      </div>
    </section>
  );
}

/** Place de chaque identifiant dans l'ordre. */
const rankOf = (order: number[]) => new Map(order.map((id, i) => [id, i]));

/** Texte cherché dans un des noms (sans tenir compte des « _ » ni des majuscules). */
const matches = (needle: string, ...names: string[]) => !needle || names.some((n) => n.includes(needle));

type Props = { tags: ManagedTag[]; rules: RulesIndex };

/** L'onglet, avec l'état de sa page d'historique (rulesTabState.ts) : un retour arrière / avant vers une autre
 *  page de l'onglet le recrée avec l'état de celle-ci. */
export function RulesTab(props: Props) {
  const { key, store } = useRulesEntry();
  return (
    <RulesTabProvider value={store}>
      <RulesTabPage key={key} {...props} />
    </RulesTabProvider>
  );
}

function RulesTabPage({ tags, rules }: Props) {
  const store = useRulesStore();
  const byId = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const tagOf: TagOf = (id) => byId.get(id);
  const name = (id: number) => byId.get(id)?.name ?? "";
  const groupFilter = useRulesTab((s) => s.groupFilter);
  const parentFilter = useRulesTab((s) => s.parentFilter);
  const g = normalizeTag(groupFilter);
  const p = normalizeTag(parentFilter);

  // Ordre des listes figé pour cette page de l'onglet : changer de principal ou basculer un interrupteur ne déplace
  // pas la ligne (point TAGM-15.19) ; un nouvel élément prend sa place dans le tri (rulesSort.ts).
  const groupRank = rankOf(useGroupOrder(rules.groups));
  const parentRank = rankOf(useParentOrder(rules.parents, name));
  const groupSort = useRulesTab((s) => s.groupSort);
  const parentSort = useRulesTab((s) => s.parentSort);
  // Un groupe passe le filtre si un de ses noms (principal, relié ou fusionné) le contient.
  const groups = rules.groups
    .filter((r) => matches(g, r.principalName, ...r.names.map((n) => n.name)))
    .sort((x, y) => (groupRank.get(x.id) ?? 0) - (groupRank.get(y.id) ?? 0));
  const parents = rules.parents
    .filter((r) => matches(p, name(r.childId), name(r.parentId)))
    .sort((x, y) => (parentRank.get(x.id) ?? 0) - (parentRank.get(y.id) ?? 0));

  return (
    <div data-zone="regles" className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-4 lg:grid-cols-2 lg:grid-rows-[auto_auto_minmax(0,1fr)] lg:gap-y-0">
      <Panel
        zone="regles.synonymes"
        title="Synonymes"
        count={rules.groups.length}
        help={"Rechercher un tag affichera tous les médias portant ce tag ainsi que ceux portant son/ses synonymes.\nLa fusion permet de rassembler tous les synonymes d'un groupe sous un seul tag principal et peut être désactivée à tout moment."}
        form={<GroupForm tags={tags} tagOf={tagOf} />}
        filter={groupFilter}
        onFilter={(text) => store.setState({ groupFilter: text })}
        titles={<GroupTitles />}
        sorted={`${groupSort.key}${groupSort.desc}`}
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
        form={
          <RuleForm
            zone="regles.parents.ajout"
            placeholders={["Enfant", "Parent"]}
            onAdd={addParent}
            tags={tags}
            tagOf={tagOf}
            saved={store.getState().parentDocs}
            onDocs={(parentDocs) => store.setState({ parentDocs })}
          />
        }
        filter={parentFilter}
        onFilter={(text) => store.setState({ parentFilter: text })}
        titles={<ParentTitles />}
        sorted={`${parentSort.key}${parentSort.desc}`}
        empty={rules.parents.length ? "Aucune règle ne correspond au filtre." : "Aucune règle pour le moment."}
      >
        {parents.map((row) => (
          <ParentLine key={row.id} row={row} tagOf={tagOf} column />
        ))}
      </Panel>
    </div>
  );
}
