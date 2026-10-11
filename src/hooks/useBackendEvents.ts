// Écoute les événements du cœur Rust et met à jour l'interface en conséquence.
// Monté une seule fois, à la racine de l'application.

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";

import { EVENTS, api, type ImportSnapshot, type ThumbUpdate } from "@/lib/api";
import { useImport } from "@/stores/import";
import { useThumbs } from "@/stores/thumbs";

export function useBackendEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unlisteners = [
      // Des médias ont été ajoutés : la page affichée et les compteurs sont relus.
      listen(EVENTS.libraryChanged, () => {
        void queryClient.invalidateQueries({ queryKey: ["media"] });
        void queryClient.invalidateQueries({ queryKey: ["stats"] });
      }),
      listen<ThumbUpdate[]>(EVENTS.thumbsReady, (event) => useThumbs.getState().apply(event.payload)),
      listen<ImportSnapshot>(EVENTS.importState, (event) => useImport.getState().setSnapshot(event.payload)),
    ];
    // État de l'import au démarrage (un import peut déjà tourner).
    void api.importSnapshot().then((snapshot) => useImport.getState().setSnapshot(snapshot));
    return () => unlisteners.forEach((p) => void p.then((unlisten) => unlisten()));
  }, [queryClient]);
}
