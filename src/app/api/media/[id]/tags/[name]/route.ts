// DELETE /api/media/:id/tags/:name
// Normalise name, détache le tag. Renvoie {ok}.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { detachTag, normalizeTag } from "@/lib/tag-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; name: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id: idStr, name } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const norm = normalizeTag(decodeURIComponent(name));
    if (!norm) {
      return NextResponse.json({ error: "Tag invalide" }, { status: 400 });
    }

    const media = await db.media.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!media) {
      return NextResponse.json({ error: "Média introuvable" }, { status: 404 });
    }

    const tag = await db.tag.findUnique({
      where: { name: norm },
      select: { id: true },
    });
    if (!tag) {
      // Rien à détacher : on renvoie ok (idempotent).
      return NextResponse.json({ ok: true });
    }

    await detachTag(db, id, tag.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/media/:id/tags/:name] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
