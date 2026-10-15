// Curseur « flèche + rond qui tourne » pendant les petites attentes (GEN-13) : ouvertures externes
// (« Ouvrir avec », « Explorer », « Copier »…) et page de la grille qui met plus de 0,3 s à venir.
// Jamais pendant un import (il dure, l'application reste utilisable). Classe `attente` sur la page
// (index.css).

import { useEffect } from "react";

let waiting = 0;

function update() {
  document.documentElement.classList.toggle("attente", waiting > 0);
}

/** Curseur d'attente le temps de `work`. */
export async function whileBusy<T>(work: () => Promise<T>): Promise<T> {
  waiting++;
  update();
  try {
    return await work();
  } finally {
    waiting--;
    update();
  }
}

/** Curseur d'attente tant que `active` est vrai, passé `delay` ms. */
export function useBusy(active: boolean, delay: number) {
  useEffect(() => {
    if (!active) return;
    let counted = false;
    const timer = setTimeout(() => {
      counted = true;
      waiting++;
      update();
    }, delay);
    return () => {
      clearTimeout(timer);
      if (!counted) return;
      waiting--;
      update();
    };
  }, [active, delay]);
}
