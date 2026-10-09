// MyBoard — hachage + miniatures.
// SHA-256 pour le content-addressing (anti-doublon exact).
// sharp pour les miniatures images (déjà en dépendance).
// ffmpeg pour les miniatures vidéos (subprocess).

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import sharp from "sharp";
import { ensureShardDirs, absOriginalPath, absThumbPath } from "./storage";

/** Cache pour éviter de repérer ffmpeg/ffprobe à chaque appel. */
const binCache = new Map<string, string | null>();

/**
 * Localise un binaire (ffmpeg / ffprobe) sur le système.
 * Stratégie (dans l'ordre) :
 *  1. `which <bin>` (POSIX)
 *  2. `command -v <bin>` (fallback POSIX)
 *  3. Recherche explicite dans les chemins courants (Linux/macOS/Windows)
 *  4. Si toujours KO → renvoie null et le caller fait un fallback placeholder.
 */
function which(bin: string): string | null {
  if (binCache.has(bin)) return binCache.get(bin) ?? null;
  let found: string | null = null;

  // 1 & 2 — which / command -v via sh
  try {
    const p = execSync(`which ${bin} 2>/dev/null || command -v ${bin} 2>/dev/null`, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (p && fs.existsSync(p)) found = p;
  } catch {
    // ignore
  }

  // 3 — chemins courants (utile quand le serveur tourne sans PATH utilisateur)
  if (!found) {
    const candidates = [
      "/usr/bin/" + bin,
      "/usr/local/bin/" + bin,
      "/opt/homebrew/bin/" + bin,
      "/snap/bin/" + bin,
      // Windows (Git Bash / Scoop)
      `C:\\Program Files\\ffmpeg\\bin\\${bin}.exe`,
    ];
    for (const c of candidates) {
      try {
        if (fs.existsSync(c)) {
          found = c;
          break;
        }
      } catch {
        // ignore
      }
    }
  }

  if (found) {
    binCache.set(bin, found);
    return found;
  }
  console.warn(`[myboard] binaire « ${bin} » introuvable — fallback activé`);
  binCache.set(bin, null);
  return null;
}

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
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", () => {
      const n = parseFloat(out.trim());
      if (!isFinite(n) && stderr) {
        console.warn(`[myboard] ffprobe échoué pour ${path.basename(p)}: ${stderr.split("\n").slice(-2).join(" | ").trim()}`);
      }
      resolve(isFinite(n) ? n : null);
    });
    proc.on("error", () => resolve(null));
  });
}

/**
 * Génère une miniature JPEG (max 420×420) pour un fichier donné.
 * - Images : sharp (redimensionne + convertit en JPEG q85).
 * - Vidéos : ffmpeg (première frame, scale 420 de large).
 *   Commande : ffmpeg -y -i input -frames:v 1 -vf scale=420:-1 -q:v 3 -update 1 output.jpg
 *   Le flag `-update 1` est OBLIGATOIRE pour ffmpeg 7+ (sinon warning
 *   « specified filename does not contain an image sequence pattern »).
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
      if (!ff) {
        console.warn(`[myboard] ffmpeg introuvable — placeholder utilisé pour ${path.basename(srcPath)}`);
        return makePlaceholder(dest, ext);
      }
      return new Promise((resolve) => {
        // -update 1 : indispensable pour ffmpeg 7+ (élimine le warning image2).
        const proc = spawn(ff, [
          "-y",
          "-i", srcPath,
          "-frames:v", "1",
          "-vf", "scale=420:-1",
          "-q:v", "3",
          "-update", "1",
          dest,
        ], { stdio: ["ignore", "pipe", "pipe"] });
        let stderr = "";
        proc.stderr.on("data", (d: Buffer) => {
          stderr += d.toString();
        });
        proc.on("close", (code) => {
          if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
            resolve(dest);
          } else {
            const tail = stderr.split("\n").slice(-3).join(" | ").trim();
            console.warn(`[myboard] ffmpeg échoué (exit ${code}) pour ${path.basename(srcPath)}${tail ? ` : ${tail}` : ""}`);
            resolve(makePlaceholder(dest, ext));
          }
        });
        proc.on("error", () => {
          console.warn(`[myboard] ffmpeg spawn échoué pour ${path.basename(srcPath)}`);
          resolve(makePlaceholder(dest, ext));
        });
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
