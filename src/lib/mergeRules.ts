// Règles de parents dans les pop-ins de fusion et de changement de principal (retour T3, point TAGM-16.4 ; refonte,
// décisions D11 à D11.3 ; lot R5) : lignes « Règles de parents » d'après l'aperçu du cœur Rust (l'action jouée sans
// rien garder), cases « Appliquer » (ex-« Étendre », TAGM-27) et leurs bulles, pop-in de fusion sans case montrée une
// seule fois par visite de l'onglet, badge des règles restées sur le principal à une défusion.

import { showGridBadge } from "@/stores/badge";
import { api } from "./api";
import { whileBusy } from "./busy";
import { formatNumber } from "./format";
import { tagTabOf } from "./router";
import { rulesApi, type PlannedChange, type RuleChange, type RuleName } from "./rulesApi";
import { q, type AskRules, type RuleLine } from "./tagRules";

/** Dernière ligne des règles d'une pop-in de fusion. */
const BACK = "Désactiver la fusion ramènera ces règles.";
/** Cases « Appliquer » décochées par l'utilisateur, retenues dans la bibliothèque, même après un redémarrage (TAGM-27,
 *  réponse Q19 A du 14/11) : une clé par règle et par sorte de case (« medias:12 », « groupe:12 »). */
const UNCHECKED = "fusion.cases-decochees";

async function unchecked(): Promise<Set<string>> {
  const raw = await api.librarySetting(UNCHECKED).catch(() => null);
  try {
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Pop-in confirmée : ses cases décochées sont retenues, ses cases cochées oubliées (`lines` : les lignes montrées). */
export async function rememberChecks(lines: RuleLine[], checked: number[]) {
  const options = lines.flatMap((l) => (l.option?.key ? [{ id: l.id, key: l.option.key }] : []));
  if (!options.length) return;
  const set = await unchecked();
  for (const { id, key } of options) {
    if (checked.includes(id)) set.delete(key);
    else set.add(key);
  }
  await api.setLibrarySetting(UNCHECKED, set.size ? JSON.stringify([...set]) : null).catch(() => undefined);
}

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
 *  groupe se comprend seule), qui ne l'est plus (changement de principal), ou règle du principal. Case « Appliquer »
 *  (D11.3 ; textes de TAGM-27, réponses Q19 A et Q23 A du 14/11 : sans nombre de médias), avec sa bulle Windows : une
 *  règle du principal pose son parent aux médias des tags fusionnés ; une règle dont le tag fusionné est l'enfant
 *  devient une règle du principal (« … à tout le groupe »). */
function line(c: RuleChange): RuleLine {
  const rule = `${q(c.child)} → ${q(c.parent)}`;
  const other = `${q(c.newChild ?? "")} → ${q(c.newParent ?? "")}`;
  /** Case d'une règle du principal `chief` → `parent` : poser `parent` aux médias des tags fusionnés dans `chief`. */
  const spread = (chief: string, parent: string) => {
    const of = c.of.map(q).join(", ");
    const text = `${q(chief)} → ${q(parent)}`;
    const title =
      `Les médias de ${of} recevront ${q(chief)} par la fusion. Cochée : la règle ${text} leur ajoute aussi ${q(parent)}. ` +
      `Décochée : ils reçoivent ${q(chief)} sans ${q(parent)}. À la défusion, ils retrouvent ${of} et perdent ${q(chief)} et ${q(parent)}.`;
    return { label: `Appliquer ${text}`, title, key: `medias:${c.id}`, checked: true };
  };
  // Règle de l'ancien principal réécrite vers le nouveau, qui reçoit aussi des tags fusionnés (tags cochés, point
  // TAGM-11.4) : la case de la règle du principal, sous la ligne réécrite.
  if (c.kind === "moved")
    return { id: c.id, text: `${rule} deviendra ${other}.`, option: c.of.length > 0 ? spread(c.newChild ?? "", c.newParent ?? "") : undefined };
  if (c.kind === "back") return { id: c.id, text: `${rule} ne sera plus mise de côté.` };
  if (c.kind === "principal") return { id: c.id, text: rule, option: spread(c.child, c.parent) };
  const why = c.reason === "duplicate" ? ` (${other} existe déjà)` : c.reason === "loop" ? " (elle ferait une boucle)" : "";
  const text = `${rule} sera mise de côté pendant la fusion${why}.`;
  if (c.extend === null) return { id: c.id, text };
  const principal = q(c.newChild ?? "");
  const title =
    `${q(c.child)} sera fusionné dans ${principal}. Cochée : la règle ${rule} devient ${other} et ajoute ${q(c.parent)} aux médias de ${principal}. ` +
    `Décochée : elle est mise de côté pendant la fusion. À la défusion, la règle redevient ${rule} et ${q(c.parent)} est retiré des médias qui l'ont reçu ainsi.`;
  return { id: c.id, text, option: { label: `Appliquer ${other} à tout le groupe`, text: `${rule} deviendra ${other}.`, title, key: `groupe:${c.id}`, checked: true } };
}

/** Ce que l'action changera aux règles : les lignes de la pop-in, toutes ; changement de principal (`fusion` faux) :
 *  sans dernière ligne. */
export async function mergeRules(planned: PlannedChange, fusion = true): Promise<AskRules> {
  const changes = await whileBusy(() => rulesApi.rulesPreview(planned)).catch(() => [] as RuleChange[]);
  const lines = changes.map(line);
  // Cases cochées à l'ouverture, sauf celles que l'utilisateur a décochées la dernière fois (TAGM-27).
  if (lines.some((l) => l.option?.key)) {
    const off = await unchecked();
    for (const l of lines) if (l.option?.key && off.has(l.option.key)) l.option.checked = false;
  }
  return { lines, end: fusion ? BACK : undefined };
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
