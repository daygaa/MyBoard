// Note libre d'un média (VIEW-19) : bouton rond en haut à gauche de la visionneuse, du même
// style que la croix et aligné avec elle, doré avec un point doré quand le média a déjà une
// note. Il ouvre une petite zone de texte enregistrée automatiquement pendant la frappe ;
// Entrée termine l'écriture (Maj + Entrée = retour à la ligne). En lecture, les liens collés
// (http…) sont cliquables et s'ouvrent dans le navigateur ; un clic ailleurs dans le texte le
// modifie. Échap, ou un clic en dehors de la note, la ferme (puis Échap ferme la visionneuse).

import { useContext, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StickyNote } from "lucide-react";

import { api, type MediaDetail } from "@/lib/api";
import { useEscape } from "@/lib/escape";
import { cn } from "@/lib/utils";
import { runExternal } from "./externalOpen";
import { idleClass, ViewerChrome } from "./viewerChrome";

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
  const { idle } = useContext(ViewerChrome);
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

  // Un clic en dehors de la note la ferme, comme Échap : ce clic ne fait rien d'autre (il ne
  // zoome pas l'image et ne ferme pas la visionneuse).
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const swallow = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (e.button !== 0 || panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      swallow(e);
      window.addEventListener("click", swallow, { capture: true, once: true });
      close();
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  });

  return (
    <>
      <button
        ref={buttonRef}
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
          "absolute top-4 left-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/60 transition hover:bg-black/85",
          open || saved ? "text-[#d9a94e]" : "text-white",
          !open && idleClass(idle),
        )}
      >
        <StickyNote className="h-4 w-4" />
        {saved && !open && <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-[#d9a94e]" />}
      </button>
      {open && (
        <div
          ref={panelRef}
          data-zone="visionneuse.note.zone"
          className="absolute top-16 left-4 z-30 w-80 rounded-lg border border-border bg-card p-3 shadow-xl"
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
              onKeyDown={(e) => {
                // Entrée : note terminée, affichée « écrite ». Maj + Entrée : retour à la ligne.
                if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
                e.preventDefault();
                flush();
                if (text.trim()) setEditing(false);
                else close();
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
