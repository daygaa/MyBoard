// Tags proches (TAGM-13 ; refonte, décisions D8 à D8.3 ; lot R6-2) : détection des noms presque identiques
// (« Strict » / « Large », retour T3, points TAGM-13.5 et TAGM-13.6) qui tient compte des groupes de synonymes (deux
// tags du même groupe ne sont plus proposés ensemble ; un tag proche d'un groupe est proposé pour y être ajouté ;
// deux groupes proches sont proposés pour être réunis) et des paires écartées (« ces deux tags ne sont pas
// synonymes », réponse 3 du lot R6). Les actions : `similarActions.ts`.

import type { ManagedTag, SimilarIgnore } from "./api";
import type { GroupRow } from "./rulesApi";

/** Clé de rapprochement : sans accents, sans « _ », « - », espaces ni points, sans « s » final. */
function similarityKey(name: string): string {
  const flat = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[_\-\s.]/g, "");
  return flat.length > 3 && flat.endsWith("s") ? flat.slice(0, -1) : flat;
}

/** Mots d'un nom, sans accents ni séparateurs, chacun au singulier : sans son « s » final (plus de 3
 *  lettres) ; pluriels français « -aux » → « -al », « -eaux / -eux / -oux » sans « x » (retour T3, point
 *  TAGM-13.6 : « chevaux » ~ « cheval », « jeux » ~ « jeu »). */
const singularWords = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[_\-\s.]+/)
    .filter(Boolean)
    // « -eaux » d'abord : sinon « oiseaux » finirait par « -aux » et deviendrait « oiseal ».
    .map((w) => w.replace(/(eau|eu|ou)x$/, "$1").replace(/aux$/, "al"))
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));

/** « strict » = la clé ci-dessus ; « large » = en plus, le singulier de chaque mot (« hand on own hip » ~ « hands on
 *  own hips », « chevaux » ~ « cheval ») et les mots dans un autre ordre (« unicorn gundam » ~ « gundam unicorn »). */
export type SimilarLevel = "strict" | "large";
const LEVEL_KEYS: Record<SimilarLevel, ((name: string) => string)[]> = {
  strict: [similarityKey],
  large: [similarityKey, (name) => singularWords(name).join(""), (name) => singularWords(name).sort().join(" ")],
};

/** Un bloc de la pop-in : ses tags, ceux qui ne sont dans aucun groupe (`fresh`) et les groupes qu'il touche. Aucun
 *  groupe : on choisit le principal parmi les tags ; un groupe : « Ajouter au groupe » ; plusieurs : réunion autour du
 *  principal du plus grand groupe (D14 ; réponse 5 du lot R6). */
export type SimilarBlock = { key: string; tags: ManagedTag[]; fresh: ManagedTag[]; groups: GroupRow[] };

const pairKey = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);

/** Paires écartées : « Ignorer » un bloc = toutes ses paires ; décocher = paires entre les tags écartés et les gardés. */
function ignoredPairs(ignores: SimilarIgnore[]): Set<string> {
  const pairs = new Set<string>();
  for (const i of ignores) {
    if (i.kind === "group") i.apart.forEach((a, x) => i.apart.slice(x + 1).forEach((b) => pairs.add(pairKey(a, b))));
    else for (const a of i.apart) for (const k of i.kept) pairs.add(pairKey(a, k));
  }
  return pairs;
}

/** Blocs de tags proches, les plus utilisés d'abord. Deux tags sont liés s'ils partagent une clé du niveau et que leur
 *  paire n'a pas été écartée ; un bloc réunit les tags liés de proche en proche. */
