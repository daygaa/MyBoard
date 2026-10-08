// GET /api/media/:id/neighbors?tags=...
// Renvoie {prev: number|null, next: number|null, offset: number|null, total: number|null}
// dans le contexte de recherche courant.
//
// v-13/v-14 : `offset` et `total` sont utilisés par la lightbox pour :
// - calculer la page correspondant au média courant (Math.floor(offset / PAGE_SIZE) + 1)
// - au moment de fermer la lightbox, naviguer vers cette page si elle diffère
//   de la page d'origine.
//
// `offset` n'est calculé que pour les tris id-based (newest, oldest). Pour les
// autres tris (size, tagcount, random, favorite), prev/next sont déjà null et
// offset/total le restent (pas de navigation cross-page possible dans ce cas).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildWhere, neighbours, parseQuery } from "@/lib/search";

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

    // Vérifie que le média existe
    const exists = await db.media.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      return NextResponse.json({ error: "Média introuvable" }, { status: 404 });
    }

    const res = await neighbours(db, tags, id);

    // v-14 : calcule l'offset (index 0-based) du média courant dans l'ordre de
    // recherche, pour pouvoir déterminer sa page. Uniquement pour newest/oldest
    // (les autres tris ne supportent déjà pas la navigation prev/next).
    let offset: number | null = null;
    let total: number | null = null;
    try {
      const pq = parseQuery(tags);
      if (["newest", "oldest"].includes(pq.order)) {
        const where = await buildWhere(db, pq);
        if (where === null) {
          offset = 0;
          total = 0;
        } else {
          const newest = pq.order === "newest";
          // Pour newest (id desc) : offset = nombre de médias avec id > courant
          // Pour oldest (id asc)  : offset = nombre de médias avec id < courant
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
      // On ne casse pas l'API si le calcul d'offset échoue — on renvoie null.
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
