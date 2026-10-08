// GET /api/tags?page=1,2,3,4,5 (comma-sep mediaIds)
// Renvoie TagDTO[] : tags présents sur cette page de médias, avec postCount GLOBAL.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pageTags } from "@/lib/tag-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const pageParam = url.searchParams.get("page") ?? "";
    const ids = pageParam
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);

    if (ids.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const tags = await pageTags(db, ids);
    return NextResponse.json(
      { items: tags },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[/api/tags] error:", err);
    return NextResponse.json(
      { error: "Erreur de récupération des tags de page" },
      { status: 500 }
    );
  }
}
