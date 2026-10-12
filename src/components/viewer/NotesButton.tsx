// Note libre d'un média (VIEW-19) : bouton discret en haut à gauche de la visionneuse, sous le
// badge du zoom, avec un point doré quand le média a déjà une note. Il ouvre une petite zone de
// texte enregistrée automatiquement pendant la frappe. En lecture, les liens collés (http…)
// sont cliquables et s'ouvrent dans le navigateur ; un clic ailleurs dans le texte le modifie.
// Échap ferme la note (puis, de nouveau, la visionneuse).

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StickyNote } from "lucide-react";

import { api, type MediaDetail } from "@/lib/api";
import { useEscape } from "@/lib/escape";
import { cn } from "@/lib/utils";
import { runExternal } from "./externalOpen";

/** Délai d'enregistrement après la dernière frappe. */
const SAVE_DELAY = 400;
const LINK = /(https?:\/\/[^\s<>"]+)/gi;

/** Texte avec les liens rendus cliquables. */
function Linked({ text }: { text: string }) {
  return (
    <>
      {text.split(LINK).map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation(); // ne passe pas en modification
              void runExternal("Ouvrir le lien", () => api.openUrl(part));
            }}
            className="break-all text-[#d9a94e] underline underline-offset-2 hover:text-[#e3b75f]"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function NotesButton({ mediaId }: { mediaId: number }) {
  const queryClient = useQueryClient();
  const { data: detail } = useQuery({ queryKey: ["media-detail", mediaId], queryFn: () => api.mediaDetail(mediaId) });
  const saved = detail?.notes ?? "";
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  /** Texte en cours de frappe ; `null` = celui de la base. */
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<string | null>(null);
  const text = draft ?? saved;

  const save = (value: string) => {
    pending.current = null;
    queryClient.setQueryData<MediaDetail | null>(["media-detail", mediaId], (d) => d && { ...d, notes: value.trim() ? value : null });
    void api.setMediaNotes(mediaId, value);
  };
  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current !== null) save(pending.current);
  };
  // Passage à un autre média ou fermeture de la visionneuse : rien n'est perdu. (`flush` ne lit
  // que des références et ce composant est recréé pour chaque média.)
  useEffect(() => flush, []);

  const close = () => {
    flush();
    setOpen(false);
    setEditing(false);
    setDraft(null);
  };
  useEscape(open, close);

  return (
    <>
      <button
        type="button"
        data-zone="visionneuse.note"
        onClick={() => {
          if (open) return close();
          setOpen(true);
          setEditing(!saved);
        }}
        aria-label={open ? "Fermer la note" : "Note"}
        title={saved ? "Note de ce média" : "Ajouter une note"}
        className={cn(
          "absolute top-14 left-4 z-20 grid h-8 w-8 place-items-center rounded-md bg-black/50 transition hover:bg-black/80",
          open || saved ? "text-[#d9a94e]" : "text-zinc-400 hover:text-zinc-200",
        )}
      >
        <StickyNote className="h-4 w-4" />
        {saved && !open && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[#d9a94e]" />}
      </button>
      {open && (
        <div
          data-zone="visionneuse.note.zone"
          className="absolute top-24 left-4 z-30 w-80 rounded-lg border border-border bg-card p-3 shadow-xl"
        >
          <p className="mb-2 text-[11px] text-muted-foreground">Note — enregistrée automatiquement</p>
          {editing ? (
            <textarea
              autoFocus
              value={text}
              onChange={(e) => {
                setDraft(e.target.value);
                pending.current = e.target.value;
                clearTimeout(timer.current);
                timer.current = setTimeout(flush, SAVE_DELAY);
              }}
              onBlur={() => {
                flush();
                if (text.trim()) setEditing(false);
              }}
              placeholder="Écris une note, colle un lien…"
              className="h-40 w-full resize-none rounded-md border border-border bg-background p-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#d9a94e]/60 focus:outline-none"
            />
          ) : (
            <div
              onClick={() => setEditing(true)}
              title="Cliquer pour modifier"
              className="max-h-60 min-h-10 cursor-text overflow-y-auto rounded-md p-2 text-sm whitespace-pre-wrap text-foreground hover:bg-secondary/50"
            >
              <Linked text={text} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
