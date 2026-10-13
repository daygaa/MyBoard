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

/** À partir de cette densité, l'icône des vignettes sans image (audio, documents…) n'affiche
 *  plus l'extension. (La réduction des boutons prévue par SEL-05 est remplacée par GRID-10.) */
export const COMPACT_DENSITY = 20;

/** À partir de cette densité, la grille utilise les miniatures 128 px (LIB-12) :
 *  6 fois moins de pixels à décoder, sans perte visible (vignettes de ~130 px et moins). */
export const SMALL_THUMB_DENSITY = 16;

/** Jusqu'à cette densité, les grands aperçus 640 px remplacent les miniatures (LIB-09). */
export const PREVIEW_MAX_DENSITY = 6;

/** Une vignette doit rester visible ce temps avant de demander son grand aperçu (LIB-09). */
export const PREVIEW_DELAY_MS = 150;

/** Largeur de vignette (px) où badges et infos tiennent en taille normale : nom courant
 *  (« 12363315.mp4 ») + badge durée = 147 px, poids + dimensions = 126 px (mesuré le 13/10).
 *  En dessous, ils sont réduits dans la même proportion que la vignette (GRID-10). */
export const TILE_FULL_WIDTH = 150;

/** Largeur réelle (pouces) sous laquelle une vignette passe en mode « nom seul » (GRID-11) :
 *  ≈ 2,2 cm. Mesuré le 13/10 : 18 colonnes sur l'écran 24" 1080p = 0,859 pouce (17 col. = 0,915),
 *  22 colonnes sur l'écran 27" 1440p = 0,861 pouce (21 col. = 0,906). */
export const NAME_ONLY_TILE_INCHES = 0.88;

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
