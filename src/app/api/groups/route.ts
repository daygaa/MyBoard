// GET  /api/groups         → liste tous les groupes (id, name, color, count)
// POST /api/groups         body {name, color?} → crée un groupe
//
// Toutes les réponses sont `no-store` (les groupes changent souvent).

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createGroup, listGroups, normalizeGroupName } from "@/lib/group-helpers";
import type { GroupDTO } from "@/lib/group-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const groups = await listGroups(db);
    return NextResponse.json<GroupDTO[]>(groups, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[GET /api/groups] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

const CreateBody = z.object({
  name: z.string().min(1).max(80),
  color: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Body invalide", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { name, color } = parsed.data;
    const norm = normalizeGroupName(name);
    if (!norm) {
      return NextResponse.json({ error: "Nom de groupe vide" }, { status: 400 });
    }

    // Vérifie l'unicité du nom en amont (sinon Prisma lèvera une contrainte unique)
    const existing = await db.group.findUnique({
      where: { name: norm },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Un groupe avec ce nom existe déjà" },
        { status: 409 }
      );
    }

    const g = await createGroup(db, norm, color);
    return NextResponse.json(
      { id: g.id, name: g.name, color: g.color },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (err) {
    console.error("[POST /api/groups] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
