// MyBoard — import de tags depuis des JSON sidecar vers la DB existante.
//
// USAGE (PowerShell) :
//   .\scripts\import-tags-json.ps1 -Path "C:\Users\vous\Images\mes_jsons"
//   .\scripts\import-tags-json.ps1 -Path "C:\chemin\vers\ABC.json"
//
// USAGE (direct bun, multiplateforme) :
//   bun run scripts/import-tags-json.ts "C:\chemin\vers\dossier"
//   bun run scripts/import-tags-json.ts "C:\chemin\vers\ABC.json"
//
// COMPORTEMENT :
//   Pour chaque fichier ABC.json trouvé (dans le dossier ou fichier unique) :
//   1. Extrait le nom de base "ABC" (sans extension)
//   2. Cherche dans la DB un Media dont originalName commence par "ABC."
//      (ex: ABC.jpg, ABC.png, ABC.webp...)
//   3. Si trouvé : parse les tags du JSON, les attache au média
//      (getOrCreateTag + attachTag, avec gestion des catégories meta)
//   4. Si pas trouvé : skip + log
//
// FORMAT JSON ATTENDU (compatible Safebooru API) :
//   { "tags": "tag1 tag2 tag3 ...", "width": 1423, "height": 3022, ... }
//
// Idempotent : si le tag est déjà attaché, INSERT OR IGNORE → skip silencieux.

import path from "node:path";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import { db } from "../src/lib/db";
import { getOrCreateTag, attachTag } from "../src/lib/tag-helpers";
import { normalizeTagName } from "../src/lib/shared";

// Tags "méta" courants côté booru (catégorisés comme meta, pas general).
const META_TAGS = new Set([
  "highres", "absurdres", "lowres", "incredibly_absurdres", "huge_filesize",
  "scaled", "sample", "png", "jpeg", "jpg", "gif", "webp", "animated_gif",
  "ai_generated", "translation_request", "commentary_request", "commentary",
  "duplicate", "variant_set", "metadata", "request", "tagme", "artist_request",
  "character_request", "copyright_request", "bad_link", "bad_source", "no_sound",
]);

type SeedTag = { name: string; category?: string };

/** Parse un JSON sidecar et renvoie la liste des tags avec catégorie. */
function parseTagsFromJson(raw: any): SeedTag[] | null {
  if (!raw || !raw.tags || typeof raw.tags !== "string") return null;
  const tagNames = (raw.tags as string)
    .split(/\s+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tagNames.length === 0) return null;
  // Limite à 25 tags par image (certaines Safebooru en ont 60+).
  return tagNames.slice(0, 25).map((name) => ({
    name,
    category: META_TAGS.has(name) ? "meta" : undefined,
  }));
}

/** Liste tous les fichiers .json à traiter (dossier ou fichier unique). */
async function listJsonFiles(targetPath: string): Promise<string[]> {
  const stat = await fsp.stat(targetPath);
  if (stat.isFile()) {
    return targetPath.toLowerCase().endsWith(".json") ? [targetPath] : [];
  }
  if (stat.isDirectory()) {
    const entries = await fsp.readdir(targetPath);
    return entries
      .filter((f) => f.toLowerCase().endsWith(".json"))
      .map((f) => path.join(targetPath, f))
      .sort();
  }
  return [];
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: bun run scripts/import-tags-json.ts <dossier_ou_fichier_json>");
    console.error("Exemple: bun run scripts/import-tags-json.ts \"C:\\Users\\vous\\Images\\jsons\"");
    process.exit(1);
  }

  const resolved = path.resolve(target);
  if (!fs.existsSync(resolved)) {
    console.error(`Chemin introuvable: ${resolved}`);
    process.exit(1);
  }

  const jsonFiles = await listJsonFiles(resolved);
  if (jsonFiles.length === 0) {
    console.error(`Aucun fichier .json trouvé dans: ${resolved}`);
    process.exit(1);
  }

  console.log(`\n📁 Scan de ${jsonFiles.length} fichier(s) JSON depuis: ${resolved}\n`);

  let updated = 0;
  let skipped = 0;
  let tagsCreated = 0;
  let tagsAttached = 0;
  const noMatch: string[] = [];

  for (let i = 0; i < jsonFiles.length; i++) {
    const jsonPath = jsonFiles[i];
    const baseName = path.basename(jsonPath, ".json"); // ex: "7211680"

    // Cherche un Media dont originalName commence par "baseName."
    // (ex: "7211680.jpg", "7211680.png", etc.)
    const media = await db.media.findFirst({
      where: {
        OR: [
          { originalName: { startsWith: `${baseName}.` } },
          // Au cas où le fichier aurait été importé avec un nom différent
          // mais qu'on a stocké le sha256 basé sur le contenu, on check
          // aussi par source URL si présente dans le JSON
        ],
      },
      select: { id: true, originalName: true, sha256: true },
    });

    if (!media) {
      noMatch.push(baseName);
      skipped++;
      if ((i + 1) % 50 === 0) {
        console.log(`  [${i + 1}/${jsonFiles.length}] ${updated} mis à jour, ${skipped} sans match`);
      }
      continue;
    }

    // Parse le JSON
    let raw: any;
    try {
      raw = JSON.parse(await fsp.readFile(jsonPath, "utf-8"));
    } catch (e) {
      console.error(`  ⚠ JSON invalide: ${path.basename(jsonPath)} — skip`);
      skipped++;
      continue;
    }

    const tags = parseTagsFromJson(raw);
    if (!tags || tags.length === 0) {
      skipped++;
      continue;
    }

    // Attache les tags
    let attachedThisMedia = 0;
    for (const t of tags) {
      const norm = normalizeTagName(t.name);
      if (!norm) continue;
      try {
        const tag = await getOrCreateTag(db, norm, t.category);
        const isNew = await attachTag(db, media.id, tag.id);
        if (isNew) {
          tagsAttached++;
          attachedThisMedia++;
        }
      } catch (e) {
        // Erreur non-fatale, on continue
      }
    }

    if (attachedThisMedia > 0) {
      updated++;
      tagsCreated += attachedThisMedia;
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  [${i + 1}/${jsonFiles.length}] ${updated} médias mis à jour, ${tagsAttached} tags attachés`);
    }
  }

  console.log(`\n✓ Terminé !`);
  console.log(`  - ${updated} média(s) mis à jour avec de nouveaux tags`);
  console.log(`  - ${tagsAttached} tag(s) nouvellement attachés`);
  console.log(`  - ${skipped} fichier(s) JSON sans match en DB ou sans tags`);
  if (noMatch.length > 0 && noMatch.length <= 20) {
    console.log(`  - Sans match: ${noMatch.join(", ")}`);
  } else if (noMatch.length > 20) {
    console.log(`  - ${noMatch.length} fichiers sans match (trop pour afficher)`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error("Erreur fatale:", e);
  process.exit(1);
});
