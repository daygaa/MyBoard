// Touche Suppr dans la grille (GRID-13) : ouvre la pop-in de suppression (DEL-04), la même que celle du menu
// du clic droit. En mode sélection : celle des médias cochés (rien si aucun n'est coché) ; sinon : celle du
// média sous la souris (rien si la souris n'est sur aucune vignette). Sans effet pendant une saisie, ou quand
// une pop-in, un menu ou la visionneuse est ouvert : ils passent avant (escape.ts ; la visionneuse a sa propre
// touche Suppr, VIEW-36).

import { useEffect, useState, type ReactNode } from "react";

import { hasEscapeLayer } from "@/lib/escape";
import { deleteMedia } from "@/stores/deletion";
import { inField, isSelecting, pageItems, selectedIds } from "@/stores/selection";
import { deleteEntry } from "./DeleteDialog";
import { deleteSelectionEntry } from "./selectionMenu";

/** Média de la page affichée sous la souris (attribut `data-media` des vignettes, MediaTile). */
function hoveredMedia() {
  const tile = [...document.querySelectorAll<HTMLElement>(":hover")].find((el) => el.dataset.zone === "grille.vignette");
  const id = Number(tile?.dataset.media);
  return pageItems().find((m) => m.id === id) ?? null;
}

export function DeleteKey() {
  const [dialog, setDialog] = useState<ReactNode>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" || e.repeat || e.ctrlKey || e.altKey || e.metaKey || inField(e.target) || hasEscapeLayer()) return;
      let entry;
      if (isSelecting()) {
        const ids = selectedIds();
        if (ids.length === 0) return;
        entry = deleteSelectionEntry({ ids });
      } else {
        const item = hoveredMedia();
        if (!item) return;
        entry = deleteEntry({ count: 1, name: item.fileName }, (deleteFiles) => void deleteMedia([item.id], deleteFiles));
      }
      e.preventDefault();
      const close = () => setDialog(null);
      setDialog(entry.dialog?.({ onCancel: close, onDone: close }) ?? null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return dialog;
}
