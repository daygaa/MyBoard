// Actions des règles de parents (TAGM-16, refonte TAGM-20), communes à la page « Synonymes et parents » et
// aux colonnes du tableau du gestionnaire : vérification par le cœur Rust, pop-in de confirmation quand des
// médias vont changer (Q5-A), puis relecture des tags et badge bref. Éteindre une règle n'a pas de
// confirmation. Les refus (boucle…) sont renvoyés à l'appelant, qui les affiche sous son champ. La suppression
// d'une règle a sa propre pop-in (ParentDeleteDialog). La pop-in commune (`ask`) sert aussi aux groupes de
// synonymes (groupRules.ts).

import { create } from "zustand";

import { showGridBadge } from "@/stores/badge";
import { whileBusy } from "./busy";
import { formatNumber, plural } from "./format";
import { rulesApi, type ParentRow } from "./rulesApi";
import { runTagAction as runAction } from "./tagManager";
import { displayTag } from "./tags";

/** Pop-in de confirmation en attente ; `lead` : première ligne mise en avant ; `option` : case à cocher (cochée
 *  par défaut) passée à `run` ; `rules` : lignes « Règles de parents » sous un trait (fusion, lot R5) ; `done` :
 *  réponse de l'utilisateur (confirmé ou annulé). */
export type RuleAsk = {
  title: string;
  lead?: string;
  message: string;
  rules?: { lines: string[]; end?: string };
  confirmLabel: string;
  danger?: boolean;
  option?: string;
  run: (option: boolean) => Promise<unknown>;
  done?: (confirmed: boolean) => void;
};

export const useRuleAsk = create<{ ask: RuleAsk | null }>(() => ({ ask: null }));
/** Ouvre la pop-in ; la promesse dit si elle a été confirmée. */
export const ask = (request: RuleAsk) => new Promise<boolean>((done) => useRuleAsk.setState({ ask: { ...request, done } }));

/** Nom d'un tag d'après son identifiant (liste du gestionnaire). */
export type NameOf = (id: number) => string;

/** Action sur des milliers de médias possible (une règle sur un tag très utilisé : quelques secondes) :
 *  curseur d'attente pendant ce temps (GEN-13). */
export const runTagAction = <T>(label: string, call: () => Promise<T>) => runAction(label, () => whileBusy(call));

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

// --- Règles de parents (refonte, décisions D10 à D10.5)

/** « child → parent », allumée ; renvoie le refus à afficher, `null` si elle est créée, `false` si la pop-in
 *  est annulée (les champs gardent leur texte, retour T3, point TAGM-16.2). Des médias ont déjà l'enfant : une
 *  case, cochée, y pose aussi le parent (D10.1). */
export async function addParent(child: { id: number; name: string; alias?: string }, parent: { id: number | null; name: string; category?: number }): Promise<string | null | false> {
  // Parent pas encore créé (`id` vide) : il l'est avec la règle, à la confirmation (retour T3, point TAGM-15.24).
  const fresh = parent.id === null ? { name: parent.name, categoryId: parent.category ?? null } : undefined;
  const check = await rulesApi.parentCheck(child.id, parent.id).catch((e: unknown) => ({ error: String(e), media: 0 }));
  if (check.error) return check.error;
  const run = async (apply: boolean) => {
    const added = await runTagAction("Ajouter une règle de parent", () => rulesApi.createParent(child.id, parent.id, apply, fresh));
    if (added) showGridBadge(`${q(parent.name)} ajouté à ${media(added)}`);
  };
  // Enfant tapé avec un nom fusionné : la règle va sur le principal, la pop-in le dit, même sans média (Q.4).
  if (check.media === 0 && !child.alias) {
    await run(false);
    return null;
  }
  const n = check.media;
  const merged = child.alias ? `${q(child.alias)} est fusionné dans ${q(child.name)} : la règle est créée pour ${q(child.name)}.\n\n` : "";
  // Textes demandés le 28/10 (retour T3, point TAGM-16.1).
  const confirmed = await ask({
    title: "Créer la règle ?",
    lead: `${q(child.name)} → ${q(parent.name)}`,
    message: `${merged}À chaque ajout de ${q(child.name)} à un média, ${q(parent.name)} lui sera aussi ajouté automatiquement.`,
    option: n > 0 ? `Ajouter ${q(parent.name)} ${n > 1 ? `aux ${media(n)} ayant` : "au média ayant"} déjà ${q(child.name)}` : undefined,
    confirmLabel: "Créer",
    run,
  });
  return confirmed ? null : false;
}

/** Interrupteur d'une règle : éteinte, elle ne pose plus le parent aux nouveaux ajouts de l'enfant ; rien
 *  n'est retiré, et rien n'est rattrapé en la rallumant (D10, D10.2). */
export async function toggleParent(row: ParentRow, nameOf: NameOf) {
  const on = !row.enabled;
  const done = await runTagAction(on ? "Activer la règle" : "Désactiver la règle", () => rulesApi.setParentEnabled(row.id, on));
  if (done !== undefined) showGridBadge(`${q(nameOf(row.childId))} → ${q(nameOf(row.parentId))} : ${on ? "activée" : "désactivée"}`);
}

/** Suppression d'une règle (pop-in ParentDeleteDialog) ; `remove` : la case de retrait (D10.3). */
export async function deleteParent(row: ParentRow, nameOf: NameOf, remove: boolean, removed: number) {
  const done = await runTagAction("Supprimer la règle", () => rulesApi.deleteParent(row.id, remove));
  if (done === undefined) return;
  showGridBadge(remove && removed > 0 ? `${q(nameOf(row.parentId))} retiré de ${media(removed)}` : "Règle supprimée");
}
