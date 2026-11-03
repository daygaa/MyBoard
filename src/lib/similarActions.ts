// Actions de la pop-in « Tags proches » (TAGM-13 ; refonte, décisions D8 à D8.3 ; lot R6-2) : créer le groupe d'un
// bloc (ou y ajouter des tags, ou réunir des groupes), « Ignorer » un bloc, « Créer des synonymes pour tous ». Les
// tags décochés sont écartés (paires « pas synonymes », réponse 3 du lot R6) une fois le groupe créé.

import { showGridBadge } from "@/stores/badge";
import { api, type ManagedTag } from "./api";
import { formatNumber, plural } from "./format";
import { createGroup, mergeBlocks } from "./groupRules";
import { mergeRules } from "./mergeRules";
import { rulesApi } from "./rulesApi";
import { fullyMerged, mainGroup, type SimilarBlock } from "./similarTags";
import { ask, runTagAction } from "./tagRules";

/** Réglages d'un bloc dans la pop-in : tags décochés, tag principal choisi (bloc sans groupe), interrupteur
 *  « Fusionner » réglé à la main. */
export type BlockState = { off: number[]; chief?: number; merge?: boolean };

/** Ce que fera un bloc : le principal, les noms ajoutés (et ceux qui seront fusionnés, avec leurs médias), la fusion,
 *  les tags écartés et ceux qu'ils quittent, le libellé du bouton. */
export type BlockPlan = {
  principal: { id: number; name: string };
  names: string[];
  merged: { name: string; media: number }[];
  merge: boolean;
  apart: number[];
  kept: number[];
  label: string;
  ready: boolean;
};

const named = (t: ManagedTag) => ({ name: t.name, media: t.mediaCount });

export function planOf(block: SimilarBlock, state: BlockState, tagOf: (id: number) => ManagedTag | undefined): BlockPlan {
  const on = (t: ManagedTag) => !state.off.includes(t.id);
  const apart = (list: ManagedTag[]) => list.filter((t) => !on(t)).map((t) => t.id);
  const kept = block.tags.filter(on).map((t) => t.id);
  const group = mainGroup(block);
  if (!group) {
    // Aucun groupe : le principal choisi parmi les tags cochés (le plus utilisé d'office : ils sont triés ainsi).
    const checked = block.tags.filter(on);
    const chief = checked.find((t) => t.id === state.chief) ?? checked[0];
    const others = checked.filter((t) => t !== chief);
    return {
      principal: { id: chief?.id ?? 0, name: chief?.name ?? "" },
      names: others.map((t) => t.name),
      merged: others.map(named),
      merge: state.merge ?? false,
      apart: apart(block.tags),
      kept,
      label: checked.length > 2 ? "Créer des synonymes" : "Créer un synonyme",
      ready: checked.length >= 2,
    };
  }
  // Un groupe : les tags cochés le rejoignent ; plusieurs : les autres groupes sont réunis au plus grand (D14).
  const fresh = block.fresh.filter(on);
  const others = block.groups.filter((g) => g.id !== group.id);
  const joined = others.flatMap((g) => [{ name: g.principalName, media: tagOf(g.principalId)?.mediaCount ?? 0 }, ...g.names.map((n) => ({ name: n.name, media: n.media }))]);
  return {
    principal: { id: group.principalId, name: group.principalName },
    names: [...others.map((g) => g.principalName), ...fresh.map((t) => t.name)],
    merged: [...joined, ...fresh.map(named)],
    merge: state.merge ?? fullyMerged(group),
    apart: apart(block.fresh),
    kept,
    label: others.length > 0 ? "Réunir les groupes" : "Ajouter au groupe",
    ready: others.length > 0 || fresh.length > 0,
  };
}

const ignoreApart = (plan: BlockPlan) => (plan.apart.length > 0 ? api.ignoreSimilar(plan.apart, plan.kept) : undefined);

/** Bouton d'un bloc : l'aperçu du groupe, puis la création, avec la pop-in de fusion (médias, règles, « Étendre ») s'il
 *  le faut ; les tags décochés sont écartés une fois le groupe créé. */
export async function createBlock(plan: BlockPlan) {
  if (!plan.ready) return;
  const preview = await rulesApi.groupPreview(plan.principal.name, plan.names).catch(() => undefined);
  if (!preview) return;
  await createGroup({ id: plan.principal.id, name: preview.principal ?? plan.principal.name }, plan.names, plan.merge, preview, [], () => ignoreApart(plan));
}

/** « Ignorer » : toutes les paires du bloc (D8.3). */
export const ignoreBlock = (block: SimilarBlock) => runTagAction("Ignorer des tags proches", () => api.ignoreSimilar(block.tags.map((t) => t.id), []));

/** « Créer des synonymes pour tous » (réponse 6 du lot R6) : une confirmation (nombre de groupes, ceux qui sont
 *  fusionnés et leurs médias), les règles touchées et leurs cases « Étendre », puis tout en une fois. */
export async function createAll(plans: BlockPlan[]) {
  const ready = plans.filter((p) => p.ready);
  const n = ready.length;
  if (n === 0) return;
  const items = ready.map((p) => ({ principal: p.principal.id, names: p.names, merge: p.merge, apart: p.apart, kept: p.kept }));
  const rules = await mergeRules({ kind: "batch", items: items.map(({ principal, names, merge }) => ({ principal, names, merge })) });
  const fused = ready.filter((p) => p.merge);
  const message = fused.length
    ? [`Fusion pour ${formatNumber(fused.length)} d'entre eux.`, ...fused.map((p) => mergeBlocks(p.merged, p.principal.name)).filter(Boolean), "Désactiver la fusion l'annulera."].join("\n\n")
    : "Aucun n'est fusionné.";
  await ask({
    title: `Créer ${formatNumber(n)} ${plural(n, "groupe")} de synonymes ?`,
    message,
    rules,
    confirmLabel: "Créer",
    run: async (_, extend) => {
      const done = await runTagAction("Créer des synonymes pour tous", () => api.createSimilarGroups(items, extend));
      if (done !== undefined) showGridBadge(`${formatNumber(n)} ${plural(n, "groupe")} de synonymes ${n > 1 ? "créés" : "créé"}`);
    },
  });
}
