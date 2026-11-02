// Actions des groupes de synonymes (TAGM-15, refonte TAGM-20, D-047), communes à la page « Synonymes et
// parents » : création, interrupteurs de fusion (par nom et pour le groupe), changement de principal, retrait
// d'un nom, suppression du groupe. Pop-in de confirmation quand des médias ou des règles de parents vont changer
// (texte du point TAGM-15.7 du retour T3 ; règles : `mergeRules.ts`), puis relecture des tags et badge bref.
// Défaire une fusion n'a pas de confirmation : la refaire la rétablit (GEN-21).

import { showGridBadge } from "@/stores/badge";
import type { NewTag } from "./api";
import { plural } from "./format";
import { chosen, mergeRules, unmergedBadge } from "./mergeRules";
import { rulesApi, type GroupPreview, type GroupRow, type NameRow } from "./rulesApi";
import { ask, media, q, runTagAction } from "./tagRules";

/** Noms qui seront fusionnés : un bloc pour chacun de ceux qui ont des médias (retour T3, point TAGM-15.7), puis
 *  une ligne pour ceux qui n'en ont pas, fusionnés eux aussi (retouches de R3). */
export function mergeText(names: { name: string; media: number }[], principal: string): string {
  // Virgule après le nombre, singulier pour un seul média (retour T3, point TAGM-15.21).
  const blocks = names
    .filter((n) => n.media > 0)
    .map((n) => {
      const one = n.media === 1;
      return `${q(n.name)} est un tag posé sur ${media(n.media)}, ${one ? "ce média" : "ces médias"} :\n- ${one ? "obtiendra" : "obtiendront"} le tag ${q(principal)}\n- ${one ? "perdra" : "perdront"} le tag ${q(n.name)}`;
    });
  const empty = names
    .filter((n) => n.media === 0)
    .map((n) => `${q(n.name)} n'est lié à aucun média pour le moment mais sera tout de même fusionné avec ${q(principal)}.`);
  return [...blocks, ...(empty.length ? [empty.join("\n")] : []), "Désactiver la fusion l'annulera."].join("\n\n");
}

/** Le groupe obtenu, pour la pop-in d'une réunion de groupes (D14) : « P » (tag principal), « a » et « b ». */
function joinText(joined: string[], principal: string, preview: GroupPreview): string {
  const names = [...preview.existing, ...preview.added].map((n) => q(n.name));
  const groups = joined.map(q).join(", ");
  return `${joined.length > 1 ? `Les groupes de ${groups} seront réunis` : `Le groupe de ${groups} sera réuni`} à celui de ${q(principal)}.\nGroupe obtenu : ${q(principal)} (tag principal), ${names.join(", ")}.`;
}

/** Formulaire de création. `onCreated` est appelé dès que le groupe existe (les champs se vident alors,
 *  TAGM-15.6), avant la relecture des listes : sinon l'aperçu, relu avec les pastilles encore dans les champs,
 *  annonçait un instant « déjà des synonymes » (retour T3, point TAGM-15.25). `confirmJoin` : une réunion de groupes
 *  passe par la pop-in (colonne « Synonymes », sans ligne d'aperçu), avec la fusion s'il y en a une. Renvoie vrai si
 *  le groupe est créé, ou si la pop-in est confirmée (la création suit). */
export async function createGroup(principal: { id: number; name: string }, names: string[], merge: boolean, preview: GroupPreview | undefined, newTags: NewTag[], onCreated: () => void, confirmJoin = false) {
  // Le badge compte les noms vraiment ajoutés (un nom déjà dans le groupe est ignoré).
  const count = preview ? preview.added.length : names.length;
  const run = async (extend: number[]) => {
    const done = await runTagAction("Créer les synonymes", async () => {
      const id = await rulesApi.createGroup(principal.id, names, merge, newTags, extend);
      onCreated();
      return id;
    });
    if (done !== undefined) showGridBadge(`${q(principal.name)} : ${count} ${plural(count, "synonyme")}`);
    return done !== undefined;
  };
  const plan = merge && names.length > 0 ? await mergeRules({ kind: "create", principal: principal.id, names, newTags }) : undefined;
  // Des règles changent : la pop-in s'ouvre, même si aucun nom fusionné n'a de média.
  const merging = (merge ? (preview?.added ?? []) : []).some((n) => n.media > 0) || (plan?.rules.lines.length ?? 0) > 0;
  const joined = confirmJoin && preview ? preview.joined : [];
  if (!merging && joined.length === 0) return run(plan?.remembered ?? []);
  const message = [
    joined.length > 0 && preview ? joinText(joined, principal.name, preview) : "",
    merging && preview ? mergeText(preview.added, principal.name) : "",
  ].filter(Boolean).join("\n\n");
  const title = joined.length > 0 ? "Réunir les groupes ?" : count > 1 ? "Créer les synonymes ?" : "Créer le synonyme ?";
  return ask({ title, message, rules: plan?.rules, confirmLabel: joined.length > 0 ? "Réunir" : "Créer", run: (_, checked) => run(plan ? chosen(plan, checked) : []) });
}

/** Ajout d'un synonyme dans la colonne « Synonymes » du tableau des tags (réponse 3 A du lot R4) : `chief` est le
 *  principal du groupe du tag, ou le tag lui-même s'il n'a pas de groupe (il en devient le principal). Le nom ajouté
 *  est relié, ou fusionné d'office si tout le groupe l'est (D2.2) ; un tag d'un autre groupe réunit les deux (pop-in) ;
 *  un tag à créer (`id` vide) ne l'est qu'avec lui (TAGM-15.24). Renvoie le refus à afficher sous le champ, `null`
 *  si c'est fait (le champ se vide), `false` si une pop-in a été annulée (il garde son texte). */
