// POST /api/seed → seed de la démo (idempotent)
// GET /api/seed → check l'état du seed ({seeded, count, total})

import { NextResponse } from "next/server";
import { seedDemoAssets, seedStatus } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const status = await seedStatus();
    return NextResponse.json(status, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[GET /api/seed] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const result = await seedDemoAssets();
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[POST /api/seed] error:", err);
    return NextResponse.json(
      { error: "Erreur lors du seed", details: String(err) },
      { status: 500 }
    );
  }
}
