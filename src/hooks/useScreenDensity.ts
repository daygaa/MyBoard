// Pixels de la page par pouce réel de l'écran (GRID-11) : densité réelle de l'écran de la fenêtre
// (lue auprès de Windows) divisée par la mise à l'échelle de Windows. Relue quand la fenêtre change
// d'écran ou de mise à l'échelle. Écran qui ne donne pas sa taille : 96, la valeur standard.

import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { api } from "@/lib/api";

const STANDARD_PX_PER_INCH = 96;

export function useScreenDensity(): number {
  const [pxPerInch, setPxPerInch] = useState(STANDARD_PX_PER_INCH);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      const dpi = await api.screenDpi().catch(() => null);
      if (alive) setPxPerInch(dpi ? dpi / window.devicePixelRatio : STANDARD_PX_PER_INCH);
    };
    // Une fenêtre déplacée envoie beaucoup d'événements : relecture une fois arrêtée.
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void read(), 300);
    };
    void read();
    const window_ = getCurrentWindow();
    const stops = Promise.all([window_.onMoved(later), window_.onScaleChanged(later)]);
    return () => {
      alive = false;
      clearTimeout(timer);
      void stops.then((list) => list.forEach((stop) => stop()));
    };
  }, []);
  return pxPerInch;
}
