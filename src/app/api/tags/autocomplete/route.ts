// GET /api/tags/autocomplete?q=red&limit=10
// Cherche tags dont le name STARTS WITH q (normalisé).
// Tri par postCount desc. Gère q vide → top 10 tags globaux.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeTagName } from "@/lib/shared";
import type { AutocompleteResponse, TagDTO } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get("q") ?? "";
    const limitRaw = Number(url.searchParams.get("limit") ?? "10");
    const limit = Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(50, Math.floor(limitRaw))
      : 10;

    // Normalisation du terme (lowercase, espaces → _). On garde les * si wildcard.
    let term = normalizeTagName(raw);

    let tags: { id: number; name: string; category: string; postCount: number }[];

    if (!term) {
      // q vide → top 10 tags globaux
      tags = await db.tag.findMany({
        select: { id: true, name: true, category: true, postCount: true },
        orderBy: { postCount: "desc" },
        take: limit,
      });
    } else {
      // STARTS WITH : Prisma startsWith (SQLite LIKE 'term%').
      tags = await db.tag.findMany({
        where: { name: { startsWith: term } },
        select: { id: true, name: true, category: true, postCount: true },
        orderBy: { postCount: "desc" },
        take: limit,
      });

      // Si peu de résultats prefix, on complète avec des matchs "contient" via LIKE _term
      if (tags.length < limit) {
        const remaining = limit - tags.length;
        const ids = new Set(tags.map((t) => t.id));
        const extra = await db.tag.findMany({
          where: {
            AND: [
              { name: { contains: term } },
              ...(ids.size ? [{ id: { notIn: [...ids] } }] : []),
            ],
          },
          select: { id: true, name: true, category: true, postCount: true },
          orderBy: { postCount: "desc" },
          take: remaining,
        });
        tags = [...tags, ...extra];
      }
    }

    const items: TagDTO[] = tags.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      postCount: t.postCount,
    }));

    const out: AutocompleteResponse = { items };
    return NextResponse.json(out, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[/api/tags/autocomplete] error:", err);
    return NextResponse.json(
      { error: "Erreur d'autocomplétion" },
      { status: 500 }
    );
  }
}
