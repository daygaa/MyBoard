// Écoute les événements du cœur Rust et met à jour l'interface en conséquence.
// Monté une seule fois, à la racine de l'application.

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

import { EVENTS, api, type FailedFile, type ImportSnapshot, type PreviewKey, type ThumbUpdate } from "@/lib/api";
import { checkApi, type CheckState } from "@/lib/libraryCheck";
import { addFailures, settleFailures } from "@/stores/deleteFailures";
import { refreshLibrary, settleDeletion } from "@/stores/deletion";
import { forgetFavorites } from "@/stores/favorites";
import { useImport } from "@/stores/import";
import { useLibraryCheck } from "@/stores/libraryCheck";
import { usePreviews } from "@/stores/previews";
import { removeFromSelection, settleSelectionDeletion } from "@/stores/selection";
import { useThumbs } from "@/stores/thumbs";

export function useBackendEvents() {
  useEffect(() => {
    const unlisteners = [
      // Médias ajoutés (import) ou données remises (DEL-05) : la page affichée, les compteurs et les
      // tags (et leurs compteurs) sont relus.
      listen(EVENTS.libraryChanged, () => void refreshLibrary()),
      // Médias supprimés pour de bon (DEL-02) : leurs états gardés par numéro sont oubliés.
      listen<number[]>(EVENTS.mediaDeleted, (event) => {
        forgetFavorites(event.payload);
        useThumbs.getState().forget(event.payload);
        usePreviews.getState().forget(event.payload);
        // Un média supprimé (depuis la visionneuse ou ailleurs) quitte la sélection (SEL-09).
        removeFromSelection(event.payload);
        settleSelectionDeletion(event.payload, false);
        settleFailures(event.payload);
        void settleDeletion(event.payload);
      }),
      // Fichiers impossibles à effacer (DEL-04, DEL-08) : leurs médias sont revenus ; la pop-in les
      // liste, et ceux venus de la sélection y sont recochés.
      listen<FailedFile[]>(EVENTS.deletionFailed, (event) => {
        const ids = event.payload.map((f) => f.id);
        settleSelectionDeletion(ids, true);
        addFailures(event.payload);
        void settleDeletion(ids);
      }),
      listen<ThumbUpdate[]>(EVENTS.thumbsReady, (event) => useThumbs.getState().apply(event.payload)),
      listen<PreviewKey[]>(EVENTS.previewsReady, (event) => usePreviews.getState().markReady(event.payload)),
      listen<ImportSnapshot>(EVENTS.importState, (event) => useImport.getState().setSnapshot(event.payload)),
    ];
    // Fichiers disparus, emplacements inaccessibles (LIB-05, LIB-14) : l'état est relu une fois l'écoute en place (une
    // vérification rapide peut finir avant elle : son message serait perdu).
    const check = listen<CheckState>(EVENTS.libraryCheck, (event) => useLibraryCheck.getState().setCheck(event.payload));
    void check.then(() => checkApi.state()).then((state) => useLibraryCheck.getState().setCheck(state));
    unlisteners.push(check);
    // État de l'import au démarrage (un import peut déjà tourner).
    void api.importSnapshot().then((snapshot) => useImport.getState().setSnapshot(snapshot));
    return () => unlisteners.forEach((p) => void p.then((unlisten) => unlisten()));
  }, []);
}
