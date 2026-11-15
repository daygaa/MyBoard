// Suppression du média affiché dans la visionneuse : pop-in avec sa case (DEL-04), puis le média suivant (VIEW-14).
// Partagée par le bouton « Supprimer » de la barre du bas (InfoBar.tsx) et celui des cartes « illisible » (VIEW-62).

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { DeleteDialog } from "@/components/library/DeleteDialog";
import type { MediaItem } from "@/lib/api";
import { withShortcut } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { deleteShown } from "./mediaActions";
import { ACTION_BUTTON } from "./viewerChrome";

export function DeleteShownDialog({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  return (
    <DeleteDialog
      count={1}
      name={item.fileName}
      onCancel={onClose}
      onConfirm={(deleteFiles) => {
        onClose();
        void deleteShown(item, deleteFiles);
      }}
    />
  );
}

/** « Supprimer » sous « Ouvrir avec l'application par défaut » des cartes « illisible » (VIEW-62, demande du 15/11) :
 *  aspect et bulle du bouton de la barre du bas, avec un contour gris en plus (retour du 15/11). */
export function DeleteShownButton({ item }: { item: MediaItem }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-zone="visionneuse.illisible.supprimer"
        onClick={() => setOpen(true)}
        title={withShortcut("Supprimer de la bibliothèque", "delete")}
        className={cn(ACTION_BUTTON, "mt-3 border border-border text-rose-400 hover:bg-secondary hover:text-foreground")}
      >
        <Trash2 className="h-4 w-4" />
        Supprimer
      </button>
      {open && <DeleteShownDialog item={item} onClose={() => setOpen(false)} />}
    </>
  );
}
