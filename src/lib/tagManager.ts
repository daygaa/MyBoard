// Actions sur les tags, communes au gestionnaire (TAGM-04) et aux menus des tags (CTX-04, CTX-12) :
// appel au cœur Rust, erreur éventuelle dans la pop-in d'erreur, puis relecture de tout ce qui montre
// des tags (gestionnaire, barre latérale, suggestions, visionneuse, grille). Aussi : tags proches
// (TAGM-13) et code de partage d'une liste de tags (TAGM-10).

import { useViewer } from "@/stores/viewer";
import { api, type Category, type ManagedTag, type SharedTag } from "./api";
import { queryClient } from "./queryClient";

export function refreshTags(): Promise<unknown> {
  const keys = [["tag-manager"], ["page-tags"], ["autocomplete"], ["tag"], ["media-detail"], ["media"], ["stats"], ["selection-tags"]];
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
export const mergeTags = (sources: number[], target: number) => runTagAction("Fusionner les tags", () => api.mergeTags(sources, target));
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

/** Groupes de noms presque identiques (« long_hair », « longhair », « long_hairs »), les plus
 *  utilisés d'abord ; les groupes ignorés n'y sont pas. */
export function similarGroups(tags: ManagedTag[], ignored: string[]): ManagedTag[][] {
  const groups = new Map<string, ManagedTag[]>();
  for (const tag of tags) {
    const key = similarityKey(tag.name);
    groups.set(key, [...(groups.get(key) ?? []), tag]);
  }
  const skip = new Set(ignored);
  const total = (g: ManagedTag[]) => g.reduce((n, t) => n + t.mediaCount, 0);
  return [...groups.values()].filter((g) => g.length > 1 && !skip.has(groupKey(g))).sort((a, b) => total(b) - total(a));
}

// --- Code de partage (TAGM-10) : la liste en JSON compact, en base 64, avec un préfixe reconnaissable.

const PREFIX = "MYBOARD-TAGS-1:";

export function encodeTags(tags: ManagedTag[], categories: Category[]): string {
  const keyOf = new Map(categories.map((c) => [c.id, c.key]));
  const rows = tags.map((t) => [t.name, keyOf.get(t.categoryId) ?? "general", t.hidden ? 1 : 0]);
  let binary = "";
  for (const byte of new TextEncoder().encode(JSON.stringify(rows))) binary += String.fromCharCode(byte);
  return PREFIX + btoa(binary);
}

/** Liste lue dans un code de partage ; `null` si le texte n'en est pas un. */
export function decodeTags(code: string): SharedTag[] | null {
  const text = code.replace(/\s+/g, "");
  if (!text.startsWith(PREFIX)) return null;
  try {
    const bytes = Uint8Array.from(atob(text.slice(PREFIX.length)), (c) => c.charCodeAt(0));
    const rows: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!Array.isArray(rows)) return null;
    return rows
      .filter((r): r is [string, string, number] => Array.isArray(r) && typeof r[0] === "string" && typeof r[1] === "string")
      .map(([name, category, hidden]) => ({ name, category, hidden: hidden === 1 }));
  } catch {
    return null;
  }
}
