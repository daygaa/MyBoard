// Actions des synonymes (TAGM-15) et des règles de parents (TAGM-16), communes à la page
// « Synonymes et parents » et aux colonnes du tableau du gestionnaire : vérification par le cœur Rust,
// pop-in de confirmation quand des médias vont changer (Q5-A ; « Oui » rouge pour une fusion), puis
// relecture des tags et badge bref. Décocher n'a pas de confirmation : recocher le défait (GEN-21).
// Les refus (nom pris, boucle…) sont renvoyés à l'appelant, qui les affiche sous son champ.

import { create } from "zustand";

import { showGridBadge } from "@/stores/badge";
import { whileBusy } from "./busy";
import { formatNumber, plural } from "./format";
import { rulesApi, type AliasRow, type ParentRow } from "./rulesApi";
import { followRename, runTagAction as runAction } from "./tagManager";
import { displayTag, normalizeTag } from "./tags";

/** Pop-in de confirmation en attente ; `option` : case à cocher (cochée par défaut) passée à `run`. */
export type RuleAsk = {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  option?: string;
  run: (option: boolean) => Promise<unknown>;
};

export const useRuleAsk = create<{ ask: RuleAsk | null }>(() => ({ ask: null }));
const ask = (request: RuleAsk) => useRuleAsk.setState({ ask: request });

/** Nom d'un tag d'après son identifiant (liste du gestionnaire). */
export type NameOf = (id: number) => string;

/** Action sur des milliers de médias possible (une règle sur un tag très utilisé : quelques secondes) :
 *  curseur d'attente pendant ce temps (GEN-13). */
const runTagAction = <T>(label: string, call: () => Promise<T>) => runAction(label, () => whileBusy(call));

const q = (name: string) => `« ${displayTag(name)} »`;
const media = (n: number) => `${formatNumber(n)} ${plural(n, "média")}`;

// --- Synonymes

/** « alias → target » ; renvoie le refus à afficher, ou `null`. */
export async function addAlias(alias: string, target: { id: number; name: string }): Promise<string | null> {
  const check = await rulesApi.aliasCheck(alias, target.id).catch((e: unknown) => ({ error: String(e), tagMedia: null }));
  if (check.error) return check.error;
  const name = normalizeTag(alias);
  const run = async () => {
    const done = await runTagAction("Ajouter un synonyme", () => rulesApi.createAlias(alias, target.id));
    if (done === undefined) return;
    followRename(name, target.name);
    showGridBadge(`${q(name)} → ${q(target.name)}`);
  };
  if (check.tagMedia === null) await run();
  else
    ask({
      title: "Créer le synonyme ?",
      message: `${q(name)} est un tag posé sur ${media(check.tagMedia)} : ${check.tagMedia > 1 ? "ils passeront" : "il passera"} à ${q(target.name)}, et ${q(name)} deviendra un synonyme de ${q(target.name)}. Décocher le synonyme défera la fusion.`,
      confirmLabel: "Oui",
      danger: true,
      run,
    });
  return null;
}

/** Case d'un synonyme : décochée, la fusion est défaite ; recochée, le tag du même nom est refusionné. */
export async function toggleAlias(row: AliasRow, nameOf: NameOf) {
  const target = nameOf(row.tagId);
  if (row.enabled) {
    const done = await runTagAction("Désactiver le synonyme", () => rulesApi.setAliasEnabled(row.id, false));
    if (done !== undefined && row.media > 0) showGridBadge(`${q(row.alias)} remis sur ${media(row.media)}`);
    return;
  }
  const n = await rulesApi.aliasEnableCheck(row.id).catch(() => null);
  const run = async () => {
    const done = await runTagAction("Réactiver le synonyme", () => rulesApi.setAliasEnabled(row.id, true));
    if (done !== undefined) followRename(row.alias, target);
  };
  if (n === null) await run();
  else
    ask({
      title: "Réactiver le synonyme ?",
      message: `${q(row.alias)} est un tag posé sur ${media(n)} : ${n > 1 ? "ils passeront" : "il passera"} de nouveau à ${q(target)}.`,
      confirmLabel: "Oui",
      danger: true,
      run,
    });
}

/** Confirmation de la corbeille d'un synonyme (aussi utilisée par son menu du clic droit, CTX-02). */
export function aliasDeletion(row: AliasRow, nameOf: NameOf) {
  const undo = row.enabled && row.media > 0;
  return {
    title: `Supprimer le synonyme ${q(row.alias)} ?`,
    message: undo
      ? `La fusion sera défaite : ${q(row.alias)} redeviendra un tag à part, remis sur ${row.media > 1 ? "ses" : "son"} ${media(row.media)}.`
      : `Taper ${q(row.alias)} ne donnera plus ${q(nameOf(row.tagId))}.`,
    danger: true,
    run: () => runTagAction("Supprimer le synonyme", () => rulesApi.deleteAlias(row.id)),
  };
}

