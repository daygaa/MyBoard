// Ce que contient un code de partage (pop-in d'export, retour T3, points TAGM-18.2 et TAGM-18.8 ; réponses des 03 et
// 04/11). Les tags : la sélection ; plus, avec « Exporter les groupes complets », tous les tags des groupes de
// synonymes des tags sélectionnés ; plus, avec « Exporter toute la chaîne d'un tag », tous les tags des chaînes de
// parents qui passent par un tag sélectionné, dans les deux sens (ses parents en chaîne et ses enfants en chaîne).
// Puis « Recréer les synonymes » : un groupe part s'il a au moins 2 tags dans le code (X = Y = Z avec seulement X :
// rien) ; « Recréer les règles de parents » : une règle part si son enfant et son parent sont dans le code. Un lien
// vers un tag absent du code n'est jamais recréé (réponse 3 du 04/11). Sans « Inclure les tags masqués » (TAGM-21,
// décochée d'office, réponse Q4 A du 12/11) : aucun tag masqué dans le code, même sélectionné ou amené par un groupe ou
// une chaîne (les chaînes partent des seuls tags non masqués de la sélection).

import type { RulesIndex } from "@/hooks/useTagRules";
import type { ManagedTag } from "./api";
import type { SharedGroup, SharedRule } from "./rulesApi";

export type ExportOptions = { hidden: boolean; groups: boolean; fullGroups: boolean; parents: boolean; wholeChains: boolean };

/** Les tags qui peuvent partir : sans la case « Inclure les tags masqués », les masqués sont écartés (TAGM-21). */
export const exportable = (tags: ManagedTag[], hidden: boolean) => (hidden ? tags : tags.filter((t) => !t.hidden));
export type ExportSelection = { tags: ManagedTag[]; groups: SharedGroup[]; parents: SharedRule[] };

/** Tags reliés à `start` de proche en proche par `next` (sans `start` lui-même s'il n'y revient pas). */
function reach(start: number[], next: (id: number) => number[]): Set<number> {
  const seen = new Set<number>();
  const stack = [...start];
  while (stack.length) {
    for (const id of next(stack.pop() as number)) {
      if (!seen.has(id)) {
        seen.add(id);
        stack.push(id);
      }
    }
  }
  return seen;
}

export function exportSelection(selected: ManagedTag[], tagOf: (id: number) => ManagedTag | undefined, rules: RulesIndex, options: ExportOptions): ExportSelection {
  const fullGroups = options.groups && options.fullGroups;
  const wholeChains = options.parents && options.wholeChains;
  const ids = new Set(exportable(selected, options.hidden).map((t) => t.id));
  const start = [...ids];
  if (fullGroups) {
    for (const id of start) {
      const g = rules.groupOf.get(id);
      if (!g) continue;
      ids.add(g.principalId);
      for (const n of g.names) ids.add(n.tagId);
    }
  }
  if (wholeChains) {
    // Vers le haut (les parents en chaîne) et vers le bas (les enfants en chaîne), séparément : une chaîne passe
    // par le tag sélectionné.
    const up = reach(start, (id) => (rules.parentsOf.get(id) ?? []).map((r) => r.parentId));
    const down = reach(start, (id) => (rules.childrenOf.get(id) ?? []).map((r) => r.childId));
    for (const id of [...up, ...down]) ids.add(id);
  }
  if (!options.hidden) for (const id of ids) if (tagOf(id)?.hidden) ids.delete(id);
  const tags = [...ids].map(tagOf).filter((t): t is ManagedTag => t !== undefined);
  const name = (id: number) => tagOf(id)?.name;
  const groups: SharedGroup[] = [];
  if (options.groups) {
    for (const g of rules.groups) {
      const names = g.names.filter((n) => ids.has(n.tagId));
      if (ids.has(g.principalId)) {
        if (names.length > 0) groups.push({ principal: g.principalName, names: names.map((n) => ({ name: n.name, merged: n.merged })) });
        continue;
      }
      if (names.length < 2) continue;
      // Sans son tag principal : le plus utilisé des tags exportés le devient, sans fusion (une fusion dit « fusionné
      // dans ce principal » ; réponse 1 du 04/11).
      const ranked = names.map((n) => ({ name: n.name, media: tagOf(n.tagId)?.mediaCount ?? 0 })).sort((a, b) => b.media - a.media || a.name.localeCompare(b.name));
      groups.push({ principal: ranked[0].name, names: ranked.slice(1).map((n) => ({ name: n.name, merged: false })) });
    }
  }
  const parents: SharedRule[] = options.parents
    ? rules.parents.filter((r) => ids.has(r.childId) && ids.has(r.parentId)).map((r) => ({ child: name(r.childId) ?? r.childName, parent: name(r.parentId) ?? r.parentName, enabled: r.enabled }))
    : [];
  return { tags, groups, parents };
}
