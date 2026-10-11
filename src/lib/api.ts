// Appels au cœur Rust (commandes Tauri) et types échangés.
// Les noms correspondent aux structures Rust de src-tauri/src (library.rs, import/).

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
  folder: string | null;
  recursive: boolean;
  scan: ScanSummary | null;
  progress: ImportProgress | null;
  result: ImportResult | null;
};

export const api = {
  listMedia: (query: ListQuery) => invoke<ListPage>("list_media", { query }),
  stats: () => invoke<Stats>("library_stats"),
  prioritizeThumbs: (ids: number[]) => invoke<void>("prioritize_thumbs", { ids }),
  ffmpegStatus: () => invoke<FfmpegStatus>("ffmpeg_status"),
  importSnapshot: () => invoke<ImportSnapshot>("import_snapshot"),
  scanFolder: (path: string, recursive: boolean) => invoke<void>("scan_folder", { path, recursive }),
  startImport: () => invoke<void>("start_import"),
  cancelImport: () => invoke<void>("cancel_import"),
};

/** Événements émis par le cœur Rust. */
export const EVENTS = {
  libraryChanged: "library-changed",
  thumbsReady: "thumbs-ready",
  importState: "import-state",
} as const;

/** Adresse de la petite miniature d'un média (protocole `thumb://`, servi par Rust). */
export function thumbUrl(hash: string): string {
  return convertFileSrc(`${hash}.webp`, "thumb");
}
