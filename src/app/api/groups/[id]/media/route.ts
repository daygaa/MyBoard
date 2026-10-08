// POST   /api/groups/:id/media   body {ids: number[]} → attache les médias
// DELETE /api/groups/:id/media    body {ids: number[]} → détache les médias
//
// Sémantique INSERT OR IGNORE sur POST (idempotent : si un média est déjà
// dans le groupe, on ne renvoie pas d'erreur).

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { addGroupMedia, removeGroupMedia } from "@/lib/group-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(10000),
});

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { id: idStr } = await ctx.params;
    const groupId = Number(idStr);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Body invalide", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Vérifie que le groupe existe
    const group = await db.group.findUnique({
      where: { id: groupId },
      select: { id: true },
    });
    if (!group) {
      return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
    }

    const added = await addGroupMedia(db, groupId, parsed.data.ids);
    return NextResponse.json(
      { ok: true, added, requested: parsed.data.ids.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[POST /api/groups/:id/media] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const { id: idStr } = await ctx.params;
    const groupId = Number(idStr);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    // DELETE avec body : Next.js l'expose via req.json()
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Body invalide", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const group = await db.group.findUnique({
      where: { id: groupId },
      select: { id: true },
    });
    if (!group) {
      return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
    }

    const removed = await removeGroupMedia(db, groupId, parsed.data.ids);
    return NextResponse.json(
      { ok: true, removed, requested: parsed.data.ids.length },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[DELETE /api/groups/:id/media] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
