// Réglages de la grille : densité (colonnes), nombre de médias par page, filtres, tris.

import type { MediaKind } from "./api";

/** Densité = nombre de colonnes, limites fixes quelle que soit la résolution (GRID-02). */
export const DENSITY_MIN = 4;
export const DENSITY_MAX = 30;
export const DENSITY_DEFAULT = 7;

/** Préréglages du bouton « Disposition » (v8 ✓). */
export const DENSITY_PRESETS = [
  { label: "Confort", value: 5 },
  { label: "Standard", value: 7 },
  { label: "Compact", value: 14 },
];

/** À partir de cette densité, les petits boutons des vignettes sont réduits de 25 % (SEL-05). */
export const COMPACT_DENSITY = 20;

/** À partir de cette densité, la grille utilise les miniatures 128 px (LIB-12) :
 *  6 fois moins de pixels à décoder, sans perte visible (vignettes de ~130 px et moins). */
export const SMALL_THUMB_DENSITY = 16;

/** Jusqu'à cette densité, les grands aperçus 640 px remplacent les miniatures (LIB-09). */
export const PREVIEW_MAX_DENSITY = 6;

/** Une vignette doit rester visible ce temps avant de demander son grand aperçu (LIB-09). */
export const PREVIEW_DELAY_MS = 150;

/** Écart entre vignettes, en pixels (classe `gap-2`). */
export const GRID_GAP = 8;

export function clampDensity(n: number): number {
  return Math.max(DENSITY_MIN, Math.min(DENSITY_MAX, Math.round(n)));
}

/** Médias par page selon la densité (GRID-05, formule v8) : 50 à 4 colonnes → 500 à 30. */
export function pageSizeForDensity(density: number): number {
  const d = clampDensity(density);
  const ratio = (d - DENSITY_MIN) / (DENSITY_MAX - DENSITY_MIN);
  return Math.round(50 + (500 - 50) * ratio);
}

/** Filtres par type, à sélection multiple (FILT-01). Aucun coché = « Tout ». */
export const KIND_FILTERS: { label: string; value: MediaKind }[] = [
  { label: "Images", value: "image" },
  { label: "Vidéos", value: "video" },
  { label: "Audio", value: "audio" },
  { label: "Documents", value: "document" },
];

/** Tris (FILT-04, FILT-05). Pas de « Favoris » dans ce menu. */
export const SORTS = [
  { label: "Récents", value: "recent" },
  { label: "Anciens", value: "oldest" },
  { label: "Création récente", value: "created_desc" },
  { label: "Création ancienne", value: "created_asc" },
  { label: "Poids ↓", value: "size_desc" },
  { label: "Poids ↑", value: "size_asc" },
  { label: "Résolution ↓", value: "res_desc" },
  { label: "Résolution ↑", value: "res_asc" },
  { label: "Nb. tags ↓", value: "tags_desc" },
  { label: "Nb. tags ↑", value: "tags_asc" },
  { label: "Aléatoire", value: "random" },
] as const;

export type SortValue = (typeof SORTS)[number]["value"];
