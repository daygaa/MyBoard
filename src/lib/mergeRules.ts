// Règles de parents dans les pop-ins de fusion et de changement de principal (retour T3, point TAGM-16.4 ; refonte,
// décisions D11 à D11.3 ; lot R5) : lignes « Règles de parents » d'après l'aperçu du cœur Rust (l'action jouée sans
// rien garder), cases « Étendre » et leurs bulles, pop-in de fusion sans case montrée une seule fois par visite de
// l'onglet, badge des règles restées sur le principal à une défusion.

import { showGridBadge } from "@/stores/badge";
import { whileBusy } from "./busy";
import { formatNumber } from "./format";
import { tagTabOf } from "./router";
import { rulesApi, type PlannedChange, type RuleChange, type RuleName } from "./rulesApi";
import { media, q, type AskRules, type RuleLine } from "./tagRules";

/** Dernière ligne des règles d'une pop-in de fusion. */
const BACK = "Désactiver la fusion ramènera ces règles.";
/** Fin des bulles des cases « Étendre ». */
const UNDO = "cela sera annulé si vous désactivez la fusion";

/** Tags dont la pop-in de fusion (sans case) a été confirmée pendant cette visite de l'onglet : elle ne se rouvre pas
 *  (demande du 02/11, retour T3, point TAGM-16.4 ; un réglage pour toujours l'afficher viendra plus tard, FUT-12).
 *  Passer sur l'autre onglet du gestionnaire ou le quitter remet à zéro. */
const shown = new Set<string>();
let shownTab = tagTabOf(window.location.hash);
window.addEventListener("hashchange", () => {
  const tab = tagTabOf(window.location.hash);
  if (tab !== shownTab) shown.clear();
  shownTab = tab;
});

/** Une ligne (réponse 3 du lot R5) : règle réécrite, mise de côté (doublon ou boucle expliqués ; une règle interne au
 *  groupe se comprend seule), qui ne l'est plus (changement de principal), ou règle du principal. Case « Étendre »
 *  (D11.3), avec sa bulle Windows (textes du 02/11) : une règle dont le tag fusionné est l'enfant devient une règle du
 *  principal ; une règle du principal pose son parent aux médias des tags fusionnés. */
function line(c: RuleChange): RuleLine {
  const rule = `${q(c.child)} → ${q(c.parent)}`;
  const other = `${q(c.newChild ?? "")} → ${q(c.newParent ?? "")}`;
  const plus = c.extend ? ` (+${media(c.extend)})` : "";
  /** Case d'une règle du principal `chief` (`text`) : poser son parent aux médias des tags fusionnés dans `chief`. */
  const spread = (text: string, chief: string) => {
    const fused = `${c.of.map(q).join(", ")} ${c.of.length > 1 ? "seront fusionnés" : "sera fusionné"} dans ${q(chief)}`;
    const title = `${fused}, donc vous pouvez décider que la règle parent ${text} s'y applique rétroactivement, ${UNDO}`;
    return { label: `Étendre aux médias de ${c.of.map(q).join(", ")}${plus}`, title };
  };
  // Règle de l'ancien principal réécrite vers le nouveau, qui reçoit aussi des tags fusionnés (tags cochés, point
  // TAGM-11.4) : la case de la règle du principal, sous la ligne réécrite.
  if (c.kind === "moved") return { id: c.id, text: `${rule} deviendra ${other}.`, option: c.of.length > 0 ? spread(other, c.newChild ?? "") : undefined };
  if (c.kind === "back") return { id: c.id, text: `${rule} ne sera plus mise de côté.` };
  if (c.kind === "principal") return { id: c.id, text: rule, option: spread(rule, c.child) };
  const why = c.reason === "duplicate" ? ` (${other} existe déjà)` : c.reason === "loop" ? " (elle ferait une boucle)" : "";
  const text = `${rule} sera mise de côté pendant la fusion${why}.`;
  if (c.extend === null) return { id: c.id, text };
  const principal = q(c.newChild ?? "");
  const title = `${q(c.child)} sera fusionné dans ${principal}, donc vous pouvez décider que la règle parent ${rule} s'applique à tout le groupe : elle deviendra ${other} et ${q(c.parent)} sera ajouté aux médias de ${principal}, ${UNDO}`;
  return { id: c.id, text, option: { label: `Étendre à tout le groupe${plus}`, text: `${rule} deviendra ${other}.`, title } };
}

/** Ce que l'action changera aux règles : les lignes de la pop-in, toutes ; changement de principal (`fusion` faux) :
 *  sans dernière ligne. */
export async function mergeRules(planned: PlannedChange, fusion = true): Promise<AskRules> {
  const changes = await whileBusy(() => rulesApi.rulesPreview(planned)).catch(() => [] as RuleChange[]);
  return { lines: changes.map(line), end: fusion ? BACK : undefined };
}

/** La pop-in de fusion de ces tags s'ouvre-t-elle ? Avec une case « Étendre », toujours (annuler puis rouvrir permet
 *  de revenir sur son choix) ; sans case, seulement si l'un d'eux n'a pas encore eu la sienne pendant la visite. */
export const askAgain = (names: string[], rules: AskRules | undefined) => (rules?.lines.some((l) => l.option) ?? false) || names.some((n) => !shown.has(n));

/** Pop-in de fusion confirmée pour ces tags. */
export function markShown(names: string[]) {
  for (const n of names) shown.add(n);
}

/** Badge d'une défusion : une règle qui ne peut pas revenir (elle ferait une boucle) reste sur le principal
 *  (réponse 5d du lot R5) ; sinon `otherwise`. Rien si l'action a échoué (le message d'erreur est déjà là). */
export function unmergedBadge(stayed: RuleName[] | undefined, otherwise?: string) {
  if (stayed === undefined) return;
  if (stayed.length === 1) showGridBadge(`La règle ${q(stayed[0].child)} → ${q(stayed[0].parent)} reste ainsi : la ramener ferait une boucle.`);
  else if (stayed.length > 1) showGridBadge(`${formatNumber(stayed.length)} règles restent sur le tag principal : les ramener ferait une boucle.`);
  else if (otherwise) showGridBadge(otherwise);
}
