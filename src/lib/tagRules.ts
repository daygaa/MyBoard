// Actions des synonymes (TAGM-15) et des règles de parents (TAGM-16, refonte TAGM-20), communes à la page
// « Synonymes et parents » et aux colonnes du tableau du gestionnaire : vérification par le cœur Rust,
// pop-in de confirmation quand des médias vont changer (Q5-A ; « Oui » rouge pour une fusion), puis
// relecture des tags et badge bref. Décocher un synonyme ou éteindre une règle n'a pas de confirmation.
// Les refus (nom pris, boucle…) sont renvoyés à l'appelant, qui les affiche sous son champ. La suppression
// d'une règle a sa propre pop-in (ParentDeleteDialog).

import { create } from "zustand";

import { showGridBadge } from "@/stores/badge";
import { whileBusy } from "./busy";
import { formatNumber, plural } from "./format";
import { rulesApi, type AliasRow, type ParentRow } from "./rulesApi";
import { followRename, runTagAction as runAction } from "./tagManager";
import { displayTag, normalizeTag } from "./tags";

/** Pop-in de confirmation en attente ; `option` : case à cocher (cochée par défaut) passée à `run` ;
 *  `done` : réponse de l'utilisateur (confirmé ou annulé). */
export type RuleAsk = {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  option?: string;
  run: (option: boolean) => Promise<unknown>;
  done?: (confirmed: boolean) => void;
};

export const useRuleAsk = create<{ ask: RuleAsk | null }>(() => ({ ask: null }));
/** Ouvre la pop-in ; la promesse dit si elle a été confirmée. */
const ask = (request: RuleAsk) => new Promise<boolean>((done) => useRuleAsk.setState({ ask: { ...request, done } }));

/** Nom d'un tag d'après son identifiant (liste du gestionnaire). */
export type NameOf = (id: number) => string;

/** Action sur des milliers de médias possible (une règle sur un tag très utilisé : quelques secondes) :
 *  curseur d'attente pendant ce temps (GEN-13). */
const runTagAction = <T>(label: string, call: () => Promise<T>) => runAction(label, () => whileBusy(call));

/** Tag cité, jamais coupé en fin de ligne (retour T3, point TAGM-16.3) : espaces insécables autour et dedans,
 *  traits d'union insécables ; un tag plus long qu'une ligne se coupe quand même (`overflow-wrap`, dans la
 *  pop-in). `copyPlain` rend les caractères ordinaires à la copie. */
export const q = (name: string) => `« ${displayTag(name).replace(/ /g, " ").replace(/-/g, "‑")} »`;
/** « 3 médias », jamais coupé entre le nombre et le mot. */
export const media = (n: number) => `${formatNumber(n)} ${plural(n, "média")}`;

/** Copie d'un texte de pop-in : traits d'union et espaces ordinaires, pour coller un tag dans un champ. */
export function copyPlain(e: React.ClipboardEvent) {
  const text = window.getSelection()?.toString();
  if (!text) return;
  e.preventDefault();
  e.clipboardData.setData("text/plain", text.replace(/‑/g, "-").replace(/ /g, " "));
}

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

// --- Règles de parents (refonte, décisions D10 à D10.5)

/** « child → parent », allumée ; renvoie le refus à afficher, `null` si elle est créée, `false` si la pop-in
 *  est annulée (les champs gardent leur texte, retour T3, point TAGM-16.2). Des médias ont déjà l'enfant : une
 *  case, cochée, y pose aussi le parent (D10.1). */
export async function addParent(child: { id: number; name: string }, parent: { id: number; name: string }): Promise<string | null | false> {
  const check = await rulesApi.parentCheck(child.id, parent.id).catch((e: unknown) => ({ error: String(e), media: 0 }));
  if (check.error) return check.error;
  const run = async (apply: boolean) => {
    const added = await runTagAction("Ajouter une règle de parent", () => rulesApi.createParent(child.id, parent.id, apply));
    if (added) showGridBadge(`${q(parent.name)} ajouté à ${media(added)}`);
  };
  if (check.media === 0) {
    await run(false);
    return null;
  }
  const n = check.media;
  const confirmed = await ask({
    title: "Ajouter la règle ?",
    message: `${q(child.name)} → ${q(parent.name)} : chaque nouvel ajout de ${q(child.name)} posera ${q(parent.name)}.`,
    option: `Ajouter aussi ${q(parent.name)} ${n > 1 ? `aux ${media(n)} qui ont` : "au média qui a"} déjà ${q(child.name)}`,
    confirmLabel: "Ajouter",
    run,
  });
  return confirmed ? null : false;
}

/** Interrupteur d'une règle : éteinte, elle ne pose plus le parent aux nouveaux ajouts de l'enfant ; rien
 *  n'est retiré, et rien n'est rattrapé en la rallumant (D10, D10.2). */
export async function toggleParent(row: ParentRow, nameOf: NameOf) {
  const on = !row.enabled;
  const done = await runTagAction(on ? "Allumer la règle" : "Éteindre la règle", () => rulesApi.setParentEnabled(row.id, on));
  if (done !== undefined) showGridBadge(`${q(nameOf(row.childId))} → ${q(nameOf(row.parentId))} : ${on ? "allumée" : "éteinte"}`);
}

/** Suppression d'une règle (pop-in ParentDeleteDialog) ; `remove` : la case de retrait (D10.3). */
export async function deleteParent(row: ParentRow, nameOf: NameOf, remove: boolean, removed: number) {
  const done = await runTagAction("Supprimer la règle", () => rulesApi.deleteParent(row.id, remove));
  if (done === undefined) return;
  showGridBadge(remove && removed > 0 ? `${q(nameOf(row.parentId))} retiré de ${media(removed)}` : "Règle supprimée");
}
