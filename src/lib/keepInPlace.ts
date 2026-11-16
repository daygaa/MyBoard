// Garde un élément cliqué à la même hauteur à l'écran pendant que la page change autour de lui (IMP-88, retouche 2 du
// 16/11) : un dossier déplié ou sa case « Sous-dossiers » changée fait apparaître ou disparaître des lignes au-dessus
// ou en dessous ; l'élément reste sous le curseur. Sa position est notée au clic, puis rétablie à chaque image pendant
// 2 s (le temps que la liste se mette à jour) ; la molette, une touche ou un clic arrêtent tout de suite (l'utilisateur
// reprend la main). Quand c'est impossible (refermer en bas de la page), la page descend, comme d'habitude.

import { scroller } from "./scroller";

let stopCurrent: (() => void) | null = null;

export function keepInPlace(element: Element | null, ms = 2000): void {
  stopCurrent?.();
  if (!element) return;
  const area = scroller();
  const top = element.getBoundingClientRect().top;
  const end = performance.now() + ms;
  let frame = 0;
  const stop = () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("wheel", stop, true);
    window.removeEventListener("keydown", stop, true);
    window.removeEventListener("pointerdown", stop, true);
    if (stopCurrent === stop) stopCurrent = null;
  };
  const tick = () => {
    if (!element.isConnected || performance.now() > end) return stop();
    const drift = element.getBoundingClientRect().top - top;
    if (Math.abs(drift) >= 0.5) area.scrollTo({ top: area.scrollTop + drift, behavior: "instant" });
    frame = requestAnimationFrame(tick);
  };
  window.addEventListener("wheel", stop, { capture: true, passive: true });
  window.addEventListener("keydown", stop, true);
  window.addEventListener("pointerdown", stop, true);
  stopCurrent = stop;
  frame = requestAnimationFrame(tick);
}
