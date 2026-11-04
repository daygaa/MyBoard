// Code de partage d'une liste de tags (TAGM-10, TAGM-18 ; refonte, décision D13, lot R8) : « MYBOARD-TAGS-2: » suivi
// de la liste en JSON compressé (deflate), en base 64. Tags rangés par clé de catégorie (un nom, ou [nom, masqué,
// description]), groupes de synonymes [principal, [nom, fusionné]…] et règles de parents [enfant, parent, allumée].
// Ce qui part est choisi dans la pop-in d'export (exportSelection.ts). Compressé, le code de 13 000 tags passe
// d'environ 636 Ko à 115 Ko (retour T3, point TAGM-18.1). Seul ce format est lu (aucun ancien code n'existe).

import type { Category, ManagedTag } from "./api";
import type { SharedGroup, SharedList, SharedRule } from "./rulesApi";

const PREFIX = "MYBOARD-TAGS-2:";

type Row = string | [string, number, string?];
type Payload = { c: Record<string, Row[]>; g: [string, ...[string, number][]][]; p: [string, string, number][] };

const flag = (on: boolean) => (on ? 1 : 0);

/** Octets passés dans un flux de compression ou de décompression du navigateur. */
async function through(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  // Par morceaux : un seul appel sur des centaines de milliers d'octets dépasserait la pile.
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export async function encodeTags(tags: ManagedTag[], categories: Category[], groups: SharedGroup[], parents: SharedRule[]): Promise<string> {
  const keyOf = new Map(categories.map((c) => [c.id, c.key]));
  const c: Payload["c"] = {};
  for (const tag of tags) {
    const row: Row = tag.description ? [tag.name, flag(tag.hidden), tag.description] : tag.hidden ? [tag.name, 1] : tag.name;
    (c[keyOf.get(tag.categoryId) ?? "general"] ??= []).push(row);
  }
  const payload: Payload = {
    c,
    g: groups.map((g) => [g.principal, ...g.names.map((n): [string, number] => [n.name, flag(n.merged)])]),
    p: parents.map((r) => [r.child, r.parent, flag(r.enabled)]),
  };
  const packed = await through(new TextEncoder().encode(JSON.stringify(payload)), new CompressionStream("deflate-raw"));
  return PREFIX + toBase64(packed);
}

const text = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Liste lue dans un code de partage ; `null` si le texte n'en est pas un. */
export async function decodeTags(code: string): Promise<SharedList | null> {
  const clean = code.replace(/\s+/g, "");
  if (!clean.startsWith(PREFIX)) return null;
  try {
    const bytes = Uint8Array.from(atob(clean.slice(PREFIX.length)), (ch) => ch.charCodeAt(0));
    const data: unknown = JSON.parse(new TextDecoder().decode(await through(bytes, new DecompressionStream("deflate-raw"))));
    if (typeof data !== "object" || data === null || !("c" in data)) return null;
    const { c, g, p } = data as { c: unknown; g?: unknown; p?: unknown };
    if (typeof c !== "object" || c === null) return null;
    const tags = Object.entries(c).flatMap(([category, rows]) =>
      list(rows).flatMap((row) => {
        if (text(row)) return [{ name: row, category, hidden: false, description: null }];
        const [name, hidden, description] = list(row);
        return text(name) ? [{ name, category, hidden: hidden === 1, description: text(description) ? description : null }] : [];
      }),
    );
    const groups = list(g).flatMap((row) => {
      const [principal, ...names] = list(row);
      if (!text(principal)) return [];
      return [{ principal, names: names.flatMap((n) => { const [name, merged] = list(n); return text(name) ? [{ name, merged: merged === 1 }] : []; }) }];
    });
    const rules = list(p).flatMap((row) => {
      const [child, parent, enabled] = list(row);
      return text(child) && text(parent) ? [{ child, parent, enabled: enabled !== 0 }] : [];
    });
    return { tags, groups, parents: rules };
  } catch {
    return null;
  }
}
