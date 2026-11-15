// Suppression du média affiché dans la visionneuse : pop-in avec sa case (DEL-04), puis le média suivant (VIEW-14).
// Partagée par le bouton « Supprimer » de la barre du bas (InfoBar.tsx) et celui des cartes « illisible » (VIEW-62).

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { DeleteDialog } from "@/components/library/DeleteDialog";
import type { MediaItem } from "@/lib/api";
import { deleteShown } from "./mediaActions";

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

/** « Supprimer » sous « Ouvrir avec l'application par défaut » des cartes « illisible » (VIEW-62, demande du 15/11). */
export function DeleteShownButton({ item }: { item: MediaItem }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-zone="visionneuse.illisible.supprimer"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary hover:text-rose-300"
      >
        <Trash2 className="h-4 w-4" />
        Supprimer
      </button>
      {open && <DeleteShownDialog item={item} onClose={() => setOpen(false)} />}
    </>
  );
}
