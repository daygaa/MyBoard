// MyBoard — seed des images de démonstration.
//
// Importe les 10 fichiers JPG de /home/z/my-project/demo_assets/ dans la
// bibliothèque locale : hash → copyToStorage → makeThumb → INSERT Media →
// attache des tags prédéfinis selon le nom de fichier.
//
// Idempotent : détecte les doublons via sha256 (déjà en DB → skip).

import path from "node:path";
import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { db } from "./db";
import { ensureStorageDirs } from "./storage";
import {
  copyToStorage,
  fileSize,
  imageSize,
  makeThumb,
  sha256File,
} from "./media-processing";
import { attachTag, getOrCreateTag, normalizeTag } from "./tag-helpers";
import { kindFromExt, mimeFromExt } from "./shared";

const DEMO_DIR = path.resolve(process.cwd(), "demo_assets");

/** Tag d'attach pour la démo. */
type SeedTag = { name: string; category?: string };

/** Règles de tags par pattern sur le nom de fichier. */
const TAG_RULES: { match: RegExp; tags: SeedTag[] }[] = [
  {
    match: /^chat/i,
    tags: [
      { name: "animal" },
      { name: "cat" },
    ],
  },
  {
    match: /^fleur/i,
    tags: [
      { name: "nature" },
      { name: "flower" },
      { name: "macro" },
    ],
  },
  {
    match: /^montagne/i,
    tags: [
      { name: "nature" },
      { name: "landscape" },
      { name: "mountain" },
      { name: "snow" },
    ],
  },
  {
    match: /^plage/i,
    tags: [
      { name: "nature" },
      { name: "landscape" },
      { name: "beach" },
      { name: "sea" },
    ],
  },
  {
    match: /^portrait/i,
    tags: [
      { name: "portrait" },
      { name: "person" },
    ],
  },
  {
    match: /^fox/i,
    tags: [
      { name: "animal" },
      { name: "fox" },
      { name: "nature" },
      { name: "snow" },
      { name: "winter" },
    ],
  },
  {
    match: /^neon_city/i,
    tags: [
      { name: "city" },
      { name: "night" },
      { name: "neon" },
      { name: "cyberpunk", category: "copyright" },
    ],
  },
  {
    match: /^ramen/i,
    tags: [
      { name: "food" },
      { name: "ramen" },
      { name: "top_down" },
    ],
  },
  {
    match: /^still_life/i,
    tags: [
      { name: "still_life" },
      { name: "minimalist", category: "meta" },
      { name: "interior" },
    ],
  },
  {
    match: /^astronaut/i,
    tags: [
      { name: "space" },
      { name: "astronaut" },
      { name: "earth" },
    ],
  },
  {
    match: /^abstract/i,
    tags: [
      { name: "abstract" },
      { name: "golden", category: "meta" },
    ],
  },
];

/** Les fichiers _v3 sont marqués "ai_generated" (catégorie meta). */
function isV3(filename: string): boolean {
  return /_v3\./i.test(filename);
}

/** Tags "méta" courants côté booru (à catégoriser comme meta, pas general). */
const META_TAGS = new Set([
  "highres", "absurdres", "lowres", "incredibly_absurdres", "huge_filesize",
  "scaled", "sample", "png", "jpeg", "jpg", "gif", "webp", "animated_gif",
  "ai_generated", "translation_request", "commentary_request", "commentary",
  "duplicate", "variant_set", "metadata", "request", "tagme", "artist_request",
  "character_request", "copyright_request", "bad_link", "bad_source", "no_sound",
]);

/** Tags qui signalent un média "œuvre d'art" — catégorisés artist. */
const ARTIST_HINTS = /^(.*)_\(artist\)$/;

/** Charge les tags depuis le fichier .json à côté de l'image (format Safebooru).
 *  Renvoie null si pas de JSON (fichiers démo classiques). */
function loadSafebooruTags(imgPath: string): SeedTag[] | null {
  const jsonPath = imgPath.replace(/\.(jpe?g|png|webp|gif)$/i, ".json");
  if (!existsSync(jsonPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));
    if (!raw.tags || typeof raw.tags !== "string") return null;
    const tagNames = (raw.tags as string)
      .split(/\s+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (tagNames.length === 0) return null;
    // On limite à ~25 tags par image pour éviter l'explosion (certaines images
    // safebooru en ont 60+). On garde les plus "informatifs" en priorité.
    const limited = tagNames.slice(0, 25).map((name) => {
      let category: string | undefined;
      if (META_TAGS.has(name)) category = "meta";
      // Safebooru ne catégorise pas dans l'API publique (tout est "general"),
      // donc on applique une heuristique simple : les tags commençant par
      // un nom avec parenthèses type "ange_katrina_(9th_costume)" restent general.
      return { name, category };
    });
    // Tag spécial pour identifier la provenance.
    limited.push({ name: "safebooru", category: "meta" });
    return limited;
  } catch {
    return null;
  }
}

