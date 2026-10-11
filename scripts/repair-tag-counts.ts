// MyBoard — Script de réparation des compteurs de tags (postCount).
//
// PROBLÈME : la route bulk-delete utilise le cascade Prisma (onDelete: Cascade)
// qui supprime les MediaTag SANS décrémenter postCount. Après plusieurs cycles
// import/suppression, les postCount sont complètement faux.
//
// CE SCRIPT :
// 1. Compte le nombre réel de MediaTag par tagId (groupBy, 1 seule requête)
// 2. Met à jour postCount pour chaque tag
// 3. Supprime les tags orphelins (postCount réel = 0)
//
// Usage : bun run scripts/repair-tag-counts.ts

import { db } from "../src/lib/db";

async function main() {
  console.log("MyBoard — Réparation des compteurs de tags\n");

  // 1. Compte les MediaTag réels par tagId (1 seule requête groupBy)
  const counts = await db.mediaTag.groupBy({
    by: ["tagId"],
    _count: { tagId: true },
  });
  const countMap = new Map(counts.map((c) => [c.tagId, c._count.tagId]));

  // 2. Liste tous les tags
  const allTags = await db.tag.findMany({
    select: { id: true, name: true, postCount: true },
  });
  console.log(`→ ${allTags.length} tags en DB\n`);

  let fixed = 0;
  let deleted = 0;
  const changes: { name: string; before: number; after: number }[] = [];

  // 3. Identifie les corrections nécessaires
  const toDelete: number[] = [];
  const toUpdate: { id: number; count: number }[] = [];

  for (const tag of allTags) {
    const realCount = countMap.get(tag.id) ?? 0;
    if (realCount === 0) {
      toDelete.push(tag.id);
      deleted++;
      if (tag.postCount > 0) {
        changes.push({ name: tag.name, before: tag.postCount, after: 0 });
      }
    } else if (realCount !== tag.postCount) {
      toUpdate.push({ id: tag.id, count: realCount });
      fixed++;
      changes.push({ name: tag.name, before: tag.postCount, after: realCount });
    }
  }

  // 4. Batch delete des tags orphelins
  if (toDelete.length > 0) {
    await db.tag.deleteMany({ where: { id: { in: toDelete } } });
  }

  // 5. Batch update des postCount (transaction pour vitesse)
  if (toUpdate.length > 0) {
    await db.$transaction(
      toUpdate.map((u) =>
        db.tag.update({
          where: { id: u.id },
          data: { postCount: u.count },
        })
      )
    );
  }

  // 6. Rapport
  console.log("=== Résumé ===");
  console.log(`  Tags corrigés : ${fixed}`);
  console.log(`  Tags orphelins supprimés : ${deleted}`);
  console.log(`  Tags inchangés : ${allTags.length - fixed - deleted}`);
  console.log("");

  if (changes.length > 0) {
    console.log("=== Top 20 corrections ===");
    changes
      .sort((a, b) => Math.abs(b.before - b.after) - Math.abs(a.before - a.after))
      .slice(0, 20)
      .forEach((s) => {
        const diff = s.after - s.before;
        const sign = diff > 0 ? "+" : "";
        console.log(
          `  ${s.name.padEnd(35)} ${String(s.before).padStart(5)} → ${String(s.after).padStart(5)} (${sign}${diff})`
        );
      });
    if (changes.length > 20) {
      console.log(`  ... et ${changes.length - 20} autres`);
    }
  }

  // 7. Vérification finale
  const totalMedia = await db.media.count();
  const totalTags = await db.tag.count();
  const totalMediaTag = await db.mediaTag.count();
  console.log("\n=== État final ===");
  console.log(`  Media: ${totalMedia}`);
  console.log(`  Tags: ${totalTags}`);
  console.log(`  MediaTag: ${totalMediaTag}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error("Erreur fatale:", e);
  process.exit(1);
});
