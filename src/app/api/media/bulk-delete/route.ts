// MyBoard — Route API bulk-delete (P3.1, P3.2, A2).
// Supprime plusieurs médias en parallèle (batch de 10) côté serveur.
// Supporte `keepFiles` pour ne supprimer que la DB (garder les fichiers sur disque).
//
// A2 FIX : décrémenter postCount des tags AVANT de supprimer les MediaTag
// (sinon le cascade Prisma supprime les MediaTag sans mettre à jour postCount,
// ce qui corrompt les compteurs après plusieurs cycles import/suppression).

import { NextResponse } from "next/server";
import { z } from "zod";
import fs from "node:fs/promises";
import { db } from "@/lib/db";
import { absOriginalPath, absThumbPath } from "@/lib/storage";

const Body = z.object({
  ids: z.array(z.number()).min(1).max(10000),
  keepFiles: z.boolean().optional().default(false),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
  }

  const { ids, keepFiles } = parsed;
  let deleted = 0;
  let failed = 0;
  const errors: { id: number; error: string }[] = [];

  // Récupère les médias AVANT suppression (pour connaître sha256 + ext)
  const medias = await db.media.findMany({
    where: { id: { in: ids } },
    select: { id: true, sha256: true, ext: true },
  });
  const mediaMap = new Map(medias.map((m) => [m.id, m]));

  // A2 FIX : récupère tous les tagIds attachés à ces médias AVANT suppression
  const allMediaTags = await db.mediaTag.findMany({
    where: { mediaId: { in: ids } },
    select: { tagId: true },
  });
  const tagIdCounts = new Map<number, number>();
  for (const mt of allMediaTags) {
    tagIdCounts.set(mt.tagId, (tagIdCounts.get(mt.tagId) ?? 0) + 1);
  }

  // Batch de 10 pour éviter de surcharger le serveur
  const BATCH = 10;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (id) => {
        const m = mediaMap.get(id);
        if (!m) throw new Error("Média introuvable");
        // 1. Supprime de la DB (MediaTag + MediaGroup + Favorite sont cascade)
        await db.media.delete({ where: { id } });
        // 2. Supprime les fichiers sur disque (sauf si keepFiles)
        if (!keepFiles) {
          const fp = absOriginalPath(m.sha256, "." + m.ext);
          await fs.unlink(fp).catch(() => {});
          const tp = absThumbPath(m.sha256);
          await fs.unlink(tp).catch(() => {});
        }
      })
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled") deleted++;
      else {
        failed++;
        errors.push({ id: batch[j], error: r.reason?.message ?? "unknown" });
      }
    }
  }

  // A2 FIX : décrémente postCount pour chaque tag touché + supprime orphelins
  // On le fait APRÈS la suppression (les MediaTag sont déjà cascade-deleted)
  // mais on utilise les counts collectés avant.
  const tagIds = [...tagIdCounts.keys()];
  if (tagIds.length > 0) {
    await db.$transaction(
      tagIds.map((tagId) => {
        const decrement = tagIdCounts.get(tagId) ?? 0;
        return db.tag.update({
          where: { id: tagId },
          data: { postCount: { decrement } },
        });
      })
    );
    // Supprime les tags devenus orphelins (postCount <= 0)
    await db.tag.deleteMany({
      where: { id: { in: tagIds }, postCount: { lte: 0 } },
    }).catch(() => {});
    // Clamp les postCount négatifs à 0 (au cas où)
    await db.tag.updateMany({
      where: { id: { in: tagIds }, postCount: { lt: 0 } },
      data: { postCount: 0 },
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    deleted,
    failed,
    errors: errors.slice(0, 20),
  });
}
