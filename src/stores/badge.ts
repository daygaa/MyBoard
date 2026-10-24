// Badge bref des ajouts (SEL-08) : « 3 ajoutés au dossier « Vacances » »… Un nouveau badge remplace
// l'ancien. Affiché 3 s, plus longtemps que les badges du lecteur vidéo (SEL-08.2).

import { create } from "zustand";

export const useGridBadge = create<{ text: string | null }>(() => ({ text: null }));

const GRID_BADGE_MS = 3000;
let timer = 0;

export function showGridBadge(text: string) {
  window.clearTimeout(timer);
  useGridBadge.setState({ text });
  timer = window.setTimeout(() => useGridBadge.setState({ text: null }), GRID_BADGE_MS);
}
