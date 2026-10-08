// POST /api/media/:id/favorite
// Toggle favorite. Renvoie {ok, favorite: boolean}.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const media = await db.media.findUnique({
      where: { id },
      select: { id: true, favorite: true },
    });
    if (!media) {
      return NextResponse.json({ error: "Média introuvable" }, { status: 404 });
    }

    const updated = await db.media.update({
      where: { id },
      data: { favorite: !media.favorite },
      select: { favorite: true },
    });

    return NextResponse.json({ ok: true, favorite: updated.favorite });
  } catch (err) {
    console.error("[POST /api/media/:id/favorite] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
