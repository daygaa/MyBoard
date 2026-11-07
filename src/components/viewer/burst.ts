// Défilement rapide (« rafale », VIEW-53, retour AUT.7.5, choix de l'utilisateur du 07/11) : flèche maintenue ou
// appuis plus rapides que ~6-7 par seconde. Chaque média traversé garde un aperçu, mais allégé : vidéos et GIF
// montrent leur miniature (ni lecture, ni son, ni ffprobe, ni conversion FFmpeg), seules les images légères ont
// leur copie nette, les miniatures des médias suivants sont chargées d'avance, la barre du bas attend l'arrêt.
// Mesuré avant (v109) : ~20-24 % du PC pendant l'appui, son démarré puis coupé à chaque vidéo traversée.
// Fin de la rafale : touche maintenue relâchée, ou 200 ms sans nouvel appui (appuis répétés, clics) ; le média
// où l'on s'arrête se charge alors normalement.

import { useState } from "react";

import { useViewer } from "@/stores/viewer";

/** Appuis plus rapprochés : rafale (4 à 6 images par seconde restent une navigation normale). */
const BURST_GAP_MS = 150;
/** Fin de la rafale sans touche relâchée (clics sur les flèches) : temps sans nouvel appui. */
const SETTLE_MS = 200;

let last = -Infinity;
/** Dernier appui venu de la répétition du clavier (touche maintenue). */
let held = false;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Un appui (ou un clic) sur une flèche ; `repeat` : répétition du clavier, touche maintenue. */
export function markStep(repeat: boolean) {
  const now = performance.now();
  const fast = repeat || now - last < BURST_GAP_MS;
  last = now;
  held = repeat;
  const on = useViewer.getState().burst;
  if (!fast && !on) return;
  if (!on) useViewer.setState({ burst: true });
  clearTimeout(timer);
  timer = setTimeout(endBurst, SETTLE_MS);
}

function endBurst() {
  clearTimeout(timer);
  if (useViewer.getState().burst) useViewer.setState({ burst: false });
}

/** Flèche relâchée : une touche maintenue finit la rafale tout de suite ; des appuis rapides répétés à la main
 *  attendent les 200 ms (sinon chaque média se chargerait entre deux appuis). */
export function arrowReleased() {
  if (held) endBurst();
}

/** Média arrivé pendant une rafale et rafale pas finie : affichage allégé. Une fois la rafale finie, le média
 *  reste affiché normalement (une rafale suivante passe forcément à un autre média). */
export function useBurstLight(): boolean {
  const burst = useViewer((s) => s.burst);
  const [light, setLight] = useState(burst);
  if (light && !burst) setLight(false);
  return light && burst;
}
