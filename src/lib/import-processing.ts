// MyBoard — logique de processing des uploads (côté serveur uniquement).
//
// Pipeline :
//   1. Sauvegarde temporaire dans /tmp/myboard-import/<uuid>.<ext>
//   2. sha256File (anti-doublon content-addressed)
//   3. Si doublon en DB → skip + log
//   4. Sinon, transformations optionnelles :
//      - convertImageFormat (sharp) — convertit l'image vers jpg/png/webp/avif/heif/jfif
//        (la qualité jpegQuality s'applique au format cible)
//      - compressImages (sharp) — ré-encode dans le format d'origine à la qualité choisie
//      - transcodeVideo (ffmpeg) — transcode vers mp4-h264 / mp4-h265 / webm / av1
//        avec le CRF mappé depuis videoQuality (0-4)
//   5. copyToStorage (original ou transformé)
//   6. makeThumb (sharp image / ffmpeg vidéo / placeholder) — toujours actif
//   7. INSERT Media + attachTag(defaultTags)
//   8. Cleanup fichiers temporaires

import path from "node:path";
import fs from "node:fs";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn, execSync } from "node:child_process";
import sharp from "sharp";
import { Readable } from "node:stream";
import { db } from "./db";
import { ensureStorageDirs } from "./storage";
import {
  copyToStorage,
  fileSize,
  imageSize,
  makeThumb,
  sha256File,
  videoDuration,
} from "./media-processing";
import { attachTag, getOrCreateTag, normalizeTag } from "./tag-helpers";
import { kindFromExt, mimeFromExt } from "./shared";

// Dossier temporaire pour les fichiers en cours de traitement.
// Nettoyé à la fin de processUpload (chaque fichier est unlinké).
const TMP_DIR = "/tmp/myboard-import";

// ---------------------------------------------------------------------------
// Types exposés
// ---------------------------------------------------------------------------

/** Tag par défaut à attacher à chaque média importé. */
export type DefaultTag = {
  name: string;
  category: string;
};

/** Options d'import passées par l'UI. */
export type ImportOptions = {
  /** Ré-encoder JPEG/PNG/WebP à la qualité choisie (20-95). */
  compressImages: boolean;
  /** Qualité d'encodage (20-95). Utilisée par compression ET conversion image. */
  jpegQuality: number;
  /** Format cible pour la conversion d'image : jpg|png|webp|avif|heif|jfif, ou null = pas de conversion. */
  convertImageFormat: string | null;
  /** Activer le transcodage vidéo. */
  transcodeVideo: boolean;
  /** Format cible vidéo : mp4-h264|mp4-h265|webm|av1. */
  videoFormat: string;
  /** Indice de qualité vidéo (0-4 : minimale/basse/moyenne/haute/maximale). */
  videoQuality: number;
  /** Tags à attacher au média, avec leur catégorie. */
  defaultTags: DefaultTag[];
};

export type ImportFileStatus = "imported" | "duplicate" | "error";

/** Type de transformation appliquée (pour affichage UI). */
export type TransformKind = "webp" | "compressed" | "video" | null;

