// Code de partage d'une liste de tags (TAGM-10, TAGM-18) : « MYBOARD-TAGS-1: » suivi de la liste en
// JSON compact, en base 64 : tags [nom, clé de catégorie, masqué, description], synonymes [synonyme,
// tag principal, actif] et règles de parents [enfant, parent, cochée, auto]. Seuls les synonymes des
// tags exportés, et les règles entre deux tags exportés, partent avec eux.

import type { Category, ManagedTag } from "./api";
import type { SharedList, TagRules } from "./rulesApi";

const PREFIX = "MYBOARD-TAGS-1:";

const flag = (on: boolean) => (on ? 1 : 0);

export function encodeTags(tags: ManagedTag[], categories: Category[], rules: TagRules): { code: string; aliases: number; parents: number } {
  const keyOf = new Map(categories.map((c) => [c.id, c.key]));
  const nameOf = new Map(tags.map((t) => [t.id, t.name]));
  const t = tags.map((tag) => [tag.name, keyOf.get(tag.categoryId) ?? "general", flag(tag.hidden), tag.description]);
  const a = rules.aliases.filter((x) => nameOf.has(x.tagId)).map((x) => [x.alias, nameOf.get(x.tagId), flag(x.enabled)]);
  const p = rules.parents
    .filter((r) => nameOf.has(r.childId) && nameOf.has(r.parentId))
    .map((r) => [nameOf.get(r.childId), nameOf.get(r.parentId), flag(r.enabled), flag(r.auto)]);
  let binary = "";
  for (const byte of new TextEncoder().encode(JSON.stringify({ t, a, p }))) binary += String.fromCharCode(byte);
  return { code: PREFIX + btoa(binary), aliases: a.length, parents: p.length };
}

const isRow = (r: unknown, size: number): r is unknown[] => Array.isArray(r) && r.length >= size && typeof r[0] === "string" && typeof r[1] === "string";
const rows = (value: unknown, size: number) => (Array.isArray(value) ? value.filter((r) => isRow(r, size)) : []);

/** Liste lue dans un code de partage ; `null` si le texte n'en est pas un. */
export function decodeTags(code: string): SharedList | null {
  const text = code.replace(/\s+/g, "");
  if (!text.startsWith(PREFIX)) return null;
  try {
    const bytes = Uint8Array.from(atob(text.slice(PREFIX.length)), (c) => c.charCodeAt(0));
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof data !== "object" || data === null || !("t" in data)) return null;
    const { t, a, p } = data as { t: unknown; a?: unknown; p?: unknown };
    if (!Array.isArray(t)) return null;
    return {
      tags: rows(t, 2).map(([name, category, hidden, description]) => ({
        name: String(name),
        category: String(category),
        hidden: hidden === 1,
        description: typeof description === "string" ? description : null,
      })),
      aliases: rows(a, 2).map(([alias, tag, enabled]) => ({ alias: String(alias), tag: String(tag), enabled: enabled !== 0 })),
      parents: rows(p, 2).map(([child, parent, enabled, auto]) => ({ child: String(child), parent: String(parent), enabled: enabled !== 0, auto: auto !== 0 })),
    };
  } catch {
    return null;
  }
}
