// MyBoard — Route API bulk-delete (P3.1, P3.2).
// Supprime plusieurs médias en parallèle (batch de 10) côté serveur.
// Supporte `keepFiles` pour ne supprimer que la DB (garder les fichiers sur disque).

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

  return NextResponse.json({
    ok: true,
    deleted,
    failed,
    errors: errors.slice(0, 20),
  });
}