/** Résultat du traitement d'un fichier. */
export type ImportFileResult = {
  file: string;
  status: ImportFileStatus;
  sha?: string;
  id?: number;
  size?: number; // taille finale (post-transformation)
  originalSize?: number; // taille originale (avant transformation)
  thumbGenerated?: boolean;
  transformed?: boolean;
  transformKind?: TransformKind;
  warning?: string;
  error?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** S'assure que le dossier tmp existe. */
async function ensureTmpDir(): Promise<void> {
  await fs.promises.mkdir(TMP_DIR, { recursive: true });
}

/** Localise un binaire (ffmpeg / ffprobe) sur le PATH. */
function which(bin: string): string | null {
  try {
    const p = execSync(`which ${bin} 2>/dev/null || command -v ${bin} 2>/dev/null`, {
      encoding: "utf-8",
    }).trim();
    return p || null;
  } catch {
    return null;
  }
}

/** Clamp numérique dans [min, max]. */
function clamp(v: number, min: number, max: number): number {
  const n = Number.isFinite(v) ? v : min;
  return Math.max(min, Math.min(max, n));
}

/** Normalise un nom de catégorie entrant vers une valeur valide en DB. */
function sanitizeCategory(raw: unknown): string {
  if (typeof raw !== "string") return "general";
  const v = raw.trim().toLowerCase();
  const allowed = ["copyright", "character", "artist", "general", "meta"];
  return allowed.includes(v) ? v : "general";
}

// ---------------------------------------------------------------------------
// Configurations de transcodage vidéo
// ---------------------------------------------------------------------------

type VideoFormatConfig = {
  /** Extension de sortie (avec le point). */
  ext: string;
  /** MIME de sortie. */
  mime: string;
  /** Codec vidéo ffmpeg. */
  vcodec: "libx264" | "libx265" | "libvpx-vp9" | "libaom-av1";
  /** Codec audio ffmpeg. */
  acodec: "aac" | "libopus";
  /** Args supplémentaires (pix_fmt, faststart, etc.). */
  extraArgs?: string[];
  /** Preset ffmpeg (medium / fast / slow…). */
  preset: string;
};

const VIDEO_FORMAT_CONFIG: Record<string, VideoFormatConfig> = {
  "mp4-h264": {
    ext: ".mp4",
    mime: "video/mp4",
    vcodec: "libx264",
    acodec: "aac",
    extraArgs: ["-pix_fmt", "yuv420p", "-movflags", "+faststart"],
    preset: "medium",
  },
  "mp4-h265": {
    ext: ".mp4",
    mime: "video/mp4",
    vcodec: "libx265",
    acodec: "aac",
    // -tag:v hvc1 → compatible avec QuickTime / Windows HEVC extensions
    extraArgs: ["-tag:v", "hvc1", "-pix_fmt", "yuv420p", "-movflags", "+faststart"],
    preset: "medium",
  },
  webm: {
    ext: ".webm",
    mime: "video/webm",
    vcodec: "libvpx-vp9",
    acodec: "libopus",
    extraArgs: ["-b:a", "128k"],
    preset: "medium",
  },
  av1: {
    // AV1 + Opus dans un conteneur Matroska — compatible avec la plupart des lecteurs modernes
    ext: ".mkv",
    mime: "video/x-matroska",
    vcodec: "libaom-av1",
    acodec: "libopus",
    extraArgs: ["-strict", "experimental", "-b:a", "128k", "-cpu-used", "4"],
    preset: "medium",
  },
};

/**
 * Matrice CRF : [H.264, H.265, AV1, VP9] par indice de qualité (0-4).
 * VP9 n'est pas spécifié dans la demande utilisateur → on réutilise les valeurs H.264
 * (les échelles CRF de x264 et VP9 sont proches pour un rendu équivalent).
 */
const CRF_MATRIX: Record<number, [number, number, number, number]> = {
  0: [30, 32, 35, 35], // Qualité minimale
  1: [26, 28, 32, 32], // Basse
  2: [23, 25, 30, 30], // Moyenne (défaut)
  3: [20, 22, 27, 27], // Haute
  4: [18, 20, 24, 24], // Maximale
};

/** Renvoie le CRF ffmpeg pour un format + un indice de qualité donnés. */
function crfForVideoFormat(format: string, quality: number): number {
  const cfg = VIDEO_FORMAT_CONFIG[format] ?? VIDEO_FORMAT_CONFIG["mp4-h264"];
  const idx = CRF_MATRIX[quality] ?? CRF_MATRIX[2];
  switch (cfg.vcodec) {
    case "libx264":
      return idx[0];
    case "libx265":
      return idx[1];
    case "libaom-av1":
      return idx[2];
    case "libvpx-vp9":
      return idx[3];
    default:
      return 23;
  }
}

// ---------------------------------------------------------------------------
// Normalisation des options entrantes
// ---------------------------------------------------------------------------

/** Applique les valeurs par défaut et borne les options entrantes. */
export function normalizeImportOptions(raw: Partial<ImportOptions> | null): ImportOptions {
  const r = raw ?? {};
  const fmt =
    typeof r.videoFormat === "string" && VIDEO_FORMAT_CONFIG[r.videoFormat]
      ? r.videoFormat
      : "mp4-h264";

  // Liste blanche des formats image cibles (jfif traité comme jpg côté sharp)
  const imgFmtRaw = typeof r.convertImageFormat === "string" ? r.convertImageFormat.toLowerCase() : "";
  const allowedImg = ["jpg", "jpeg", "png", "webp", "avif", "heif", "jfif"];
  const convertImageFormat = allowedImg.includes(imgFmtRaw) ? imgFmtRaw : null;

  // defaultTags peut arriver en string (legacy) ou en array<{name,category}>
  let defaultTags: DefaultTag[] = [];
  if (Array.isArray(r.defaultTags)) {
    defaultTags = r.defaultTags
      .map((t) => {
        if (!t || typeof t !== "object") return null;
        const name = typeof t.name === "string" ? t.name : "";
        const norm = normalizeTag(name);
        if (!norm) return null;
        return { name: norm, category: sanitizeCategory((t as { category?: unknown }).category) };
      })
      .filter((t): t is DefaultTag => t !== null);
  } else if (typeof r.defaultTags === "string" && r.defaultTags.trim()) {
    // Compatibilité legacy : "tag1 tag2" → [{name:"tag1",category:"general"}, ...]
    defaultTags = r.defaultTags
      .split(/\s+/)
      .map((s) => normalizeTag(s))
      .filter(Boolean)
      .map((name) => ({ name, category: "general" }));
  }

  return {
    compressImages: !!r.compressImages,
    jpegQuality: clamp(r.jpegQuality ?? 85, 20, 95),
    convertImageFormat,
    transcodeVideo: !!r.transcodeVideo,
    videoFormat: fmt,
    videoQuality: clamp(Math.floor(Number(r.videoQuality ?? 2)), 0, 4),
    defaultTags,
  };
}

// ---------------------------------------------------------------------------
// Transformations — images
// ---------------------------------------------------------------------------

/**
 * Convertit une image vers le format cible (jpg/png/webp/avif/heif/jfif).
 * La qualité (20-95) s'applique au format cible.
 * Sortie : /tmp/myboard-import/<uuid>.<ext>
 */
export async function convertImage(
  srcPath: string,
  targetFormat: string,
  quality: number
): Promise<{ path: string; size: number; ext: string; mime: string }> {
  await ensureTmpDir();
  const fmt = (targetFormat || "jpg").toLowerCase();
  let ext: string;
  let mime: string;
  let pipeline: sharp.Sharp = sharp(srcPath).rotate();

  switch (fmt) {
    case "png":
      ext = ".png";
      mime = "image/png";
      pipeline = pipeline.png({
        compressionLevel: 9,
        palette: true,
        colours: 256,
        quality,
      });
      break;
    case "webp":
      ext = ".webp";
      mime = "image/webp";
      pipeline = pipeline.webp({ quality });
      break;
    case "avif":
      ext = ".avif";
      mime = "image/avif";
      pipeline = pipeline.avif({ quality });
      break;
    case "heif":
      ext = ".heif";
      mime = "image/heif";
      pipeline = pipeline.heif({ quality });
      break;
    case "jfif":
    case "jpg":
    case "jpeg":
    default:
      ext = ".jpg";
      mime = "image/jpeg";
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      break;
  }

  const out = path.join(TMP_DIR, `${randomUUID()}${ext}`);
  await pipeline.toFile(out);
  return { path: out, size: fileSize(out), ext, mime };
}

/**
 * Ré-encode une image dans son format d'origine avec la qualité choisie.
 * - JPG/JPEG/WEBP : qualité 20-95
 * - PNG : compressionLevel 9 + palette reduction
 * - AVIF : qualité 20-95
 * - HEIC/HEIF : fallback AVIF (sharp ne supporte pas toujours l'encodage HEIC)
 * - Autres (GIF, BMP, TIFF…) : non supporté, retourne l'original intact
 */
export async function compressImage(
  srcPath: string,
  quality: number
): Promise<{ path: string; size: number }> {
  await ensureTmpDir();
  const ext = path.extname(srcPath).toLowerCase();
  const out = path.join(TMP_DIR, `${randomUUID()}${ext || ".img"}`);
  let pipeline = sharp(srcPath).rotate();

  if (ext === ".jpg" || ext === ".jpeg") {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  } else if (ext === ".png") {
    pipeline = pipeline.png({ compressionLevel: 9, palette: true, colours: 256, quality });
  } else if (ext === ".webp") {
    pipeline = pipeline.webp({ quality });
  } else if (ext === ".avif") {
    pipeline = pipeline.avif({ quality });
  } else if (ext === ".heic" || ext === ".heif") {
    pipeline = pipeline.avif({ quality });
  } else {
    // Non supporté (GIF animé, BMP, TIFF…) → on garde l'original
    return { path: srcPath, size: fileSize(srcPath) };
  }

  await pipeline.toFile(out);
  return { path: out, size: fileSize(out) };
}

// ---------------------------------------------------------------------------
// Transformations — vidéo
// ---------------------------------------------------------------------------

/**
 * Transcode une vidéo vers le format cible (mp4-h264 / mp4-h265 / webm / av1).
 * Le CRF est calculé depuis `quality` (0-4) et le codec utilisé.
 * Fallback sur l'original si ffmpeg absent ou si le transcodage échoue.
 */
export async function transcodeVideo(
  srcPath: string,
  format: string,
  quality: number
): Promise<{ path: string; size: number; duration: number | null; ext: string; mime: string; warning?: string }> {
  await ensureTmpDir();
  const ff = which("ffmpeg");
  const cfg = VIDEO_FORMAT_CONFIG[format] ?? VIDEO_FORMAT_CONFIG["mp4-h264"];
  const fallbackExt = cfg.ext;
  const fallbackMime = cfg.mime;

  if (!ff) {
    return {
      path: srcPath,
      size: fileSize(srcPath),
      duration: await videoDuration(srcPath).catch(() => null),
      ext: path.extname(srcPath).toLowerCase(),
      mime: mimeFromExt(path.extname(srcPath)),
      warning: "ffmpeg introuvable — utilisation de l'original sans transcodage",
    };
  }

  const crf = crfForVideoFormat(format, quality);
  const out = path.join(TMP_DIR, `${randomUUID()}${cfg.ext}`);

  return new Promise((resolve) => {
    const args = [
      "-y",
      "-i", srcPath,
      "-c:v", cfg.vcodec,
      "-preset", cfg.preset,
      "-crf", String(crf),
      ...(cfg.extraArgs ?? []),
      "-c:a", cfg.acodec,
      out,
    ];
    const proc = spawn(ff, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on("close", async (code) => {
      if (code === 0 && existsSync(out) && fileSize(out) > 0) {
        const duration = await videoDuration(srcPath).catch(() => null);
        resolve({ path: out, size: fileSize(out), duration, ext: cfg.ext, mime: cfg.mime });
      } else {
        await fs.promises.unlink(out).catch(() => {});
        const tail = stderr.split("\n").slice(-3).join(" | ").trim();
        resolve({
          path: srcPath,
          size: fileSize(srcPath),
          duration: await videoDuration(srcPath).catch(() => null),
          ext: fallbackExt,
          mime: fallbackMime,
          warning: `transcodage échoué (exit ${code}) — original conservé${tail ? ` : ${tail}` : ""}`,
        });
      }
    });
    proc.on("error", async () => {
      await fs.promises.unlink(out).catch(() => {});
      resolve({
        path: srcPath,
        size: fileSize(srcPath),
        duration: await videoDuration(srcPath).catch(() => null),
        ext: fallbackExt,
        mime: fallbackMime,
        warning: "ffmpeg spawn échoué — original conservé",
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Sauvegarde vers tmp
// ---------------------------------------------------------------------------

/**
 * Écrit un fichier web (File) vers un chemin disque via streaming (évite OOM sur gros fichiers).
 * Utilise Readable.fromWeb (Node 18+) pour convertir le ReadableStream web en stream Node.
 */
async function saveFileToTmp(file: File, tmpPath: string): Promise<void> {
  const webStream = file.stream();
  const nodeStream = Readable.fromWeb(webStream as ReadableStream<Uint8Array>);
  const writeStream = fs.createWriteStream(tmpPath);
  await new Promise<void>((resolve, reject) => {
    nodeStream.on("error", reject);
    writeStream.on("error", reject);
    writeStream.on("finish", () => resolve());
    nodeStream.pipe(writeStream);
  });
}

// ---------------------------------------------------------------------------
// Pipeline principal
// ---------------------------------------------------------------------------

/**
 * Orchestre tout le pipeline d'import pour UN fichier.
 * - Sauve → hash → check doublon → (transform) → store → thumb → insert + tags
 * - Cleanup fichiers temporaires dans un finally (toujours exécuté, succès ou erreur)
 */
export async function processUpload(
  file: File,
  options: ImportOptions
): Promise<ImportFileResult> {
  await ensureTmpDir();
  await ensureStorageDirs();

  const filename = file.name || "unknown";
  const ext = path.extname(filename).toLowerCase();
  const originalSize = file.size;
  const kind = kindFromExt(ext);

  // 1. Sauvegarde temporaire
  const tmpPath = path.join(TMP_DIR, `${randomUUID()}${ext || ""}`);
  const tmpFiles: string[] = [tmpPath];
  const cleanup = async () => {
    for (const f of tmpFiles) {
      await fs.promises.unlink(f).catch(() => {});
    }
  };

  try {
    await saveFileToTmp(file, tmpPath);

    // 2. sha256 (sur l'original tmp — même si on transformera ensuite, le hash identifie l'input)
    const sha = await sha256File(tmpPath).catch(() => null);
    if (!sha) {
      return { file: filename, status: "error", error: "sha256 échoué", originalSize };
    }

    // 3. Doublon ?
    const existing = await db.media.findUnique({
      where: { sha256: sha },
      select: { id: true },
    });
    if (existing) {
      return { file: filename, status: "duplicate", sha, id: existing.id, originalSize };
    }

    // 4. Transformations optionnelles
    let sourcePath = tmpPath;
    let finalExt = ext;
    let finalMime = mimeFromExt(ext);
    let finalSize = originalSize;
    let transformed = false;
    let transformKind: TransformKind = null;
    let warning: string | undefined;
    let videoDur: number | null = null;

    if (kind === "image" && options.convertImageFormat) {
      // Conversion d'image (vers jpg/png/webp/avif/heif/jfif)
      // La qualité jpegQuality s'applique au format cible.
      try {
        const r = await convertImage(tmpPath, options.convertImageFormat, options.jpegQuality);
        if (r.size > 0) {
          sourcePath = r.path;
          finalExt = r.ext;
          finalMime = r.mime;
          finalSize = r.size;
          transformed = true;
          transformKind = r.ext === ".webp" ? "webp" : "compressed";
          tmpFiles.push(r.path);
        }
      } catch (e) {
        warning = `convertImage échoué : ${e instanceof Error ? e.message : String(e)}`;
      }
    } else if (kind === "image" && options.compressImages) {
      // Compression seule (sans conversion) — ré-encode dans le format d'origine
      try {
        const r = await compressImage(tmpPath, options.jpegQuality);
        if (r.size > 0 && r.path !== tmpPath) {
          sourcePath = r.path;
          finalSize = r.size;
          transformed = true;
          transformKind = "compressed";
          tmpFiles.push(r.path);
        }
      } catch (e) {
        warning = `compressImage échoué : ${e instanceof Error ? e.message : String(e)}`;
      }
    } else if (kind === "video" && options.transcodeVideo) {
      try {
        const r = await transcodeVideo(tmpPath, options.videoFormat, options.videoQuality);
        if (r.path !== tmpPath) {
          sourcePath = r.path;
          finalExt = r.ext;
          finalMime = r.mime;
          finalSize = r.size;
          videoDur = r.duration;
          transformed = true;
          transformKind = "video";
          tmpFiles.push(r.path);
          if (r.warning) warning = r.warning;
        } else {
          // Fallback ffmpeg absent ou échec → on conserve l'original
          finalExt = r.ext;
          finalMime = r.mime;
          videoDur = r.duration;
          if (r.warning) warning = r.warning;
        }
      } catch (e) {
        warning = `transcodeVideo échoué : ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    // 5. copyToStorage (original ou transformé)
    await copyToStorage(sourcePath, sha, finalExt);

    // 6. Miniature — toujours générée (imp-7 : non configurable)
    const thumbPath = await makeThumb(sourcePath, sha, finalExt, kind).catch(() => null);
    const thumbGenerated = !!thumbPath;

    // 7. Dimensions si image
    let width: number | null = null;
    let height: number | null = null;
    if (kind === "image") {
      const dims = await imageSize(sourcePath).catch(() => null);
      if (dims) {
        width = dims.width;
        height = dims.height;
      }
    }

    // 8. Durée vidéo (si pas déjà récupérée par le transcodage)
    if (kind === "video" && videoDur === null) {
      videoDur = await videoDuration(sourcePath).catch(() => null);
    }

    // 9. INSERT Media
    const media = await db.media.create({
      data: {
        sha256: sha,
        originalName: filename,
        ext: finalExt.replace(/^\./, ""),
        mime: finalMime,
        kind,
        size: finalSize,
        width,
        height,
        duration: videoDur,
        storage: "local",
        hasThumb: thumbGenerated,
        source: "import",
      },
    });

    // 10. Tags par défaut (avec catégorie)
    if (options.defaultTags && options.defaultTags.length > 0) {
      for (const t of options.defaultTags) {
        try {
          const tag = await getOrCreateTag(db, t.name, t.category);
          await attachTag(db, media.id, tag.id);
        } catch (e) {
          console.warn(`[import] tag attach failed for "${t.name}":`, e);
        }
      }
    }

    return {
      file: filename,
      status: "imported",
      sha,
      id: media.id,
      size: finalSize,
      originalSize,
      thumbGenerated,
      transformed,
      transformKind,
      warning,
    };
  } catch (e) {
    return {
      file: filename,
      status: "error",
      error: e instanceof Error ? e.message : String(e),
      originalSize,
    };
  } finally {
    await cleanup();
  }
}
