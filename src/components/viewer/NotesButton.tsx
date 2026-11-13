// Note libre d'un média (VIEW-19) : bouton rond en haut à gauche de la visionneuse, du même
// style que la croix et aligné avec elle, doré avec un point doré quand le média a déjà une
// note. Il ouvre une petite zone de texte enregistrée automatiquement pendant la frappe, partagée
// avec la description des tags (components/notes/NoteEditor.tsx : liens cliquables, Entrée, Échap,
// clic en dehors, menus CTX-09 / CTX-10, poubelle « Effacer la note » VIEW-45). Échap ferme la note,
// puis la visionneuse. Touche N (VIEW-58) : note ouverte en écriture, curseur dans le texte.

import { useContext, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StickyNote } from "lucide-react";

import { NotePanel, useNoteEditor, type NoteEditor, type NoteTexts } from "@/components/notes/NoteEditor";
import { api, type MediaDetail } from "@/lib/api";
import { hasModalLayer } from "@/lib/escape";
import { NOTE_SHORTCUTS } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { useViewer } from "@/stores/viewer";
import { isTyping } from "./navigation";
import { idleClass, ViewerChrome } from "./viewerChrome";

const TEXTS: NoteTexts = {
  header: "Note — enregistrée automatiquement",
  placeholder: "Écris une note, colle un lien…",
  erase: "Effacer la note",
  confirm: { title: "Effacer la note ?", message: "La note de ce média sera supprimée.", danger: true },
};

/** Touche N (VIEW-58). Comme les autres touches de la visionneuse : pas pendant une saisie (« n » s'écrit alors), ni
 *  avec une pop-in ouverte, ni pendant un défilement rapide (la note serait celle du média d'avant, burst.ts). */
function useNoteShortcut(editor: NoteEditor) {
  const live = useRef(editor);
  live.current = editor;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== NOTE_SHORTCUTS.write.key || e.ctrlKey || e.altKey || e.metaKey) return;
      if (isTyping(e.target) || hasModalLayer() || useViewer.getState().burst) return;
      // Sans cela, la lettre s'écrirait dans la zone de texte qui reçoit le focus.
      e.preventDefault();
      live.current.write();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function NotesButton({ mediaId }: { mediaId: number }) {
  const queryClient = useQueryClient();
  const { idle } = useContext(ViewerChrome);
  const { data: detail } = useQuery({ queryKey: ["media-detail", mediaId], queryFn: () => api.mediaDetail(mediaId) });
  const saved = detail?.notes ?? "";
  const editor = useNoteEditor(saved, (value) => {
    queryClient.setQueryData<MediaDetail | null>(["media-detail", mediaId], (d) => d && { ...d, notes: value.trim() ? value : null });
    void api.setMediaNotes(mediaId, value);
  });
  useNoteShortcut(editor);
  const key = NOTE_SHORTCUTS.write.label;

  return (
    <>
      <button
        ref={editor.buttonRef}
        type="button"
        data-zone="visionneuse.note"
        onClick={editor.toggle}
        aria-label={editor.open ? "Fermer la note" : "Note"}
        title={saved ? `Note de ce média (${key})` : `Ajouter une note (${key})`}
        className={cn(
          "absolute top-4 left-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/60 transition hover:bg-black/85",
          editor.open || saved ? "text-[#d9a94e]" : "text-white",
          !editor.open && idleClass(idle),
        )}
      >
        <StickyNote className="h-4 w-4" />
        {saved && !editor.open && <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-[#d9a94e]" />}
      </button>
      {editor.open && <NotePanel editor={editor} texts={TEXTS} zone="visionneuse.note" className="absolute top-16 left-4 z-30" />}
    </>
  );
}
