// MyBoard — hachage + miniatures.
// SHA-256 pour le content-addressing (anti-doublon exact).
// sharp pour les miniatures images (déjà en dépendance).
// ffmpeg pour les miniatures vidéos (subprocess).

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import sharp from "sharp";
import { ensureShardDirs, absOriginalPath, absThumbPath } from "./storage";

/** Hash SHA-256 d'un fichier (stream pour gros fichiers). */
export function sha256File(p: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    const stream = fs.createReadStream(p, { highWaterMark: 1 << 20 });
    stream.on("data", (chunk) => h.update(chunk));
    stream.on("end", () => resolve(h.digest("hex")));
    stream.on("error", reject);
  });
}

/** Dimensions d'une image via sharp (pas de décodage complet). */
export async function imageSize(p: string): Promise<{ width: number; height: number } | null> {
  try {
    const meta = await sharp(p).metadata();
    if (meta.width && meta.height) return { width: meta.width, height: meta.height };
    return null;
  } catch {
    return null;
  }
}

/** Durée d'une vidéo via ffprobe (seconds). */
export function videoDuration(p: string): Promise<number | null> {
  return new Promise((resolve) => {
    const ff = which("ffprobe");
    if (!ff) return resolve(null);
    const proc = spawn(ff, [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      p,
    ]);
    let out = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.on("close", () => {
      const n = parseFloat(out.trim());
      resolve(isFinite(n) ? n : null);
    });
    proc.on("error", () => resolve(null));
  });
}

/**
 * Génère une miniature JPEG (max 420×420) pour un fichier donné.
 * - Images : sharp (redimensionne + convertit en JPEG q85).
 * - Vidéos : ffmpeg (première frame, scale 420 de large).
 * - Autres : placeholder SVG → JPEG.
 * Renvoie le chemin absolu de la miniature, ou null si échec.
 */
export async function makeThumb(
  srcPath: string,
  sha256: string,
  ext: string,
  kind: string
): Promise<string | null> {
  await ensureShardDirs(sha256);
  const dest = absThumbPath(sha256);

  try {
    if (kind === "image") {
      await sharp(srcPath)
        .rotate() // respecte EXIF orientation
        .resize(420, 420, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toFile(dest);
      return dest;
    }

    if (kind === "video") {
      const ff = which("ffmpeg");
      if (!ff) return makePlaceholder(dest, ext);
      return new Promise((resolve) => {
        const proc = spawn(ff, [
          "-y", "-i", srcPath,
          "-frames:v", "1",
          "-vf", "scale=420:-1",
          "-q:v", "3",
          dest,
        ]);
        proc.on("close", () => {
          if (fs.existsSync(dest) && fs.statSync(dest).size > 0) resolve(dest);
          else resolve(makePlaceholder(dest, ext));
        });
        proc.on("error", () => resolve(makePlaceholder(dest, ext)));
      });
    }

    // Document / archive / audio → placeholder
    return makePlaceholder(dest, ext);
  } catch {
    return makePlaceholder(dest, ext);
  }
}

/** Placeholder visuel pour les fichiers sans miniature (icône + extension). */
async function makePlaceholder(dest: string, ext: string): Promise<string> {
  const e = ext.replace(/^\./, "").toUpperCase().slice(0, 5);
  // SVG simple → JPEG via sharp
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">
       <rect width="420" height="420" fill="#16181d"/>
       <rect x="1" y="1" width="418" height="418" fill="none" stroke="#2a2c33" stroke-width="2"/>
       <text x="210" y="225" font-family="monospace" font-size="56" font-weight="700"
             fill="#6b6d76" text-anchor="middle">${e}</text>
     </svg>`
  );
  try {
    await sharp(svg).jpeg({ quality: 85 }).toFile(dest);
  } catch {
    // fallback ultime : fichier vide créé à la main
    fs.writeFileSync(dest, Buffer.alloc(0));
  }
  return dest;
}

/** Helper : quel binaire utiliser (PATH ou chemin explicite). */
function which(bin: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execSync } = require("node:child_process");
    const p = execSync(`which ${bin} 2>/dev/null || command -v ${bin} 2>/dev/null`, {
      encoding: "utf-8",
    }).trim();
    return p || null;
  } catch {
    return null;
  }
}

/** Copie un fichier source vers son emplacement shardé définitif. */
export async function copyToStorage(
  srcPath: string,
  sha256: string,
  ext: string
): Promise<string> {
  await ensureShardDirs(sha256);
  const dest = absOriginalPath(sha256, ext);
  await fs.promises.copyFile(srcPath, dest, fs.constants.COPYFILE_FICLONE);
  return dest;
}

/** Calcule la taille (bytes) d'un fichier. */
export function fileSize(p: string): number {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}
