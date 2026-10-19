// Écran de la fenêtre, relu quand la fenêtre change d'écran ou de mise à l'échelle :
// - `pixelRatio` : pixels réels par pixel de la page (mise à l'échelle de Windows : 1 à 100 %,
//   1,5 à 150 %…), pour la taille des miniatures (LIB-16) ;
// - `pxPerInch` : pixels de la page par pouce réel (GRID-11) : densité réelle de l'écran (lue
//   auprès de Windows) divisée par la mise à l'échelle. Écran qui ne donne pas sa taille : 96, la
//   valeur standard.

import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { api } from "@/lib/api";

const STANDARD_PX_PER_INCH = 96;

type ScreenInfo = { pixelRatio: number; pxPerInch: number };

export function useScreen(): ScreenInfo {
  const [screen, setScreen] = useState<ScreenInfo>({ pixelRatio: window.devicePixelRatio, pxPerInch: STANDARD_PX_PER_INCH });
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      const dpi = await api.screenDpi().catch(() => null);
      const pixelRatio = window.devicePixelRatio;
      const pxPerInch = dpi ? dpi / pixelRatio : STANDARD_PX_PER_INCH;
      if (alive) setScreen((s) => (s.pixelRatio === pixelRatio && s.pxPerInch === pxPerInch ? s : { pixelRatio, pxPerInch }));
    };
    // Une fenêtre déplacée envoie beaucoup d'événements : relecture une fois arrêtée.
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void read(), 300);
    };
    // La page est aussi prévenue d'une nouvelle mise à l'échelle (requête vraie pour la valeur
    // actuelle seulement, refaite après chaque changement).
    let query: MediaQueryList | null = null;
    const watchRatio = () => {
      query?.removeEventListener("change", onRatio);
      query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      query.addEventListener("change", onRatio);
    };
    function onRatio() {
      watchRatio();
      later();
    }
    watchRatio();
    void read();
    const window_ = getCurrentWindow();
    const stops = Promise.all([window_.onMoved(later), window_.onScaleChanged(later)]);
    return () => {
      alive = false;
      clearTimeout(timer);
      query?.removeEventListener("change", onRatio);
      void stops.then((list) => list.forEach((stop) => stop()));
    };
  }, []);
  return screen;
}
