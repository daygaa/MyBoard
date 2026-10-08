// Helpers safe à importer depuis server ET client components.
// Toutes les constantes/formats partagés de l'app vivent ici.

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
// PAGE_SIZE est DÉSORMAIS DYNAMIQUE selon la densité grille (modif_UI.txt lp-8) :
//   densité 4  → 50 médias/page (4 cols × ~12 lignes)
//   densité 7  → ~120 médias/page (7 cols × ~17 lignes, proche ancien 63)
//   densité 14 → ~300 médias/page
//   densité 30 → 500 médias/page (max, capped)
// Formule : interpolation linéaire entre (4,50) et (30,500), clamp [50,500].
// PAGE_SIZE (63) reste exported pour compat (utilisé côté serveur par défaut si
// pas de densité fournie — e.g. au tout 1er render SSR avant hydratation).
export const PAGE_SIZE = 120; // défaut quand densité inconnue (≈ densité 7)

/** Calcule le nombre de médias par page selon la densité grille (4-30). */
export function pageSizeForDensity(density: number): number {
  // Clamp densité 4-30
  const d = Math.max(4, Math.min(30, Math.round(density)));
  // Interpolation linéaire : densité 4 → 50, densité 30 → 500
  const min = 50, max = 500;
  const ratio = (d - 4) / (30 - 4);
  return Math.round(min + (max - min) * ratio);
}

// ---------------------------------------------------------------------------
// Catégories de tags (façon Danbooru / Safebooru)
// ---------------------------------------------------------------------------
export const CATEGORIES = ["copyright", "character", "artist", "general", "meta"] as const;
export type TagCategory = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<TagCategory, string> = {
  copyright: "Copyright",
  character: "Personnage",
  artist: "Artiste",
  general: "Général",
  meta: "Méta",
};

// Couleur du texte (sidebar / pills)
export const CATEGORY_TEXT: Record<string, string> = {
  copyright: "text-fuchsia-400",
  character: "text-emerald-400",
  artist: "text-rose-400",
  general: "text-sky-300",
  meta: "text-amber-300",
};

// Couleur du point/badge
export const CATEGORY_DOT: Record<string, string> = {
  copyright: "bg-fuchsia-400",
  character: "bg-emerald-400",
  artist: "bg-rose-400",
  general: "bg-sky-300",
  meta: "bg-amber-300",
};

