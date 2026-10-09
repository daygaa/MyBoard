// GET    /api/groups/:id   → détails d'un groupe + ses médias (paginé)
// PATCH  /api/groups/:id   body {name?, color?, hidden?} → renomme/recolorise/masque
// DELETE /api/groups/:id   → supprime le groupe (les médias restent)

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  deleteGroup,
  getGroup,
  mediaForGroup,
  setGroupHidden,
  updateGroup,
} from "@/lib/group-helpers";
import { PAGE_SIZE } from "@/lib/shared";

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

    const group = await getGroup(db, id);
    if (!group) {
      return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
    }

    // Page demandée (?page=N) — défaut 1
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

    const { items, total } = await mediaForGroup(db, id, page, PAGE_SIZE);

    return NextResponse.json(
      {
        id: group.id,
        name: group.name,
        color: group.color,
        createdAt:
          group.createdAt instanceof Date
            ? group.createdAt.toISOString()
            : String(group.createdAt),
        items,
        total,
        page,
        pageSize: PAGE_SIZE,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[GET /api/groups/:id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

const PatchBody = z.object({
  name: z.string().min(1).max(80).optional(),
  color: z.string().optional(),
  hidden: z.boolean().optional(),
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

    // Si on renomme, vérifie l'unicité du nouveau nom
    if (parsed.data.name) {
      const existing = await db.group.findFirst({
        where: { name: parsed.data.name.trim(), NOT: { id } },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json(
          { error: "Un autre groupe porte déjà ce nom" },
          { status: 409 }
        );
      }
    }

    // Vérifie que le groupe existe avant toute opération
    const group = await getGroup(db, id);
    if (!group) {
      return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
    }

    // Gère le flag `hidden` via AppMeta (P6)
    if (parsed.data.hidden !== undefined) {
      await setGroupHidden(db, id, parsed.data.hidden);
    }

    // Met à jour name/color si présents
    const { hidden: _hidden, ...rest } = parsed.data;
    const hasNameOrColor = rest.name !== undefined || rest.color !== undefined;
    const updated = hasNameOrColor
      ? await updateGroup(db, id, rest)
      : { id: group.id, name: group.name, color: group.color };

    return NextResponse.json(updated, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[PATCH /api/groups/:id] error:", err);
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

    const ok = await deleteGroup(db, id);
    if (!ok) {
      return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[DELETE /api/groups/:id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
