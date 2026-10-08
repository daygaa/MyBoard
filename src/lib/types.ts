// MyBoard — Types DTO partagés entre API et UI.
// Centralise les contrats pour que le frontend et le backend restent alignés.

import type { TagCategory } from "./shared";

export type MediaKind = "image" | "video" | "audio" | "document" | "archive" | "other";

/** Tag léger (sidebar / autocomplete). */
export type TagDTO = {
  id: number;
  name: string;
  category: string;
  postCount: number;
};

/** Tag attaché à un média (avec sa catégorie). */
export type MediaTagDTO = {
  id: number;
  name: string;
  category: string;
};

/** Média pour la grille (léger). */
export type MediaListItem = {
  id: number;
  kind: MediaKind;
  ext: string;
  mime: string;
  originalName: string;
  size: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  hasThumb: boolean;
  thumbUrl: string | null;
  fileUrl: string;
  tags: MediaTagDTO[];
  tagCount: number;
  favorite: boolean;
  score: number;
  views: number;
  importedAt: string; // ISO
};

/** Média détaillé (page visionneuse). */
export type MediaDetail = MediaListItem & {
  sha256: string;
  source: string | null;
  storage: string;
};

/** Réponse du moteur de recherche. */
export type SearchResponse = {
  items: MediaListItem[];
  total: number;
  page: number;
  pageSize: number;
};

/** Stats globales (header). */
export type StatsResponse = {
  total: number;
  images: number;
  videos: number;
  audio: number;
  documents: number;
  archives: number;
  others: number;
  favorites: number;
  tags: number;
};

/** Réponse autocomplete. */
export type AutocompleteResponse = {
  items: TagDTO[];
};

/** Réponse import. */
export type ImportResponse = {
  imported: number;
  duplicates: number;
  skipped: number;
  errors: { file: string; error: string }[];
  total: number;
};

/** Réponse bulk tag. */
export type BulkTagResponse = {
  updated: number;
  created: number;
};
