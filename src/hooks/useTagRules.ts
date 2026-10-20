// Synonymes et règles de parents (TAGM-15, TAGM-16), lus une fois et rangés par tag : colonnes du
// tableau du gestionnaire, page « Synonymes et parents », code de partage. Relus avec les tags
// (`refreshTags`).

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { rulesApi, type AliasRow, type ParentRow, type TagRules } from "@/lib/rulesApi";

export type RulesIndex = TagRules & {
  /** Synonymes de chaque tag principal. */
  aliasesOf: Map<number, AliasRow[]>;
  /** Règles dont le tag est l'enfant (ses parents). */
  parentsOf: Map<number, ParentRow[]>;
  /** Règles dont le tag est le parent (ses enfants). */
  childrenOf: Map<number, ParentRow[]>;
};

const EMPTY: TagRules = { aliases: [], parents: [] };

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
  return useMemo(
    () => ({
      ...data,
      aliasesOf: group(data.aliases, (a) => a.tagId),
      parentsOf: group(data.parents, (p) => p.childId),
      childrenOf: group(data.parents, (p) => p.parentId),
    }),
    [data],
  );
}
