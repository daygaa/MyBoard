// GET /api/files/:id/thumb
// Stream la miniature JPEG. 404 si pas de thumb.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { absThumbPath } from "@/lib/storage";
import fs from "node:fs/promises";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const media = await db.media.findUnique({
      where: { id },
      select: {
        id: true,
        sha256: true,
        hasThumb: true,
        storage: true,
        remoteThumbUrl: true,
      },
    });
    if (!media) {
      return NextResponse.json({ error: "Média introuvable" }, { status: 404 });
    }

    // Remote thumb : redirect
    if (media.storage === "remote" && media.remoteThumbUrl) {
      return NextResponse.redirect(media.remoteThumbUrl, { status: 302 });
    }

    if (!media.hasThumb || !media.sha256) {
      return NextResponse.json({ error: "Pas de miniature" }, { status: 404 });
    }

    const thumbPath = absThumbPath(media.sha256);
    let buf: Buffer;
    try {
      buf = await fs.readFile(thumbPath);
    } catch {
      return NextResponse.json({ error: "Miniature manquante" }, { status: 404 });
    }

    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[GET /api/files/:id/thumb] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