/** Tags pour un fichier donné (basé sur son nom + JSON sidecar éventuel). */
function tagsForFile(filename: string, fullPath?: string): SeedTag[] {
  // 1. Si on a un JSON Safebooru à côté → on l'utilise (tags réels booru).
  if (fullPath) {
    const sb = loadSafebooruTags(fullPath);
    if (sb && sb.length > 0) return sb;
  }
  // 2. Sinon, règles par pattern (fichiers démo originaux).
  const base = path.basename(filename).toLowerCase();
  const tags: SeedTag[] = [];
  for (const rule of TAG_RULES) {
    if (rule.match.test(base)) {
      tags.push(...rule.tags);
      break; // un seul pattern matche (chat|fleur|montagne|plage|portrait)
    }
  }
  if (isV3(filename)) {
    tags.push({ name: "ai_generated", category: "meta" });
  }
  return tags;
}

export type SeedResult = {
  seeded: number;
  skipped: number;
  total: number;
};

/** Vérifie si la démo a déjà été seedée (toutes les images présentes en DB). */
export async function seedStatus(): Promise<{ seeded: boolean; count: number }> {
  const knownHashes = new Set<string>();
  // Liste les fichiers attendus et calcule leurs hashes (en parallèle)
  const files = await listDemoFiles();
  if (files.length === 0) return { seeded: false, count: 0 };
  const hashes = await Promise.all(files.map((f) => sha256File(f).catch(() => null)));
  for (const h of hashes) if (h) knownHashes.add(h);

  const count = await db.media.count({
    where: { sha256: { in: [...knownHashes] } },
  });
  return { seeded: count === files.length, count };
}

/** Liste tous les fichiers de démo (images seulement).
 *  Scanne demo_assets/ à plat (fichiers démo originaux) ET demo_assets/safebooru/
 *  (images téléchargées depuis l'API Safebooru avec leur .json sidecar). */
async function listDemoFiles(): Promise<string[]> {
  if (!existsSync(DEMO_DIR)) return [];
  const out: string[] = [];

  // 1. Fichiers à plat dans demo_assets/ (démo originale)
  const entries = await fs.readdir(DEMO_DIR);
  for (const f of entries) {
    const full = path.join(DEMO_DIR, f);
    const stat = await fs.stat(full);
    if (stat.isFile() && /\.(jpe?g|png|webp|gif)$/i.test(f)) {
      out.push(full);
    }
  }

  // 2. Sous-dossier demo_assets/safebooru/ (images fetch-ées)
  const sbDir = path.join(DEMO_DIR, "safebooru");
  if (existsSync(sbDir)) {
    const sbEntries = await fs.readdir(sbDir);
    for (const f of sbEntries) {
      const full = path.join(sbDir, f);
      const stat = await fs.stat(full);
      if (stat.isFile() && /\.(jpe?g|png|webp|gif)$/i.test(f)) {
        out.push(full);
      }
    }
  }

  return out.sort();
}

/**
 * Importe tous les fichiers de demo_assets/ en DB + storage.
 * Idempotent via sha256.
 */
export async function seedDemoAssets(): Promise<SeedResult> {
  await ensureStorageDirs();

  const files = await listDemoFiles();
  const total = files.length;
  if (total === 0) return { seeded: 0, skipped: 0, total: 0 };

  let seeded = 0;
  let skipped = 0;

  for (const file of files) {
    const filename = path.basename(file);
    const ext = path.extname(filename).toLowerCase();
    const kind = kindFromExt(ext);
    const mime = mimeFromExt(ext);

    // 1. sha256 (anti-doublon)
    const sha = await sha256File(file).catch(() => null);
    if (!sha) {
      console.error(`[seed] sha256 échoué pour ${filename}, skip`);
      skipped++;
      continue;
    }

    // 2. Skip si déjà en DB
    const existing = await db.media.findUnique({
      where: { sha256: sha },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    // 3. Copie vers storage shardé + thumb
    try {
      await copyToStorage(file, sha, ext);
    } catch (e) {
      console.error(`[seed] copyToStorage échec ${filename}:`, e);
      skipped++;
      continue;
    }

    // 4. Miniature
    const thumbPath = await makeThumb(file, sha, ext, kind).catch(() => null);
    const hasThumb = !!thumbPath;

    // 5. Dimensions si image
    let width: number | null = null;
    let height: number | null = null;
    if (kind === "image") {
      const dims = await imageSize(file);
      if (dims) {
        width = dims.width;
        height = dims.height;
      }
    }

    // 6. INSERT Media
    const size = fileSize(file);
    const media = await db.media.create({
      data: {
        sha256: sha,
        originalName: filename,
        ext: ext.replace(/^\./, ""),
        mime,
        kind,
        size,
        width,
        height,
        storage: "local",
        hasThumb,
        source: "demo",
      },
    });

    // 7. Tags prédéfinis (depuis JSON sidecar Safebooru, ou règles par pattern)
    const tags = tagsForFile(filename, file);
    for (const t of tags) {
      const norm = normalizeTag(t.name);
      if (!norm) continue;
      const created = await getOrCreateTag(db, norm, t.category);
      await attachTag(db, media.id, created.id);
    }

    seeded++;
  }

  return { seeded, skipped, total };
}
