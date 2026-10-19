// Badge bref en haut de la grille (SEL-08) : « 3 ajoutés au dossier « Vacances » »… Même aspect et
// même durée que le badge de la vitesse du lecteur vidéo (VIEW-47). Un nouveau badge remplace l'ancien.

import { create } from "zustand";

import { SPEED_BADGE_MS } from "@/components/viewer/PlayerBadge";

export const useGridBadge = create<{ text: string | null }>(() => ({ text: null }));

let timer = 0;

export function showGridBadge(text: string) {
  window.clearTimeout(timer);
  useGridBadge.setState({ text });
  timer = window.setTimeout(() => useGridBadge.setState({ text: null }), SPEED_BADGE_MS);
}
