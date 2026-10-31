// État d'une page de l'application rangé par page de l'historique (retour T3, points TAGM-15.20 et TAGM-04.14) :
// chaque page reçoit un numéro dans l'état de l'historique (champ `field`) et son propre magasin. Une ouverture par
// un clic crée une page sans numéro, donc un état neuf ; un retour arrière / avant retrouve le magasin de sa page,
// même après un détour par d'autres pages. Utilisé par les deux onglets du gestionnaire de tags.

import { useEffect, useState } from "react";
import { createStore, type StoreApi } from "zustand";

let counter = 0;

/** `isPage` : l'adresse est-elle celle de cette page ? `fresh` : l'état d'une nouvelle page. Renvoie le hook de
 *  la page affichée. */
export function historyPageStates<T>(field: string, isPage: (hash: string) => boolean, fresh: () => T) {
  const stores = new Map<string, StoreApi<T>>();

  /** Numéro de la page d'historique en cours ; une page qui n'en a pas (nouvelle ouverture) en reçoit un. */
  const entryKey = (): string => {
    const state = (window.history.state ?? {}) as Record<string, unknown>;
    const known = state[field];
    if (typeof known === "string") return known;
    const key = `${Date.now()}-${++counter}`;
    window.history.replaceState({ ...state, [field]: key }, "");
    return key;
  };

  const storeFor = (key: string): StoreApi<T> => {
    let store = stores.get(key);
    if (!store) {
      store = createStore<T>(() => fresh());
      stores.set(key, store);
    }
    return store;
  };

  /** Page affichée, relue à chaque retour arrière / avant ; son état. */
  return function useHistoryPage(): { key: string; store: StoreApi<T> } {
    const [key, setKey] = useState(entryKey);
    useEffect(() => {
      const onPop = () => isPage(window.location.hash) && setKey(entryKey());
      window.addEventListener("popstate", onPop);
      return () => window.removeEventListener("popstate", onPop);
    }, []);
    return { key, store: storeFor(key) };
  };
}
