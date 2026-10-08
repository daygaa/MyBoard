// GET /api/stats
// Renvoie StatsResponse : total, count par kind, favorites, total tags.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { StatsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const [total, favorites, tagCount, byKind] = await Promise.all([
      db.media.count(),
      db.media.count({ where: { favorite: true } }),
      db.tag.count(),
      db.media.groupBy({
        by: ["kind"],
        _count: { _all: true },
      }),
    ]);

    const counts: Record<string, number> = {
      image: 0,
      video: 0,
      audio: 0,
      document: 0,
      archive: 0,
      other: 0,
    };
    for (const row of byKind) {
      counts[row.kind] = row._count._all;
    }

    const out: StatsResponse = {
      total,
      images: counts.image ?? 0,
      videos: counts.video ?? 0,
      audio: counts.audio ?? 0,
      documents: counts.document ?? 0,
      archives: counts.archive ?? 0,
      others: counts.other ?? 0,
      favorites,
      tags: tagCount,
    };

    return NextResponse.json(out, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[/api/stats] error:", err);
    return NextResponse.json(
      { error: "Erreur de stats" },
      { status: 500 }
    );
  }
}