export function deleteAlias(row: AliasRow, nameOf: NameOf) {
  ask({ ...aliasDeletion(row, nameOf), confirmLabel: "Oui" });
}

// --- Règles de parents

/** « child → parent » ; renvoie le refus à afficher, ou `null`. */
export async function addParent(child: { id: number; name: string }, parent: { id: number; name: string }): Promise<string | null> {
  const check = await rulesApi.parentCheck(child.id, parent.id).catch((e: unknown) => ({ error: String(e), media: 0 }));
  if (check.error) return check.error;
  const run = async () => {
    const added = await runTagAction("Ajouter une règle de parent", () => rulesApi.createParent(child.id, parent.id));
    if (added) showGridBadge(`${q(parent.name)} ajouté à ${media(added)}`);
  };
  if (check.media === 0) await run();
  else ask({ title: "Ajouter la règle ?", message: `${q(parent.name)} sera ajouté à ${media(check.media)} qui ${check.media > 1 ? "ont" : "a"} ${q(child.name)}.`, confirmLabel: "Ajouter", run });
  return null;
}

const skippedOption = (n: number, child: string, when: string) => `Aussi sur ${n > 1 ? `les ${media(n)} qui ont` : "le média qui a"} reçu ${q(child)} ${when}`;

/** Case d'une règle : décochée, le parent est retiré des médias qui l'ont reçu par elle ; recochée, il
 *  leur est remis, et l'ajout est proposé aux médias qui ont reçu l'enfant entre-temps. */
export async function toggleParent(row: ParentRow, nameOf: NameOf) {
  const [child, parent] = [nameOf(row.childId), nameOf(row.parentId)];
  if (row.enabled) {
    const done = await runTagAction("Désactiver la règle", () => rulesApi.setParentEnabled(row.id, false, false));
    if (done !== undefined && row.media > 0) showGridBadge(`${q(parent)} retiré de ${media(row.media)}`);
    return;
  }
  const check = await rulesApi.parentEnableCheck(row.id).catch(() => ({ restore: 0, skipped: 0 }));
  const run = (addSkipped: boolean) => runTagAction("Réactiver la règle", () => rulesApi.setParentEnabled(row.id, true, addSkipped));
  if (check.restore === 0 && check.skipped === 0) return void (await run(false));
  ask({
    title: "Réactiver la règle ?",
    message: check.restore > 0 ? `${q(parent)} sera remis sur ${media(check.restore)}.` : `La règle s'appliquera de nouveau aux prochains ajouts de ${q(child)}.`,
    option: check.skipped > 0 ? skippedOption(check.skipped, child, "pendant que la règle était désactivée") : undefined,
    confirmLabel: "Réactiver",
    run,
  });
}

/** Interrupteur « Auto » ; rallumé, l'ajout est proposé aux médias qui ont reçu l'enfant entre-temps. */
export async function toggleAuto(row: ParentRow, nameOf: NameOf) {
  if (row.auto) return void (await runTagAction("Ajout automatique", () => rulesApi.setParentAuto(row.id, false, false)));
  const check = await rulesApi.parentEnableCheck(row.id).catch(() => ({ restore: 0, skipped: 0 }));
  const run = (addSkipped: boolean) => runTagAction("Ajout automatique", () => rulesApi.setParentAuto(row.id, true, addSkipped));
  if (check.skipped === 0) return void (await run(false));
  const [child, parent] = [nameOf(row.childId), nameOf(row.parentId)];
  ask({
    title: "Rallumer l'ajout automatique ?",
    message: `Chaque nouvel ajout de ${q(child)} posera de nouveau ${q(parent)}.`,
    option: skippedOption(check.skipped, child, "pendant qu'il était éteint"),
    confirmLabel: "Rallumer",
    run,
  });
}

/** Confirmation de la corbeille d'une règle (aussi utilisée par son menu du clic droit, CTX-02). */
export function parentDeletion(row: ParentRow, nameOf: NameOf) {
  const [child, parent] = [nameOf(row.childId), nameOf(row.parentId)];
  return {
    title: "Supprimer la règle ?",
    message:
      row.enabled && row.media > 0
        ? `${q(parent)} sera retiré ${row.media > 1 ? `des ${media(row.media)} qui l'ont reçu` : "du média qui l'a reçu"} par la règle ${q(child)} → ${q(parent)}.`
        : `La règle ${q(child)} → ${q(parent)} sera oubliée.`,
    danger: true,
    run: () => runTagAction("Supprimer la règle", () => rulesApi.deleteParent(row.id)),
  };
}

export function deleteParent(row: ParentRow, nameOf: NameOf) {
  ask({ ...parentDeletion(row, nameOf), confirmLabel: "Oui" });
}
