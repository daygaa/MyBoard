// Description d'un tag (TAGM-14) : bouton de la colonne « Description » du gestionnaire, aux mêmes
// fonctions que la note d'un média (components/notes/NoteEditor.tsx). Doré avec un point quand le tag
// a une description. La zone s'ouvre sous le bouton (au-dessus s'il n'y a pas la place), posée sur la
// page : la liste virtualisée ne la coupe pas.

import { useState } from "react";
import { createPortal } from "react-dom";
import { StickyNote } from "lucide-react";

import { NotePanel, useNoteEditor, type NoteTexts } from "@/components/notes/NoteEditor";
import type { ManagedTag } from "@/lib/api";
import { setTagDescription } from "@/lib/tagManager";
import { cn } from "@/lib/utils";

const TEXTS: NoteTexts = {
  header: "Description — enregistrée automatiquement",
  placeholder: "Décris ce tag, colle un lien…",
  erase: "Effacer la description",
  confirm: { title: "Effacer la description ?", message: "La description de ce tag sera supprimée.", danger: true },
};

/** Largeur et hauteur de la zone (classe `w-80`, zone de texte de 10rem). */
const PANEL_W = 320;
const PANEL_H = 230;

export function TagDescriptionButton({ tag }: { tag: ManagedTag }) {
  const saved = tag.description ?? "";
  const editor = useNoteEditor(saved, (value) => void setTagDescription(tag.id, value));
  const [at, setAt] = useState({ left: 0, top: 0 });

  return (
    <>
      <button
        ref={editor.buttonRef}
        type="button"
        data-zone="gestionnaire-tags.description"
        onClick={() => {
          const r = editor.buttonRef.current?.getBoundingClientRect();
          if (r) {
            const below = r.bottom + 4 + PANEL_H < window.innerHeight;
            setAt({ left: Math.max(8, Math.min(r.right - PANEL_W, window.innerWidth - PANEL_W - 8)), top: below ? r.bottom + 4 : r.top - PANEL_H - 4 });
          }
          editor.toggle();
        }}
        aria-label={saved ? "Description du tag" : "Ajouter une description"}
        title={saved || "Ajouter une description"}
        className={cn(
          "relative grid h-7 w-7 place-items-center rounded-md transition hover:bg-secondary",
          editor.open || saved ? "text-[#d9a94e]" : "text-muted-foreground/60 hover:text-foreground",
        )}
      >
        <StickyNote className="h-3.5 w-3.5" />
        {saved && !editor.open && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#d9a94e]" />}
      </button>
      {editor.open &&
        createPortal(
          <NotePanel editor={editor} texts={TEXTS} zone="gestionnaire-tags.description" className="fixed z-[90]" style={at} />,
          document.body,
        )}
    </>
  );
}
