// Étapes du retour arrière / avant (NAV-06, retour T3, points AUT.6 et AUT.17) : chaque étape garde sa
// recherche (stores/search.ts) et, si un média y était ouvert, la visionneuse (`viewer`, stores/viewer.ts).
// Le gestionnaire de tags y note aussi la pop-in « Tags proches » quittée par une loupe (`tagsProches`,
// retour T3, point TAGM-13.1) : le retour arrière la rouvre. Une nouvelle étape ne reprend jamais la
// visionneuse ni la pop-in de l'étape d'avant.

export const VIEWER = "viewer";
export const SIMILAR = "tagsProches";

/** État de l'étape en cours, sans sa visionneuse ni sa pop-in : la base d'une nouvelle étape. */
export function stepState(): Record<string, unknown> {
  const state: Record<string, unknown> = { ...(window.history.state ?? {}) };
  delete state[VIEWER];
  delete state[SIMILAR];
  return state;
}
