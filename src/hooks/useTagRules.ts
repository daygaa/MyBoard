// Groupes de synonymes et règles de parents (TAGM-15, TAGM-16, refonte TAGM-20), lus une fois et rangés par
// tag : colonnes du tableau du gestionnaire, page « Synonymes et parents », code de partage. Relus avec les
// tags (`refreshTags`).

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { rulesApi, type GroupRow, type ParentRow, type TagRules } from "@/lib/rulesApi";

export type RulesIndex = TagRules & {
  /** Groupe de chaque tag : son principal et ses noms reliés. */
  groupOf: Map<number, GroupRow>;
  /** Groupe de chaque nom fusionné (ce n'est plus un tag). */
  mergedNames: Map<string, GroupRow>;
  /** Règles dont le tag est l'enfant (ses parents). */
  parentsOf: Map<number, ParentRow[]>;
  /** Règles dont le tag est le parent (ses enfants). */
  childrenOf: Map<number, ParentRow[]>;
};

const EMPTY: TagRules = { groups: [], parents: [] };

function group<T>(items: T[], key: (item: T) => number): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

export function useTagRules(): RulesIndex {
  const { data = EMPTY } = useQuery({ queryKey: ["tag-rules"], queryFn: rulesApi.list });
  return useMemo(() => {
    const groupOf = new Map<number, GroupRow>();
    const mergedNames = new Map<string, GroupRow>();
    for (const g of data.groups) {
      groupOf.set(g.principalId, g);
      for (const n of g.names) {
        if (n.tagId !== null) groupOf.set(n.tagId, g);
        else mergedNames.set(n.name, g);
      }
    }
    return {
      ...data,
      groupOf,
      mergedNames,
      parentsOf: group(data.parents, (p) => p.childId),
      childrenOf: group(data.parents, (p) => p.parentId),
    };
  }, [data]);
}
