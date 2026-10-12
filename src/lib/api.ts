// Appels au cœur Rust (commandes Tauri) et types échangés.
// Les noms correspondent aux structures Rust de src-tauri/src (library.rs, import/, tags.rs, media/).

import { convertFileSrc, invoke } from "@tauri-apps/api/core";

export type MediaKind = "image" | "video" | "audio" | "document";

/** Valeurs de `thumbStatus` (voir src-tauri/src/thumbs/mod.rs). */
export const THUMB = { todo: 0, ready: 1, error: 2, none: 3, noFfmpeg: 4 } as const;

export type MediaItem = {
  id: number;
  hash: string;
  fileName: string;
  ext: string;
  kind: MediaKind;
  size: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  thumbStatus: number;
};

export type ListQuery = {
  kinds: MediaKind[];
  /** Termes de la recherche par tags (`tag`, `-tag`, `tag*`) ; vide = toute la bibliothèque. */
  terms: string[];
  sort: string;
  seed: number;
  page: number;
  pageSize: number;
};

export type ListPage = {
  items: MediaItem[];
  total: number;
  page: number;
  pageCount: number;
  /** Médias par page réellement utilisés (position d'un média dans tous les résultats). */
  pageSize: number;
};

export type Stats = {
  total: number;
  images: number;
  videos: number;
  audio: number;
  documents: number;
  tags: number;
  thumbsPending: number;
};

export type FfmpegStatus = { found: boolean; path: string | null; version: string | null };

/** Catégorie de tags (TAGM-01) : nom, couleur et ordre viennent de la base. */
export type Category = { id: number; key: string; name: string; color: string; sortOrder: number };

export type TagInfo = {
  id: number;
  name: string;
  categoryId: number;
  /** Nombre total de médias de la bibliothèque qui portent ce tag (SRCH-10). */
  mediaCount: number;
};

/** Tag à créer s'il n'existe pas ; la catégorie est ignorée pour un tag existant (IMP-31). */
export type NewTag = { name: string; categoryId: number | null };

/** Fiche détaillée d'un média pour la visionneuse (VIEW-10, VIEW-23). */
export type MediaDetail = {
  id: number;
  path: string;
  fileCreatedAt: number | null;
  importedAt: number;
  tags: TagInfo[];
};

/** Résultat d'une miniature, envoyé par lots (événement `thumbs-ready`). */
export type ThumbUpdate = {
  id: number;
  status: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

export type ScanSummary = {
  total: number;
  images: number;
  videos: number;
  audio: number;
  documents: number;
  ignored: number;
  inaccessible: number;
  bytes: number;
};

export type ImportProgress = {
  total: number;
  processed: number;
  imported: number;
  updated: number;
  alreadyPresent: number;
  duplicates: number;
  errors: number;
  currentFile: string | null;
};

export type ImportResult = {
  cancelled: boolean;
  fatal: string | null;
  errorFiles: { path: string; message: string }[];
  elapsedMs: number;
};

export type ImportPhase = "idle" | "scanning" | "ready" | "importing" | "finished";

/** Photo complète de l'état de l'import (événement `import-state`). */
export type ImportSnapshot = {
  phase: ImportPhase;
  /** Fichiers et dossiers choisis (bouton ou glisser-déposer). */
  sources: string[];
  recursive: boolean;
  scan: ScanSummary | null;
  progress: ImportProgress | null;
  result: ImportResult | null;
};

export const api = {
  listMedia: (query: ListQuery) => invoke<ListPage>("list_media", { query }),
  stats: () => invoke<Stats>("library_stats"),
  prioritizeThumbs: (ids: number[]) => invoke<void>("prioritize_thumbs", { ids }),
  requestPreviews: (want: number[], cancel: number[]) => invoke<void>("request_previews", { want, cancel }),
  ffmpegStatus: () => invoke<FfmpegStatus>("ffmpeg_status"),
  importSnapshot: () => invoke<ImportSnapshot>("import_snapshot"),
  scanPaths: (paths: string[], recursive: boolean) => invoke<void>("scan_paths", { paths, recursive }),
  supportedExtensions: () => invoke<string[]>("supported_extensions"),
  startImport: (defaultTags: NewTag[]) => invoke<void>("start_import", { defaultTags }),
  cancelImport: () => invoke<void>("cancel_import"),
  tagCategories: () => invoke<Category[]>("tag_categories"),
  autocompleteTags: (text: string) => invoke<TagInfo[]>("autocomplete_tags", { text }),
  findTag: (name: string) => invoke<TagInfo | null>("find_tag", { name }),
  pageTags: (ids: number[]) => invoke<TagInfo[]>("page_tags", { ids }),
  addMediaTag: (mediaId: number, tag: NewTag) => invoke<void>("add_media_tag", { mediaId, tag }),
  removeMediaTag: (mediaId: number, tagId: number) => invoke<void>("remove_media_tag", { mediaId, tagId }),
  mediaDetail: (id: number) => invoke<MediaDetail | null>("media_detail", { id }),
  revealMedia: (id: number) => invoke<void>("reveal_media", { id }),
  openMedia: (id: number) => invoke<void>("open_media", { id }),
};

/** Événements émis par le cœur Rust. */
export const EVENTS = {
  libraryChanged: "library-changed",
  thumbsReady: "thumbs-ready",
  previewsReady: "previews-ready",
  importState: "import-state",
} as const;

/** Tailles servies par le protocole `thumb://` : 320 px, 128 px (LIB-12), aperçu 640 px (LIB-09). */
export type ThumbTier = "normal" | "small" | "preview";

const TIER_PREFIX: Record<ThumbTier, string> = { normal: "", small: "s/", preview: "p/" };

/** Racine du protocole (`http://thumb.localhost/` sous Windows). On ajoute le chemin
 *  nous-mêmes : `convertFileSrc` encoderait le « / » de « s/… » en « %2F ». */
const THUMB_ROOT = convertFileSrc("", "thumb");

/** Adresse d'une miniature d'un média. */
export function thumbUrl(hash: string, tier: ThumbTier = "normal"): string {
  return `${THUMB_ROOT}${TIER_PREFIX[tier]}${hash}.webp`;
}

const MEDIA_ROOT = convertFileSrc("", "media");

/** Adresse du FICHIER ORIGINAL d'un média (protocole `media://`, visionneuse). L'empreinte
 *  fait partie de l'adresse : son contenu ne change jamais, la fenêtre peut le garder en cache. */
export function mediaUrl(item: Pick<MediaItem, "id" | "hash" | "ext">): string {
  return `${MEDIA_ROOT}${item.id}/${item.hash}.${item.ext}`;
}