// Fond pill par catégorie (pour les badges compacts)
export const CATEGORY_PILL: Record<string, string> = {
  copyright: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  character: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  artist: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  general: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  meta: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

export function isCategory(v: string): v is TagCategory {
  return (CATEGORIES as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// Normalisation des tags
// ---------------------------------------------------------------------------
/** Normalise un nom de tag : minuscules, espaces → underscores, trimmé. */
export function normalizeTagName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/^[-~]+/, "")
    .replace(/_+/g, "_")
    .slice(0, 255);
}

/** Forme d'affichage : underscores → espaces (comme les boorus en sidebar). */
export function displayTag(name: string): string {
  return name.replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
export function formatBytes(bytes: number): string {
  if (!bytes) return "0 o";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

export function formatDuration(sec: number | null | undefined): string {
  if (!sec || !isFinite(sec)) return "";
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
    : `${m}:${String(r).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------
/** Construit l'URL de browse pour une recherche donnée. */
export function searchHref(tags: string, page = 1): string {
  const params = new URLSearchParams();
  const t = tags.trim().replace(/\s+/g, " ");
  if (t) params.set("tags", t);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

/** Ajoute un terme à une requête (sans doublons, remplace la polarité opposée). */
export function addTermToQuery(query: string, term: string): string {
  const terms = query.split(/\s+/).filter(Boolean);
  const bare = term.replace(/^-/, "");
  const filtered = terms.filter((t) => t.replace(/^-/, "") !== bare);
  filtered.push(term);
  return filtered.join(" ");
}

// ---------------------------------------------------------------------------
// Types de médias
// ---------------------------------------------------------------------------
export const KIND_LABEL: Record<string, string> = {
  image: "Image",
  video: "Vidéo",
  audio: "Audio",
  document: "Document",
  archive: "Archive",
  other: "Fichier",
};

export const KIND_FILTERS = [
  { label: "Tout", value: "" },
  { label: "Images", value: "type:image" },
  { label: "Vidéos", value: "type:video" },
  { label: "Audio", value: "type:audio" },
  { label: "Documents", value: "type:document" },
];

export const SORTS = [
  { label: "Récents", value: "" },
  { label: "Anciens", value: "order:oldest" },
  { label: "Taille ↓", value: "order:size" },
  { label: "Taille ↑", value: "order:size_asc" },
  { label: "Nb. tags ↓", value: "order:tagcount" },
  { label: "Nb. tags ↑", value: "order:tagcount_asc" },
  { label: "Aléatoire", value: "order:random" },
  { label: "Favoris", value: "order:favorite" },
];

/** URL du fichier original (local ou remote). */
export function mediaFileUrl(m: { id: number; storage: string; remoteUrl: string | null }): string {
  return m.storage === "remote" && m.remoteUrl ? m.remoteUrl : `/api/files/${m.id}`;
}

/** URL de la miniature (local ou remote). */
export function mediaThumbUrl(m: {
  id: number;
  storage: string;
  remoteThumbUrl: string | null;
  hasThumb: boolean;
}): string | null {
  if (m.storage === "remote" && m.remoteThumbUrl) return m.remoteThumbUrl;
  if (m.hasThumb) return `/api/files/${m.id}/thumb`;
  return null;
}

// ---------------------------------------------------------------------------
// Extensions supportées (mirrors du projet Python original)
// ---------------------------------------------------------------------------
export const IMAGE_EXTS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp",
  ".tif", ".tiff", ".heic", ".heif", ".avif",
]);

export const VIDEO_EXTS = new Set([
  ".mp4", ".webm", ".mkv", ".mov", ".m4v", ".avi",
  ".ts", ".m2ts", ".wmv",
]);

export const AUDIO_EXTS = new Set([".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac"]);

export const DOC_EXTS = new Set([
  ".pdf", ".txt", ".md", ".csv", ".json", ".xml",
  ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp",
]);

export const ARCHIVE_EXTS = new Set([".zip", ".rar", ".7z", ".tar", ".gz", ".bz2"]);

/** Détermine le kind à partir de l'extension. */
export function kindFromExt(ext: string): string {
  const e = ext.toLowerCase();
  if (IMAGE_EXTS.has(e)) return "image";
  if (VIDEO_EXTS.has(e)) return "video";
  if (AUDIO_EXTS.has(e)) return "audio";
  if (DOC_EXTS.has(e)) return "document";
  if (ARCHIVE_EXTS.has(e)) return "archive";
  return "other";
}

/** MIME approximatif (suffisant pour servir les fichiers). */
export function mimeFromExt(ext: string): string {
  const e = ext.toLowerCase().replace(/^\./, "");
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
    webp: "image/webp", bmp: "image/bmp", tif: "image/tiff", tiff: "image/tiff",
    heic: "image/heic", heif: "image/heif", avif: "image/avif",
    mp4: "video/mp4", webm: "video/webm", mkv: "video/x-matroska",
    mov: "video/quicktime", m4v: "video/x-m4v", avi: "video/x-msvideo",
    ts: "video/mp2t", m2ts: "video/mp2t", wmv: "video/x-ms-wmv",
    mp3: "audio/mpeg", wav: "audio/wav", flac: "audio/flac",
    ogg: "audio/ogg", m4a: "audio/mp4", aac: "audio/aac",
    pdf: "application/pdf", txt: "text/plain", md: "text/markdown",
    csv: "text/csv", json: "application/json", xml: "application/xml",
    doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    zip: "application/zip", rar: "application/vnd.rar", "7z": "application/x-7z-compressed",
    tar: "application/x-tar", gz: "application/gzip", bz2: "application/x-bzip2",
  };
  return map[e] ?? "application/octet-stream";
}
