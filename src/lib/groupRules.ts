// Actions des groupes de synonymes (TAGM-15, refonte TAGM-20, D-047), communes à la page « Synonymes et
// parents » : création, interrupteurs de fusion (par nom et pour le groupe), changement de principal, retrait
// d'un nom, suppression du groupe. Pop-in de confirmation quand des médias vont changer (texte du point
// TAGM-15.7 du retour T3), puis relecture des tags et badge bref. Défaire une fusion n'a pas de confirmation :
// la refaire la rétablit (GEN-21).

import { showGridBadge } from "@/stores/badge";
import { plural } from "./format";
import { rulesApi, type GroupPreview, type GroupRow, type NameRow } from "./rulesApi";
import { ask, media, q, runTagAction } from "./tagRules";

/** Noms qui seront fusionnés et qui ont des médias : un bloc chacun (retour T3, point TAGM-15.7). */
export function mergeText(names: { name: string; media: number }[], principal: string): string {
  const blocks = names
    .filter((n) => n.media > 0)
    .map((n) => `${q(n.name)} est un tag posé sur ${media(n.media)} : ces médias :\n- obtiendront le tag ${q(principal)}\n- perdront le tag ${q(n.name)}`);
  return `${blocks.join("\n\n")}\n\nÉteindre la fusion l'annulera.`;
}

/** Formulaire de création ; renvoie vrai si c'est fait (les champs se vident alors, TAGM-15.6). */
export async function createGroup(principal: { id: number; name: string }, names: string[], merge: boolean, preview: GroupPreview | undefined): Promise<boolean> {
  const run = async () => {
    const done = await runTagAction("Créer les synonymes", () => rulesApi.createGroup(principal.id, names, merge));
    if (done !== undefined) showGridBadge(`${q(principal.name)} : ${names.length} ${plural(names.length, "synonyme")}`);
  };
  const moving = merge ? (preview?.added ?? []).filter((n) => n.media > 0) : [];
  if (moving.length === 0) {
    await run();
    return true;
  }
  return ask({ title: moving.length > 1 ? "Créer les synonymes ?" : "Créer le synonyme ?", message: mergeText(moving, principal.name), confirmLabel: "Créer", run });
}

/** Interrupteur de fusion d'un nom. */
export async function toggleName(name: NameRow, principal: string) {
  if (name.merged) {
    const done = await runTagAction("Défusionner", () => rulesApi.setNameMerged(name.id, false));
    if (done !== undefined) showGridBadge(name.media > 0 ? `${q(name.name)} remis sur ${media(name.media)}` : `${q(name.name)} défusionné`);
    return;
  }
  const run = () => runTagAction("Fusionner", () => rulesApi.setNameMerged(name.id, true));
  if (name.media === 0) return void (await run());
  await ask({ title: `Fusionner ${q(name.name)} ?`, message: mergeText([name], principal), confirmLabel: "Fusionner", run });
}

/** État de l'interrupteur du groupe (D2.1) : tout fusionné, rien, ou « à moitié ». */
export function groupState(group: GroupRow): boolean | "mixed" {
  const merged = group.names.filter((n) => n.merged).length;
  return merged === 0 ? false : merged === group.names.length ? true : "mixed";
}

/** Défait toutes les fusions du groupe. */
export const unmergeGroup = (group: GroupRow) => runTagAction("Tout défusionner", () => rulesApi.setGroupMerged(group.id, false));

/** Interrupteur du groupe : tout fusionné → tout défaire ; sinon (rien, ou « à moitié ») → tout fusionner. */
export async function toggleGroup(group: GroupRow, principal: string) {
  if (groupState(group) === true) return void (await unmergeGroup(group));
  const run = () => runTagAction("Tout fusionner", () => rulesApi.setGroupMerged(group.id, true));
  const moving = group.names.filter((n) => !n.merged && n.media > 0);
  if (moving.length === 0) return void (await run());
  await ask({ title: "Fusionner tout le groupe ?", message: mergeText(moving, principal), confirmLabel: "Fusionner", run });
}

/** Retirer un nom (texte de l'utilisateur, refonte D2) ; aussi pour le menu du clic droit (CTX-02). */
export function nameRemoval(name: NameRow, principal: string) {
  const back = name.merged && name.media > 0 ? `\nLa fusion sera annulée : les médias récupéreront ${q(name.name)}.` : "";
  return {
    title: "Retirer du groupe ?",
    message: `Voulez-vous supprimer ${q(name.name)} du groupe de synonymes de ${q(principal)} ?${back}`,
    danger: true,
    run: () => runTagAction("Retirer du groupe", () => rulesApi.removeGroupName(name.id)),
  };
}

export function groupDeletion(group: GroupRow, principal: string) {
  return {
    title: "Supprimer le groupe ?",
    message: `Le groupe de ${q(principal)} sera supprimé : les fusions seront défaites et les noms ne seront plus reliés ; les tags restent.`,
    danger: true,
    run: () => runTagAction("Supprimer le groupe", () => rulesApi.deleteGroup(group.id)),
  };
}

/** Changer de principal (D3, D3.1) : les fusions sont refaites vers lui. */
export async function makePrincipal(group: GroupRow, name: NameRow, principal: string) {
  const n = await rulesApi.principalCheck(group.id, name.id).catch(() => 0);
  await ask({
    title: "Changer de tag principal ?",
    lead: `${q(name.name)} devient le tag principal`,
    message:
      n > 0
        ? `${media(n)} ${n > 1 ? "passeront" : "passera"} de ${q(principal)} à ${q(name.name)}. Défaire une fusion rendra toujours à chaque média ses tags d'origine.`
        : "Aucun média ne change.",
    confirmLabel: "Changer",
    run: () => runTagAction("Changer de tag principal", () => rulesApi.setGroupPrincipal(group.id, name.id)),
  });
}