export function similarBlocks(tags: ManagedTag[], ignores: SimilarIgnore[], groupOf: Map<number, GroupRow>, level: SimilarLevel = "strict"): SimilarBlock[] {
  const skip = ignoredPairs(ignores);
  const links = new Map<number, number[]>();
  const link = (i: number, j: number) => {
    links.set(i, [...(links.get(i) ?? []), j]);
    links.set(j, [...(links.get(j) ?? []), i]);
  };
  for (const keyOf of LEVEL_KEYS[level]) {
    const buckets = new Map<string, number[]>();
    tags.forEach((tag, i) => {
      const key = keyOf(tag.name);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(i);
      else buckets.set(key, [i]);
    });
    for (const bucket of buckets.values()) {
      bucket.forEach((i, x) => bucket.slice(x + 1).forEach((j) => !skip.has(pairKey(tags[i].id, tags[j].id)) && link(i, j)));
    }
  }
  /** Tags liés de proche en proche à `start`, sans sortir de `within` (s'il est donné). */
  const reach = (start: number, seen: Set<number>, within?: Set<number>) => {
    seen.add(start);
    const stack = [start];
    const out: number[] = [];
    while (stack.length) {
      const i = stack.pop() as number;
      out.push(i);
      for (const j of links.get(i) ?? []) {
        if (!seen.has(j) && (!within || within.has(j))) {
          seen.add(j);
          stack.push(j);
        }
      }
    }
    return out;
  };
  const blocks: SimilarBlock[] = [];
  const push = (part: number[]) => {
    const list = part.map((i) => tags[i]).sort((a, b) => b.mediaCount - a.mediaCount);
    const touched = list.map((t) => groupOf.get(t.id)).filter((g): g is GroupRow => g !== undefined);
    const groups = [...new Map(touched.map((g) => [g.id, g])).values()];
    const fresh = list.filter((t) => !groupOf.has(t.id));
    // Moins de deux tags, ou tous déjà du même groupe : rien à proposer.
    if (list.length < 2 || (groups.length === 1 && fresh.length === 0)) return;
    blocks.push({ key: list.map((t) => t.id).sort((a, b) => a - b).join(","), tags: list, fresh, groups });
  };
  const seen = new Set<number>();
  for (const start of links.keys()) {
    if (seen.has(start)) continue;
    const part = reach(start, seen);
    // Un tag écarté d'un groupe (et les tags proches qu'il relie, hors groupe) forme un bloc à part : il ne revient
    // jamais dans le bloc de ce groupe, même relié par un nouveau tag qui ressemble aux deux (réponse 3 du lot R6). De
    // même pour un groupe dont des tags ont été écartés de ceux du groupe principal du bloc.
    const members = part.filter((i) => groupOf.has(tags[i].id));
    const fresh = part.filter((i) => !groupOf.has(tags[i].id));
    const byGroup = new Map<GroupRow, number[]>();
    for (const i of members) {
      const g = groupOf.get(tags[i].id) as GroupRow;
      byGroup.set(g, [...(byGroup.get(g) ?? []), i]);
    }
    const clash = (a: number[], b: number[]) => a.some((i) => b.some((j) => skip.has(pairKey(tags[i].id, tags[j].id))));
    const main = largest([...byGroup.keys()]);
    const outMembers = [...byGroup].filter(([g, list]) => g !== main && main && clash(list, byGroup.get(main) ?? [])).flatMap(([, list]) => list);
    const apart = fresh.filter((i) => clash([i], members));
    const within = new Set([...fresh, ...outMembers]);
    const taken = new Set<number>();
    for (const i of [...outMembers, ...apart]) if (!taken.has(i)) push(reach(i, taken, within));
    push(part.filter((i) => !taken.has(i)));
  }
  const total = (b: SimilarBlock) => b.tags.reduce((n, t) => n + t.mediaCount, 0);
  return blocks.sort((a, b) => total(b) - total(a));
}

/** Le groupe autour duquel un bloc se fait : le seul touché, ou le plus grand (le plus de noms, puis le plus de
 *  médias) quand plusieurs sont réunis (D14). */
export const mainGroup = (block: SimilarBlock) => largest(block.groups);

function largest(groups: GroupRow[]) {
  return groups.reduce<GroupRow | undefined>((best, g) => (!best || g.names.length > best.names.length || (g.names.length === best.names.length && g.media > best.media) ? g : best), undefined);
}

/** Groupe entièrement fusionné : l'interrupteur d'un bloc qui le rejoint est allumé d'office (D2.2). */
export const fullyMerged = (group: GroupRow | undefined) => !!group && group.names.length > 0 && group.names.every((n) => n.merged);
