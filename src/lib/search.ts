// MyBoard — moteur de recherche booru (adapté pour Prisma + SQLite).
//
// Syntaxe supportée (façon Danbooru / Safebooru) :
//   red_hair cat          → tag1 ET tag2
//   -sunglasses           → exclure un tag
//   red*                  → joker (tout tag commençant par "red")
//   type:video            → filtre par kind (image|video|audio|document|archive)
//   ext:pdf               → filtre par extension
//   order:newest           → tri (newest|oldest|size|size_asc|tagcount|tagcount_asc|random|favorite)
//   tagcount:0            → média sans tag
//   tagcount:>5            → plus de 5 tags
//   artist:foo             → raccourci catégorie (résolu en tag "foo")
//
// Inspiré du prototype LM Arena (opus_extracted) mais adapté à Prisma.

import { Prisma, type PrismaClient } from "@prisma/client";
import { normalizeTagName, isCategory } from "./shared";

export type ParsedQuery = {
  include: string[]; // tags à inclure (peuvent contenir *)
  exclude: string[]; // tags à exclure
  kinds: string[]; // filtres type: (ancien format, pour compat)
  exts: string[]; // filtres ext:
  order: string; // tri
  tagCount: { op: "=" | "<" | ">"; n: number } | null;
};

/** Options de recherche séparées des tags (B1 refactor).
 *  kind, sort, favorites sont des paramètres URL indépendants. */
export type SearchOptions = {
  kind?: string; // "" | "image" | "video" | "audio" | "document"
  sort?: string; // "" | "oldest" | "size" | "tagcount" | "random" | "favorite" etc.
  favorites?: boolean;
};

const ORDERS = ["newest", "oldest", "size", "size_asc", "random", "tagcount", "tagcount_asc", "favorite"];

export function parseQuery(q: string): ParsedQuery {
  const res: ParsedQuery = {
    include: [],
    exclude: [],
    kinds: [],
    exts: [],
    order: "newest",
    tagCount: null,
  };
  for (let raw of q.split(/\s+/).filter(Boolean)) {
    raw = raw.toLowerCase();
    const neg = raw.startsWith("-");
    if (neg) raw = raw.slice(1);
    const idx = raw.indexOf(":");
    if (idx > 0) {
      const key = raw.slice(0, idx);
      const val = raw.slice(idx + 1);
      // B1 : type:/order: ne sont plus gérés via tags (séparés en URL params)
      // On les ignore ici (compat : si l'utilisateur tape manuellement type:image,
      // on l'ignore pour éviter les conflits).
      if (key === "type" || key === "kind" || key === "order" || key === "sort") {
        continue;
      }
      if (key === "ext") {
        if (val) res.exts.push(val.replace(/^\./, ""));
        continue;
      }
      if (key === "tagcount") {
        const m = val.match(/^([<>]?)(\d+)$/);
        if (m) res.tagCount = { op: (m[1] || "=") as "=" | "<" | ">", n: Number(m[2]) };
        continue;
      }
      // `artist:foo` → `foo` (raccourci catégorie)
      if (isCategory(key as any)) raw = val;
    }
    const name = normalizeTagName(raw);
    if (!name) continue;
    (neg ? res.exclude : res.include).push(name);
  }
  return res;
}

