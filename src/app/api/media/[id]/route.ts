// GET /api/media/:id → MediaDetail (avec tags complets)
// DELETE /api/media/:id → supprime le média (fichier sur disque + ligne DB + tags détachés).

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

export async function DELETE(_req: Request, ctx: Ctx) {
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

    // 5. Supprime les fichiers sur disque (original + thumb) — best effort
    if (media.storage === "local") {
      const origPath = absOriginalPath(media.sha256, media.ext);
      await fs.rm(origPath, { force: true }).catch(() => {});
      if (media.hasThumb) {
        const thumbPath = absThumbPath(media.sha256);
        await fs.rm(thumbPath, { force: true }).catch(() => {});
        // Nettoie les dossiers shardés vides éventuels (best effort)
        try {
          const dir = path.dirname(thumbPath);
          const files = await fs.readdir(dir);
          if (files.length === 0) await fs.rmdir(dir).catch(() => {});
        } catch {}
      }
    }

    // Référence unused (resolveStoredPath) — pour usage futur (storage custom)
    void resolveStoredPath;

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[DELETE /api/media/:id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