export async function addSynonym(chief: { id: number; name: string }, picked: { id: number | null; name: string; alias?: string; category?: number }): Promise<string | null | false> {
  const name = picked.alias ?? picked.name;
  let preview: GroupPreview;
  try {
    preview = await rulesApi.groupPreview(chief.name, [name]);
  } catch (error) {
    return String(error);
  }
  const head = preview.principal ?? chief.name;
  if (name === chief.name || name === head) return `${q(name)} est le tag principal de ce groupe.`;
  if (preview.added.length === 0) return `${q(name)} est déjà un synonyme de ${q(head)}.`;
  const newTags = picked.id === null && picked.category !== undefined ? [{ name: picked.name, categoryId: picked.category }] : [];
  // Le champ se vide dès la confirmation, comme les formulaires de l'onglet (la pop-in rend sa réponse avant la fin).
  const done = await createGroup({ id: chief.id, name: head }, [name], preview.fullyMerged, preview, newTags, () => {}, true);
  return done ? null : false;
}

/** Interrupteur de fusion d'un nom. */
export async function toggleName(name: NameRow, principal: string) {
  if (name.merged) {
    const stayed = await runTagAction("Défusionner", () => rulesApi.setNameMerged(name.id, false));
    unmergedBadge(stayed, name.media > 0 ? `${q(name.name)} remis sur ${media(name.media)}` : `${q(name.name)} défusionné`);
    return;
  }
  const run = (extend: number[]) => runTagAction("Fusionner", () => rulesApi.setNameMerged(name.id, true, extend));
  const plan = await mergeRules({ kind: "name", id: name.id });
  if (name.media === 0 && plan.rules.lines.length === 0) return void (await run(plan.remembered));
  await ask({ title: `Fusionner ${q(name.name)} ?`, message: mergeText([name], principal), rules: plan.rules, confirmLabel: "Fusionner", run: (_, checked) => run(chosen(plan, checked)) });
}

/** État de l'interrupteur du groupe (D2.1) : tout fusionné, rien, ou « à moitié ». */
export function groupState(group: GroupRow): boolean | "mixed" {
  const merged = group.names.filter((n) => n.merged).length;
  return merged === 0 ? false : merged === group.names.length ? true : "mixed";
}

/** Défait toutes les fusions du groupe. */
export const unmergeGroup = async (group: GroupRow) => unmergedBadge(await runTagAction("Tout défusionner", () => rulesApi.setGroupMerged(group.id, false)));

/** Interrupteur du groupe : tout fusionné → tout défaire ; sinon (rien, ou « à moitié ») → tout fusionner. */
export async function toggleGroup(group: GroupRow, principal: string) {
  if (groupState(group) === true) return void (await unmergeGroup(group));
  const run = (extend: number[]) => runTagAction("Tout fusionner", () => rulesApi.setGroupMerged(group.id, true, extend));
  const merging = group.names.filter((n) => !n.merged);
  const plan = await mergeRules({ kind: "group", id: group.id });
  if (!merging.some((n) => n.media > 0) && plan.rules.lines.length === 0) return void (await run(plan.remembered));
  await ask({ title: "Fusionner tout le groupe ?", message: mergeText(merging, principal), rules: plan.rules, confirmLabel: "Fusionner", run: (_, checked) => run(chosen(plan, checked)) });
}

/** Retirer un nom (texte de l'utilisateur, refonte D2) ; aussi pour le menu du clic droit (CTX-02). */
export function nameRemoval(name: NameRow, principal: string) {
  const back = name.merged && name.media > 0 ? `\nLa fusion sera annulée : les médias récupéreront ${q(name.name)}.` : "";
  return {
    title: "Retirer du groupe ?",
    message: `Voulez-vous supprimer ${q(name.name)} du groupe de synonymes de ${q(principal)} ?${back}`,
    danger: true,
    run: async () => unmergedBadge(await runTagAction("Retirer du groupe", () => rulesApi.removeGroupName(name.id))),
  };
}

export function groupDeletion(group: GroupRow, principal: string) {
  return {
    title: "Supprimer le groupe ?",
    message: `Le groupe de synonymes appartenant à ${q(principal)} sera supprimé : les fusions seront désactivées et les médias retrouveront les tags originels.`,
    danger: true,
    run: async () => unmergedBadge(await runTagAction("Supprimer le groupe", () => rulesApi.deleteGroup(group.id))),
  };
}

/** Changer de principal (D3, D3.1) : les fusions sont refaites vers lui ; la pop-in liste les règles réécrites
 *  (réponse 5b du lot R5). */
export async function makePrincipal(group: GroupRow, name: NameRow, principal: string) {
  const n = await rulesApi.principalCheck(group.id, name.id).catch(() => 0);
  const { rules } = await mergeRules({ kind: "principal", group: group.id, name: name.id }, false);
  await ask({
    title: "Changer de tag principal ?",
    lead: `${q(name.name)} devient le tag principal`,
    message:
      n > 0
        ? `${media(n)} ${n > 1 ? "passeront" : "passera"} de ${q(principal)} à ${q(name.name)}. Défaire une fusion rendra toujours à chaque média ses tags d'origine.`
        : "Aucun média ne change.",
    rules,
    confirmLabel: "Changer",
    run: () => runTagAction("Changer de tag principal", () => rulesApi.setGroupPrincipal(group.id, name.id)),
  });
}
