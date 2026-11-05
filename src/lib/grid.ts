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

/** Tailles des miniatures (LIB-16) : 128 et 320 px faites à l'import, 640 et 1 280 px à la demande
 *  (cache des aperçus, LIB-09). */
export const THUMB_SIZES = [128, 320, 640, 1280] as const;
export type ThumbSize = (typeof THUMB_SIZES)[number];

/** Une miniature jusqu'à 5 % plus petite que la vignette reste nette (le zoom du survol est de 5 %). */
const SIZE_TOLERANCE = 1.05;

/** Plus petite miniature au moins aussi large que la vignette en pixels réels de l'écran (mise à
 *  l'échelle de Windows comprise), à 5 % près (LIB-16) ; au-delà de toutes : la plus grande. */
export function thumbSizeFor(tilePixels: number): ThumbSize {
  return THUMB_SIZES.find((size) => size * SIZE_TOLERANCE >= tilePixels) ?? 1280;
}

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
  // Ordre de l'Explorateur de Windows : « image2 » avant « image10 », accents et majuscules ignorés (FILT-09).
  { label: "Nom A → Z", value: "name_asc" },
  { label: "Nom Z → A", value: "name_desc" },
  { label: "Aléatoire", value: "random" },
] as const;

/** Tris par date d'ajout (FAV-05) : seulement dans la vue Favoris ou la page d'un dossier. */
type AddedSort = "added_desc" | "added_asc";
export type SortValue = (typeof SORTS)[number]["value"] | AddedSort;

/** Vue de la grille, pour ses tris : bibliothèque, favoris ou dossier. */
export type SortScope = "library" | "favorites" | "folder";

/** Tris proposés dans une vue : les tris d'ajout en premier, dans leur vue seulement. */
export function sortsFor(scope: SortScope): { label: string; value: SortValue }[] {
  if (scope === "library") return [...SORTS];
  const what = scope === "favorites" ? "Ajout aux favoris" : "Ajout au dossier";
  const added: { label: string; value: AddedSort }[] = [
    { label: `${what} : récents`, value: "added_desc" },
    { label: `${what} : anciens`, value: "added_asc" },
  ];
  return [...added, ...SORTS];
}

/** Tri appliqué : un tri d'ajout choisi dans les favoris ou un dossier s'affiche en « Récents »
 *  ailleurs (le choix est gardé, commun à toutes les pages). */
export function effectiveSort(sort: SortValue, scope: SortScope): SortValue {
  return scope === "library" && sort.startsWith("added") ? "recent" : sort;
}
