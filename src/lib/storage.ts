// MyBoard — stockage des fichiers sur disque.
//
// PROBLÈME : à 120k+ médias, un dossier unique `originals/` contenant 120k
// fichiers tue l'explorateur Windows/macOS (indexation/preview en rafale).
//
// SOLUTION : sharding par préfixe du hash SHA-256.
//   originals/87/298845...jpg   (2 premiers chars hex = 256 sous-dossiers)
//   thumbs/87/298845....jpg     (idem)
// À 120k fichiers → ~470 fichiers par sous-dossier → fluide partout.
// C'est la même approche que Git (.git/objects/), Hydrus, Docker, etc.

import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";

// Racine de la bibliothèque (résolue à l'import).
// En dev Next.js, cwd = racine du projet.
export const LIB_DIR = path.resolve(process.cwd(), "library");
export const ORIG_DIR = path.join(LIB_DIR, "originals");
export const THUMB_DIR = path.join(LIB_DIR, "thumbs");

/** Découpe un hash en (préfixe 2 chars, reste) pour le sharding. */
export function shardParts(sha256: string): { prefix: string; rest: string } {
  const h = sha256.toLowerCase();
  return { prefix: h.slice(0, 2), rest: h.slice(2) };
}

/** Chemin relatif (stockable en base) d'un original : `originals/87/rest.ext`. */
export function relOriginalPath(sha256: string, ext: string): string {
  const { prefix, rest } = shardParts(sha256);
  const e = ext.startsWith(".") ? ext : `.${ext}`;
  return path.posix.join("originals", prefix, `${rest}${e}`);
}

/** Chemin relatif d'une miniature : `thumbs/87/rest.jpg`. */
export function relThumbPath(sha256: string): string {
  const { prefix, rest } = shardParts(sha256);
  return path.posix.join("thumbs", prefix, `${rest}.jpg`);
}

/** Chemin absolu d'un original. */
export function absOriginalPath(sha256: string, ext: string): string {
  return path.join(LIB_DIR, relOriginalPath(sha256, ext));
}

/** Chemin absolu d'une miniature. */
export function absThumbPath(sha256: string): string {
  return path.join(LIB_DIR, relThumbPath(sha256));
}

/** Résout un chemin relatif stocké en base vers un chemin absolu. */
export function resolveStoredPath(rel: string): string {
  if (path.isAbsolute(rel)) return rel;
  return path.join(LIB_DIR, rel);
}

/** S'assure que les dossiers de stockage (et le sous-dossier sharded) existent. */
export async function ensureStorageDirs(): Promise<void> {
  await fs.mkdir(ORIG_DIR, { recursive: true });
  await fs.mkdir(THUMB_DIR, { recursive: true });
}

/** Crée le sous-dossier shardé pour un hash donné (originals + thumbs). */
export async function ensureShardDirs(sha256: string): Promise<void> {
  const { prefix } = shardParts(sha256);
  await fs.mkdir(path.join(ORIG_DIR, prefix), { recursive: true });
  await fs.mkdir(path.join(THUMB_DIR, prefix), { recursive: true });
}

/** Vérifie qu'un fichier existe (synchrone, pour les routes de streaming). */
export function fileExists(absPath: string): boolean {
  return existsSync(absPath);
}
