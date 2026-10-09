// GET /api/media/:id → MediaDetail (avec tags complets)
// DELETE /api/media/:id → supprime le média (DB + tags + fichiers disque).
//
// P3 — keepFiles : si `?keepFiles=true` (ou body JSON `{ keepFiles: true }`),
// supprime la ligne DB + MediaTag + décrémente tags, MAIS conserve les fichiers
// originaux + miniatures sur le disque (utile pour ré-importer plus tard).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mediaDetail, tagsForMedia } from "@/lib/tag-helpers";
import { absOriginalPath, absThumbPath, resolveStoredPath } from "@/lib/storage";
import fs from "node:fs/promises";
import path from "node:path";

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

    const detail = await mediaDetail(db, id);
    if (!detail) {
      return NextResponse.json({ error: "Média introuvable" }, { status: 404 });
    }
    // tagsForMedia déjà inclus dans mediaDetail mais on s'assure de l'ordre alpha
    const tags = await tagsForMedia(db, id);
    detail.tags = tags;

    return NextResponse.json(detail, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[GET /api/media/:id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * Lit `keepFiles` soit depuis l'URL query (?keepFiles=true), soit depuis un
 * body JSON ({keepFiles:true}). DELETE peut porter un body, mais certains
 * clients l'omettent — on accepte les deux.
 */
async function readKeepFiles(req: Request): Promise<boolean> {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("keepFiles") === "true") return true;
  } catch {
    /* URL mal formée : ignore */
  }
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const body = await req.json();
      if (body && typeof body.keepFiles === "boolean") return body.keepFiles;
    }
  } catch {
    /* body absent / invalide : ignore */
  }
  return false;
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }

    const keepFiles = await readKeepFiles(req);

    const media = await db.media.findUnique({
      where: { id },
      select: {
        id: true,
        sha256: true,
        ext: true,
        storage: true,
        remoteUrl: true,
        remoteThumbUrl: true,
        hasThumb: true,
      },
    });

    if (!media) {
      return NextResponse.json({ error: "Média introuvable" }, { status: 404 });
    }

    // 1. Liste des tags pour détacher (décrémenter postCount + nettoyer orphelins)
    const attachedTags = await db.mediaTag.findMany({
      where: { mediaId: id },
      select: { tagId: true },
    });

    // 2. Supprime les liens MediaTag (cascade par schema, mais on explicite)
    await db.mediaTag.deleteMany({ where: { mediaId: id } });

    // 3. Décrémente postCount des tags, supprime les orphelins
    for (const at of attachedTags) {
      const tag = await db.tag.findUnique({
        where: { id: at.tagId },
        select: { id: true, postCount: true },
      });
      if (!tag) continue;
      const newCount = Math.max(0, tag.postCount - 1);
      if (newCount === 0) {
        await db.tag.delete({ where: { id: tag.id } }).catch(() => {});
      } else {
        await db.tag.update({
          where: { id: tag.id },
          data: { postCount: newCount },
        });
      }
    }

    // 4. Supprime la ligne Media
    await db.media.delete({ where: { id } }).catch(() => {});

    // 5. Supprime les fichiers sur disque (original + thumb) — best effort.
    //    P3 : skip si keepFiles=true (on conserve les fichiers pour réimport).
    if (!keepFiles && media.storage === "local") {
      const origPath = absOriginalPath(media.sha256, media.ext);
      const thumbPath = absThumbPath(media.sha256);

      // fs.rm (async) pour ne pas bloquer l'event loop (P3.2).
      await Promise.all([
        fs.rm(origPath, { force: true }).catch(() => {}),
        media.hasThumb
          ? fs.rm(thumbPath, { force: true }).catch(() => {})
          : Promise.resolve(),
      ]);

      // Nettoie le dossier shardé thumbs s'il est vide (best effort)
      if (media.hasThumb) {
        try {
          const dir = path.dirname(thumbPath);
          const files = await fs.readdir(dir);
          if (files.length === 0) await fs.rmdir(dir).catch(() => {});
        } catch {
          /* ignore */
        }
      }
    }

    // Référence unused (resolveStoredPath) — pour usage futur (storage custom)
    void resolveStoredPath;

    return NextResponse.json({ ok: true, id, keepFiles });
  } catch (err) {
    console.error("[DELETE /api/media/:id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
