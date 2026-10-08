// POST /api/media/:id/tags body {tag: string, category?: string}
// Normalise, getOrCreateTag, attachTag.
// Renvoie {ok, item: MediaDetail} (le média mis à jour).

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { attachTag, getOrCreateTag, mediaDetail, normalizeTag } from "@/lib/tag-helpers";
import { isCategory } from "@/lib/shared";
import type { MediaDetail } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  tag: z.string().min(1).max(255),
  category: z.string().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Body invalide", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const norm = normalizeTag(parsed.data.tag);
    if (!norm) {
      return NextResponse.json({ error: "Tag vide après normalisation" }, { status: 400 });
    }

    // Valide la catégorie si fournie
    const category = parsed.data.category;
    if (category && !isCategory(category)) {
      return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 });
    }

    const media = await db.media.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!media) {
      return NextResponse.json({ error: "Média introuvable" }, { status: 404 });
    }

    const tag = await getOrCreateTag(db, norm, category);
    await attachTag(db, id, tag.id);

    const item: MediaDetail | null = await mediaDetail(db, id);
    if (!item) {
      return NextResponse.json({ error: "Média introuvable post-attach" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[POST /api/media/:id/tags] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
