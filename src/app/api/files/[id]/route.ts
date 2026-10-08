// GET /api/files/:id
// Stream le fichier original. Support ?download → Content-Disposition: attachment.
// 404 si fichier manquant sur disque.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { absOriginalPath, resolveStoredPath } from "@/lib/storage";
import { createReadStream, promises as fs } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";

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

    const media = await db.media.findUnique({
      where: { id },
      select: {
        id: true,
        sha256: true,
        ext: true,
        mime: true,
        originalName: true,
        storage: true,
        remoteUrl: true,
        size: true,
      },
    });
    if (!media) {
      return NextResponse.json({ error: "Média introuvable" }, { status: 404 });
    }

    // Remote : redirige vers l'URL distante (si applicable)
    if (media.storage === "remote" && media.remoteUrl) {
      return NextResponse.redirect(media.remoteUrl, { status: 302 });
    }

    // Résolution du chemin absolu (storage relatif depuis la racine library/)
    const absPath = media.sha256
      ? absOriginalPath(media.sha256, media.ext)
      : resolveStoredPath("");

    let stat;
    try {
      stat = await fs.stat(absPath);
    } catch {
      return NextResponse.json({ error: "Fichier manquant" }, { status: 404 });
    }
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Chemin invalide" }, { status: 404 });
    }

    const url = new URL(req.url);
    const download = url.searchParams.has("download");
    const filename = media.originalName || path.basename(absPath);
    const filenameEnc = encodeURIComponent(filename)
      .replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

    const headers: Record<string, string> = {
      "Content-Type": media.mime || "application/octet-stream",
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${filenameEnc}`,
      "X-Content-Type-Options": "nosniff",
    };

    // HTTP Range request support (vidéos surtout)
    const range = req.headers.get("range");
    if (range) {
      const m = range.match(/bytes=(\d*)-(\d*)/);
      if (m) {
        let start = m[1] ? Number(m[1]) : 0;
        let end = m[2] ? Number(m[2]) : stat.size - 1;
        // Suffix range : bytes=-500 → 500 derniers octets
        if (!m[1] && m[2]) {
          start = Math.max(0, stat.size - Number(m[2]));
          end = stat.size - 1;
        }
        if (start >= stat.size || start > end) {
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${stat.size}` },
          });
        }
        end = Math.min(end, stat.size - 1);
        const stream = Readable.toWeb(
          createReadStream(absPath, { start, end })
        ) as ReadableStream<Uint8Array>;
        return new Response(stream, {
          status: 206,
          headers: {
            ...headers,
            "Content-Range": `bytes ${start}-${end}/${stat.size}`,
            "Content-Length": String(end - start + 1),
          },
        });
      }
    }

    // Full file streaming
    const stream = Readable.toWeb(createReadStream(absPath)) as ReadableStream<Uint8Array>;
    return new Response(stream, {
      headers: { ...headers, "Content-Length": String(stat.size) },
    });
  } catch (err) {
    console.error("[GET /api/files/:id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