/** Résout un terme (exact ou wildcard `foo*`) en liste d'ids de tags. */
async function resolveTerm(db: PrismaClient, term: string): Promise<number[]> {
  if (term.includes("*")) {
    // SQLite LIKE : % = n'importe quelle suite, _ = 1 char.
    const pattern = term.replace(/[%_\\]/g, (c) => `\\${c}`).replace(/\*/g, "%");
    const rows = await db.tag.findMany({
      where: { name: { startsWith: pattern.replace(/%$/, ""), mode: "insensitive" } },
      select: { id: true },
      take: 1000,
    });
    // Fallback robuste : si startsWith ne suffit pas (cas *mid*), on filtre en JS
    if (rows.length === 0) {
      const all = await db.tag.findMany({ select: { id: true, name: true }, take: 5000 });
      const re = new RegExp("^" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*") + "$");
      return all.filter((t) => re.test(t.name)).map((t) => t.id).slice(0, 1000);
    }
    return rows.map((r) => r.id);
  }
  const tag = await db.tag.findUnique({ where: { name: term }, select: { id: true } });
  return tag ? [tag.id] : [];
}

/** Construit la clause WHERE Prisma pour une requête parsed + options séparées.
 *  Renvoie null si résultat vide garanti. */
export async function buildWhere(
  db: PrismaClient,
  pq: ParsedQuery,
  opts?: SearchOptions
): Promise<Prisma.MediaWhereInput | null> {
  const conds: Prisma.MediaWhereInput[] = [];

  // Tags inclus (ET) — chaque terme doit être présent (sub-query sur MediaTag).
  for (const term of pq.include) {
    const ids = await resolveTerm(db, term);
    if (ids.length === 0) return null; // tag inexistant → résultat vide garanti
    conds.push({
      tags: { some: { tagId: { in: ids } } },
    });
  }

  // Tags exclus (NOT EXISTS).
  for (const term of pq.exclude) {
    const ids = await resolveTerm(db, term);
    if (ids.length > 0) {
      conds.push({
        tags: { none: { tagId: { in: ids } } },
      });
    }
  }

  // B1 : kind (filtre par type de média) — paramètre URL séparé
  if (opts?.kind) {
    conds.push({ kind: opts.kind });
  }
  // Ancien format (compat : si kinds est dans parsedQuery)
  if (pq.kinds.length) conds.push({ kind: { in: pq.kinds } });

  if (pq.exts.length) conds.push({ ext: { in: pq.exts } });

  // B1 : favorites — paramètre URL séparé (table Favorite)
  if (opts?.favorites) {
    conds.push({ favorites: { some: { userId: "local" } } });
  }

  if (pq.tagCount) {
    const { op, n } = pq.tagCount;
    if (op === "=") conds.push({ tagCount: n });
    else if (op === "<") conds.push({ tagCount: { lt: n } });
    else conds.push({ tagCount: { gt: n } });
  }

  if (conds.length === 0) return {};
  return { AND: conds };
}

/** Ordre de tri Prisma selon le paramètre order. */
function orderBy(order: string): Prisma.MediaOrderByWithRelationInput[] {
  switch (order) {
    case "oldest":
      return [{ id: "asc" }];
    case "size":
      return [{ size: "desc" }, { id: "desc" }];
    case "size_asc":
      return [{ size: "asc" }, { id: "desc" }];
    case "tagcount":
      return [{ tagCount: "desc" }, { id: "desc" }];
    case "tagcount_asc":
      return [{ tagCount: "asc" }, { id: "desc" }];
    case "random":
      // SQLite : RANDOM(). Prisma raw expression.
      return [{ id: "desc" }]; // fallback deterministe (random géré via sql raw si besoin)
    case "favorite":
      return [{ favorite: "desc" }, { id: "desc" }];
    default:
      return [{ id: "desc" }];
  }
}

export async function searchMedia(
  db: PrismaClient,
  q: string,
  page: number,
  pageSize: number,
  opts?: SearchOptions
): Promise<{ items: any[]; total: number; parsed: ParsedQuery }> {
  const pq = parseQuery(q);
  // B1 : le tri vient des opts (URL param séparé), pas du parsedQuery
  const sortOrder = opts?.sort || "newest";
  const where = await buildWhere(db, pq, opts);
  if (where === null) return { items: [], total: 0, parsed: pq };

  const skip = (Math.max(1, page) - 1) * pageSize;

  const [items, total] = await Promise.all([
    db.media.findMany({
      where,
      orderBy: orderBy(sortOrder),
      take: pageSize,
      skip,
      include: {
        tags: { include: { tag: true } },
      },
    }),
    db.media.count({ where }),
  ]);

  return { items, total, parsed: pq };
}

/** Id du média précédent / suivant dans le contexte de recherche (ordres id-based seulement). */
export async function neighbours(
  db: PrismaClient,
  q: string,
  id: number,
  opts?: SearchOptions
): Promise<{ prev: number | null; next: number | null }> {
  const pq = parseQuery(q);
  const sortOrder = opts?.sort || "newest";
  if (!["newest", "oldest"].includes(sortOrder)) return { prev: null, next: null };
  const where = await buildWhere(db, pq, opts);
  if (where === null) return { prev: null, next: null };

  const newest = sortOrder === "newest";

  const prev = await db.media.findFirst({
    where: { ...where, id: newest ? { gt: id } : { lt: id } },
    orderBy: newest ? { id: "asc" } : { id: "desc" },
    select: { id: true },
  });
  const next = await db.media.findFirst({
    where: { ...where, id: newest ? { lt: id } : { gt: id } },
    orderBy: newest ? { id: "desc" } : { id: "asc" },
    select: { id: true },
  });

  return { prev: prev?.id ?? null, next: next?.id ?? null };
}
