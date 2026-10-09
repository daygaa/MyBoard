// PATCH  /api/tags/:id   body {name?, category?} → renomme / change catégorie
// DELETE /api/tags/:id   → supprime le tag (et détache tous les médias liés)

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { deleteTag, updateTag } from "@/lib/tag-helpers";
import { isCategory } from "@/lib/shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const PatchBody = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.string().min(1).max(64).optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Body invalide", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Valide la catégorie si fournie (doit être une des catégories connues)
    if (parsed.data.category !== undefined && !isCategory(parsed.data.category)) {
      return NextResponse.json(
        { error: `Catégorie invalide : ${parsed.data.category}` },
        { status: 400 }
      );
    }

    try {
      const updated = await updateTag(db, id, parsed.data);
      if (!updated) {
        return NextResponse.json({ error: "Tag introuvable" }, { status: 404 });
      }
      return NextResponse.json(updated, {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "UNIQUE_VIOLATION") {
        return NextResponse.json(
          { error: "Un autre tag porte déjà ce nom" },
          { status: 409 }
        );
      }
      if (msg === "Nom de tag vide après normalisation") {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      throw e; // re-throw pour le catch global
    }
  } catch (err) {
    console.error("[PATCH /api/tags/:id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const ok = await deleteTag(db, id);
    if (!ok) {
      return NextResponse.json({ error: "Tag introuvable" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[DELETE /api/tags/:id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
