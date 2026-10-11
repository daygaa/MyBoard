// Glisser-déposer de fichiers et de dossiers depuis l'explorateur Windows (IMP-03).
// Tauri fournit les chemins complets des éléments déposés (le navigateur seul ne le peut pas).

import { useEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";

/** Renvoie `true` pendant qu'un glisser survole la fenêtre ; appelle `onDrop` au dépôt. */
export function useFileDrop(enabled: boolean, onDrop: (paths: string[]) => void): boolean {
  const [dragging, setDragging] = useState(false);
  const onDropRef = useRef(onDrop);
  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  useEffect(() => {
    if (!enabled) return;
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      const payload = event.payload;
      if (payload.type === "enter" || payload.type === "over") setDragging(true);
      else if (payload.type === "leave") setDragging(false);
      else if (payload.type === "drop") {
        setDragging(false);
        if (payload.paths.length > 0) onDropRef.current(payload.paths);
      }
    });
    return () => {
      setDragging(false);
      void unlisten.then((stop) => stop());
    };
  }, [enabled]);

  return dragging;
}
