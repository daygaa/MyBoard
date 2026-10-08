// GET /api/search?tags=red_hair%20cat&page=1
// Recherche booru : tags (string, multi-mots séparés par espaces) + page.
// Renvoie SearchResponse : items (avec tags via batch helper), total, page, pageSize.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { searchMedia } from "@/lib/search";
import { mediaToDTO, tagsForMediaList } from "@/lib/tag-helpers";
import { PAGE_SIZE } from "@/lib/shared";
import type { SearchResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tags = url.searchParams.get("tags") ?? "";
    const pageRaw = Number(url.searchParams.get("page") ?? "1");
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

    const { items, total } = await searchMedia(db, tags, page, PAGE_SIZE);

    // Batch tags pour tous les médias de la page (1 seule requête SQL)
    const ids = items.map((m) => m.id);
    const tagMap = await tagsForMediaList(db, ids);

    const out: SearchResponse = {
      items: items.map((m) => {
        const base = mediaToDTO(m as never);
        return { ...base, tags: tagMap[m.id] ?? [] };
      }),
      total,
      page,
      pageSize: PAGE_SIZE,
    };

    return NextResponse.json(out, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[/api/search] error:", err);
    return NextResponse.json(
      { error: "Erreur de recherche" },
      { status: 500 }
    );
  }
}
