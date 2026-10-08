// POST /api/media/bulk body {ids: number[], add?: string, remove?: string}
// Pour chaque id : attache (add) et/ou détache (remove) le tag.
// Renvoie BulkTagResponse {updated, created}.
//
// Notes :
// - add/remove sont des noms de tags simples (normalisés).
// - "created" = nombre de nouveaux attachs (tag qui n'était pas déjà sur le média)
// - "updated" = nombre de médias traités

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { attachTag, detachTag, getOrCreateTag, normalizeTag } from "@/lib/tag-helpers";
import type { BulkTagResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(10000),
  add: z.string().optional(),
  remove: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Body invalide", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { ids, add, remove } = parsed.data;

    let created = 0;
    let updated = 0;

    // Résout les tags add/remove en IDs (crée si besoin pour add)
    let addTagId: number | null = null;
    if (add) {
      const norm = normalizeTag(add);
      if (norm) {
        const tag = await getOrCreateTag(db, norm);
        addTagId = tag.id;
      }
    }
    let removeTagId: number | null = null;
    if (remove) {
      const norm = normalizeTag(remove);
      if (norm) {
        const tag = await db.tag.findUnique({
          where: { name: norm },
          select: { id: true },
        });
        removeTagId = tag?.id ?? null;
      }
    }

    if (!addTagId && !removeTagId) {
      return NextResponse.json(
        { error: "Aucun tag valide à ajouter/supprimer" },
        { status: 400 }
      );
    }

    for (const id of ids) {
      let touched = false;
      if (addTagId) {
        const isNew = await attachTag(db, id, addTagId);
        if (isNew) created++;
        touched = true;
      }
      if (removeTagId) {
        await detachTag(db, id, removeTagId);
        touched = true;
      }
      if (touched) updated++;
    }

    const out: BulkTagResponse = { updated, created };
    return NextResponse.json(out, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[POST /api/media/bulk] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
