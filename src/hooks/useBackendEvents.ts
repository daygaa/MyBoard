// Écoute les événements du cœur Rust et met à jour l'interface en conséquence.
// Monté une seule fois, à la racine de l'application.

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

import { EVENTS, api, type FailedFile, type ImportSnapshot, type PreviewKey, type ThumbUpdate } from "@/lib/api";
import { refreshLibrary, settleDeletion } from "@/stores/deletion";
import { forgetFavorites } from "@/stores/favorites";
import { useImport } from "@/stores/import";
import { usePreviews } from "@/stores/previews";
import { removeFromSelection } from "@/stores/selection";
import { useThumbs } from "@/stores/thumbs";
import { useViewer } from "@/stores/viewer";

/** Fichiers impossibles à effacer (DEL-04) : leurs médias sont revenus, le message les liste. */
function showFailures(files: FailedFile[]) {
  const one = files.length === 1 ? files[0] : null;
  const lines = one ? [one.message, one.path] : files.map((f) => `${f.path} : ${f.message}`);
  const back = one ? "Ce média est revenu dans la bibliothèque avec toutes ses données." : "Ces médias sont revenus dans la bibliothèque avec toutes leurs données.";
  useViewer.getState().setError({ action: "Supprimer les fichiers de votre stockage", code: one?.code ?? null, message: [...lines, back].join("\n") });
}

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
        void settleDeletion(event.payload);
      }),
      listen<FailedFile[]>(EVENTS.deletionFailed, (event) => {
        void settleDeletion(event.payload.map((f) => f.id));
        showFailures(event.payload);
      }),
      listen<ThumbUpdate[]>(EVENTS.thumbsReady, (event) => useThumbs.getState().apply(event.payload)),
      listen<PreviewKey[]>(EVENTS.previewsReady, (event) => usePreviews.getState().markReady(event.payload)),
      listen<ImportSnapshot>(EVENTS.importState, (event) => useImport.getState().setSnapshot(event.payload)),
    ];
    // État de l'import au démarrage (un import peut déjà tourner).
    void api.importSnapshot().then((snapshot) => useImport.getState().setSnapshot(snapshot));
    return () => unlisteners.forEach((p) => void p.then((unlisten) => unlisten()));
  }, []);
}
