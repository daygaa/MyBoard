// Règles de parents dans les pop-ins de fusion et de changement de principal (retour T3, point TAGM-16.4 ; refonte,
// décisions D11 à D11.3 ; lot R5) : lignes « Règles de parents » d'après l'aperçu du cœur Rust (l'action jouée sans
// rien garder), cases « Étendre », une règle montrée une seule fois par visite de l'onglet, badge des règles restées
// sur le principal à une défusion.

import { showGridBadge } from "@/stores/badge";
import { whileBusy } from "./busy";
import { formatNumber } from "./format";
import { tagTabOf } from "./router";
import { rulesApi, type PlannedChange, type RuleChange, type RuleName } from "./rulesApi";
import { media, q, type AskRules, type RuleLine } from "./tagRules";

/** Dernière ligne des règles d'une pop-in de fusion. */
const BACK = "Désactiver la fusion ramènera ces règles.";

/** Règles déjà montrées dans une pop-in de fusion pendant cette visite de l'onglet, avec leur choix « Étendre »
 *  (D11.1) : elles ne le sont plus, leur dernier choix s'applique. Passer sur l'autre onglet du gestionnaire ou le
 *  quitter remet à zéro. */
const shown = new Map<number, boolean>();
let shownTab = tagTabOf(window.location.hash);
window.addEventListener("hashchange", () => {
  const tab = tagTabOf(window.location.hash);
  if (tab !== shownTab) shown.clear();
  shownTab = tab;
});

/** Une ligne (réponse 3 du lot R5) : règle réécrite, mise de côté (doublon ou boucle expliqués ; une règle interne au
 *  groupe se comprend seule), qui ne l'est plus (changement de principal), ou règle du principal. Case « Étendre »
 *  (D11.3) : une règle dont le tag fusionné est l'enfant devient alors une règle du principal ; une règle du
 *  principal pose son parent aux médias des tags fusionnés. */
function line(c: RuleChange): RuleLine {
  const rule = `${q(c.child)} → ${q(c.parent)}`;
  const other = `${q(c.newChild ?? "")} → ${q(c.newParent ?? "")}`;
  const plus = c.extend ? ` (+${media(c.extend)})` : "";
  if (c.kind === "moved") return { id: c.id, text: `${rule} deviendra ${other}.` };
  if (c.kind === "back") return { id: c.id, text: `${rule} ne sera plus mise de côté.` };
  if (c.kind === "principal") return { id: c.id, text: rule, option: { label: `Étendre aux médias de ${c.of.map(q).join(", ")}${plus}` } };
  const why = c.reason === "duplicate" ? ` (${other} existe déjà)` : c.reason === "loop" ? " (elle ferait une boucle)" : "";
  const text = `${rule} sera mise de côté pendant la fusion${why}.`;
  return c.extend === null ? { id: c.id, text } : { id: c.id, text, option: { label: `Étendre à tout le groupe${plus}`, text: `${rule} deviendra ${other}.` } };
}

/** Ce que l'action changera aux règles : les lignes de la pop-in et les règles à étendre sans demander (déjà montrées
 *  pendant la visite, cochées). Changement de principal (`fusion` faux) : toutes les règles réécrites, sans case. */
export async function mergeRules(planned: PlannedChange, fusion = true) {
  const changes = await whileBusy(() => rulesApi.rulesPreview(planned)).catch(() => [] as RuleChange[]);
  const fresh = fusion ? changes.filter((c) => !shown.has(c.id)) : changes;
  const rules: AskRules = { lines: fresh.map(line), end: fusion ? BACK : undefined };
  return { rules, remembered: changes.filter((c) => shown.get(c.id)).map((c) => c.id) };
}

/** Pop-in confirmée : ses règles sont montrées pour la visite, avec leur choix ; renvoie toutes les règles à étendre. */
export function chosen(plan: Awaited<ReturnType<typeof mergeRules>>, checked: number[]) {
  for (const l of plan.rules.lines) shown.set(l.id, checked.includes(l.id));
  return [...plan.remembered, ...checked];
}

/** Badge d'une défusion : une règle qui ne peut pas revenir (elle ferait une boucle) reste sur le principal
 *  (réponse 5d du lot R5) ; sinon `otherwise`. Rien si l'action a échoué (le message d'erreur est déjà là). */
export function unmergedBadge(stayed: RuleName[] | undefined, otherwise?: string) {
  if (stayed === undefined) return;
  if (stayed.length === 1) showGridBadge(`La règle ${q(stayed[0].child)} → ${q(stayed[0].parent)} reste ainsi : la ramener ferait une boucle.`);
  else if (stayed.length > 1) showGridBadge(`${formatNumber(stayed.length)} règles restent sur le tag principal : les ramener ferait une boucle.`);
  else if (otherwise) showGridBadge(otherwise);
}
