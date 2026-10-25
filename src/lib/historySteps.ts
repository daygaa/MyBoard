// Étapes du retour arrière / avant (NAV-06, retour T3, points AUT.6 et AUT.17) : chaque étape garde sa
// recherche (stores/search.ts) et, si un média y était ouvert, la visionneuse (`viewer`, stores/viewer.ts).
// Une nouvelle étape ne reprend jamais la visionneuse de l'étape d'avant.

export const VIEWER = "viewer";

/** État de l'étape en cours, sans sa visionneuse : la base d'une nouvelle étape. */
export function stepState(): Record<string, unknown> {
  const state: Record<string, unknown> = { ...(window.history.state ?? {}) };
  delete state[VIEWER];
  return state;
}
