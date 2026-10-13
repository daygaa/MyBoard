// État des flèches de la barre de titre (NAV-04) : le bouton 4 / 5 de la souris ferait-il quelque
// chose maintenant ? Recalculé quand ce qui en décide change : élément ouvert ou fermé (pile
// d'Échap), visionneuse et son chemin (VIEW-27, VIEW-30), page, filtres, recherche, historique.

import { useSyncExternalStore } from "react";

import { canGoBack, canGoForward, onStackChange } from "@/lib/escape";
import { useLibrary } from "@/stores/library";
import { useSearch } from "@/stores/search";
import { useViewer } from "@/stores/viewer";

type Navigation = { addEventListener(type: string, listener: () => void): void; removeEventListener(type: string, listener: () => void): void };

function subscribe(onChange: () => void) {
  const navigation = (window as unknown as { navigation?: Navigation }).navigation;
  const stops = [onStackChange(onChange), useViewer.subscribe(onChange), useLibrary.subscribe(onChange), useSearch.subscribe(onChange)];
  window.addEventListener("hashchange", onChange);
  navigation?.addEventListener("currententrychange", onChange);
  return () => {
    stops.forEach((stop) => stop());
    window.removeEventListener("hashchange", onChange);
    navigation?.removeEventListener("currententrychange", onChange);
  };
}

/** « 10 » = précédent possible, suivant impossible (texte : comparé par valeur). */
const snapshot = () => `${canGoBack() ? 1 : 0}${canGoForward() ? 1 : 0}`;

export function useBackForward(): { back: boolean; forward: boolean } {
  const state = useSyncExternalStore(subscribe, snapshot);
  return { back: state[0] === "1", forward: state[1] === "1" };
}
