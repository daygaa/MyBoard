// Actions sur les tags, communes au gestionnaire (TAGM-04) et aux menus des tags (CTX-04, CTX-12) :
// appel au cœur Rust, erreur éventuelle dans la pop-in d'erreur, puis relecture de tout ce qui montre
// des tags (gestionnaire, synonymes et parents, barre latérale, suggestions, visionneuse, grille).
// Aussi : tags proches (TAGM-13). Code de partage d'une liste de tags : lib/shareCode.ts.

import { currentTerms, renameSearchTag } from "@/stores/search";
import { useViewer } from "@/stores/viewer";
import { api, type ManagedTag } from "./api";
import { queryClient } from "./queryClient";

export function refreshTags(): Promise<unknown> {
  const keys = [["tag-manager"], ["tag-rules"], ["page-tags"], ["autocomplete"], ["tag"], ["media-detail"], ["media"], ["stats"], ["selection-tags"]];
  return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

/** Appel au cœur Rust ; renvoie sa réponse, ou `undefined` en cas d'erreur (affichée). */
export async function runTagAction<T>(action: string, call: () => Promise<T>): Promise<T | undefined> {
  try {
    return await call();
  } catch (error) {
    useViewer.getState().setError({ action, code: null, message: String(error) });
    return undefined;
  } finally {
    await refreshTags();
  }
}

export const setTagsCategory = (ids: number[], categoryId: number) => runTagAction("Changer de catégorie", () => api.setTagsCategory(ids, categoryId));
export const setTagsHidden = (ids: number[], hidden: boolean) =>
  runTagAction(hidden ? "Masquer de la recherche" : "Ne plus masquer de la recherche", () => api.setTagsHidden(ids, hidden));
export const deleteTags = (ids: number[]) => runTagAction("Supprimer le tag", () => api.deleteTags(ids));
/** Tag renommé ou fusionné (SRCH-27) : la recherche en cours (et celle de la visionneuse ouverte)
 *  prend le nouveau nom. */
export function followRename(from: string, to: string) {
  renameSearchTag(from, to);
  const { base } = useViewer.getState();
  if (base) useViewer.setState({ base: { ...base, terms: currentTerms(base.terms) } });
}

type Named = { id: number; name: string };

/** Fusionne `sources` dans `target` ; `keep` : leurs noms deviennent des synonymes du tag gardé
 *  (TAGM-17). */
export async function mergeTags(sources: Named[], target: Named, keep: boolean) {
  const done = await runTagAction("Fusionner les tags", () => api.mergeTags(sources.map((s) => s.id), target.id, keep));
  if (done !== undefined) for (const s of sources) if (s.id !== target.id) followRename(s.name, target.name);
  return done;
}
/** « Tout fusionner » des tags proches (TAGM-13.3) : chaque groupe dans son tag gardé, en une fois. */
export async function mergeGroups(groups: { sources: Named[]; target: Named }[], keep: boolean) {
  const ids = groups.map((g) => ({ sources: g.sources.map((s) => s.id), target: g.target.id }));
  const done = await runTagAction("Fusionner les tags", () => api.mergeTagGroups(ids, keep));
  if (done !== undefined) for (const g of groups) for (const s of g.sources) if (s.id !== g.target.id) followRename(s.name, g.target.name);
  return done;
}
export const setTagDescription = (id: number, text: string) => runTagAction("Description du tag", () => api.setTagDescription(id, text));

// --- Tags proches (TAGM-13)

/** Clé de rapprochement : sans accents, sans « _ », « - », espaces ni points, sans « s » final. */
function similarityKey(name: string): string {
  const flat = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[_\-\s.]/g, "");
  return flat.length > 3 && flat.endsWith("s") ? flat.slice(0, -1) : flat;
}

/** Identifiants triés d'un groupe, tels que rangés quand on l'ignore. */
export const groupKey = (group: { id: number }[]) =>
  group
    .map((t) => t.id)
    .sort((a, b) => a - b)
    .join(",");

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

/** Détection des tags proches (retour T3, point TAGM-13.5) : « strict » = la clé ci-dessus ; « large » = en
 *  plus, le singulier de chaque mot (« hand on own hip » ~ « hands on own hips », « chevaux » ~ « cheval »)
 *  et les mots dans un autre ordre (« unicorn gundam » ~ « gundam unicorn »). */
export type SimilarLevel = "strict" | "large";
const LEVEL_KEYS: Record<SimilarLevel, ((name: string) => string)[]> = {
  strict: [similarityKey],
  large: [similarityKey, (name) => singularWords(name).join(""), (name) => singularWords(name).sort().join(" ")],
};

/** Groupes de noms presque identiques (« long_hair », « longhair », « long_hairs »), les plus
 *  utilisés d'abord ; les groupes ignorés n'y sont pas. Deux tags qui partagent une clé du niveau sont
 *  dans le même groupe (et, de proche en proche, ceux qui partagent une clé avec l'un d'eux). */
export function similarGroups(tags: ManagedTag[], ignored: string[], level: SimilarLevel = "strict"): ManagedTag[][] {
  const parent = tags.map((_, i) => i);
  const root = (i: number) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  for (const keyOf of LEVEL_KEYS[level]) {
    const first = new Map<string, number>();
    tags.forEach((tag, i) => {
      const key = keyOf(tag.name);
      const j = first.get(key);
      if (j === undefined) first.set(key, i);
      else parent[root(i)] = root(j);
    });
  }
  const groups = new Map<number, ManagedTag[]>();
  tags.forEach((tag, i) => {
    const r = root(i);
    const group = groups.get(r);
    if (group) group.push(tag);
    else groups.set(r, [tag]);
  });
  const skip = new Set(ignored);
  const total = (g: ManagedTag[]) => g.reduce((n, t) => n + t.mediaCount, 0);
  return [...groups.values()].filter((g) => g.length > 1 && !skip.has(groupKey(g))).sort((a, b) => total(b) - total(a));
}
