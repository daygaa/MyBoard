// GET /api/media/:id/neighbors?tags=...&kind=...&sort=...&favorites=...
// B1 : kind, sort, favorites sont des params URL SÉPARÉS.
// Renvoie {prev: number|null, next: number|null, offset: number|null, total: number|null}

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildWhere, neighbours, parseQuery, type SearchOptions } from "@/lib/search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const url = new URL(req.url);
    const tags = url.searchParams.get("tags") ?? "";

    // B1 : lit les params URL séparés
    const opts: SearchOptions = {
      kind: url.searchParams.get("kind") || undefined,
      sort: url.searchParams.get("sort") || undefined,
      favorites: url.searchParams.get("favorites") === "1",
    };

    // Vérifie que le média existe
    const exists = await db.media.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "Média introuvable" }, { status: 404 });
    }

    const res = await neighbours(db, tags, id, opts);

    // v-14 : calcule l'offset
    let offset: number | null = null;
    let total: number | null = null;
    try {
      const pq = parseQuery(tags);
      const sortOrder = opts.sort || "newest";
      if (["newest", "oldest"].includes(sortOrder)) {
        const where = await buildWhere(db, pq, opts);
        if (where === null) {
          offset = 0;
          total = 0;
        } else {
          const newest = sortOrder === "newest";
          const [cnt, tot] = await Promise.all([
            db.media.count({
              where: { ...where, id: newest ? { gt: id } : { lt: id } },
            }),
            db.media.count({ where }),
          ]);
          offset = cnt;
          total = tot;
        }
      }
    } catch {
      offset = null;
      total = null;
    }

    return NextResponse.json(
      { prev: res.prev, next: res.next, offset, total },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[GET /api/media/:id/neighbors] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
