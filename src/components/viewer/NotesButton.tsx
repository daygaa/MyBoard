// Note libre d'un média (VIEW-19) : bouton rond en haut à gauche de la visionneuse, du même
// style que la croix et aligné avec elle, doré avec un point doré quand le média a déjà une
// note. Il ouvre une petite zone de texte enregistrée automatiquement pendant la frappe ;
// Entrée termine l'écriture (Maj + Entrée = retour à la ligne). En lecture, les liens collés
// (http…) sont cliquables et s'ouvrent dans le navigateur ; un clic ailleurs dans le texte le
// modifie. Échap, ou un clic en dehors de la note, la ferme (puis Échap ferme la visionneuse).
// Clic droit : menu de la note écrite (CTX-09) ou d'un lien (CTX-10) ; en écriture, menu d'édition
// (CTX-03, automatique). Poubelle rouge en haut à droite : « Effacer la note » (VIEW-45), même
// confirmation que dans le menu.

import { useContext, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StickyNote, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

import { api, type MediaDetail } from "@/lib/api";
import { isContextMenuOpen, openContextMenu } from "@/lib/contextMenu";
import { hasModalLayer, useEscape } from "@/lib/escape";
import { cn } from "@/lib/utils";
import { runExternal } from "./externalOpen";
import { idleClass, ViewerChrome } from "./viewerChrome";

/** Délai d'enregistrement après la dernière frappe. */
const SAVE_DELAY = 400;
const LINK = /(https?:\/\/[^\s<>"]+)/gi;

/** Confirmation de « Effacer la note » (menu CTX-09 et poubelle VIEW-45). */
const ERASE_CONFIRM = { title: "Effacer la note ?", message: "La note de ce média sera supprimée.", danger: true };

const openLink = (url: string) => void runExternal("Ouvrir le lien", () => api.openUrl(url));

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
              openLink(part);
            }}
            onContextMenu={(e) =>
              openContextMenu(e, () => [
                { label: "Ouvrir le lien", run: () => openLink(part) },
                { label: "Copier le lien", run: () => void api.writeClipboardText(part) },
              ])
            }
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
  const [confirming, setConfirming] = useState(false);
  /** « Effacer la note… » (CTX-09) : note vide enregistrée, zone fermée. */
  const erase = () => {
    clearTimeout(timer.current);
    save("");
    setOpen(false);
    setEditing(false);
    setDraft(null);
  };

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
      // Menu du clic droit ouvert (menu d'édition de la note…) : ce clic est pour lui (CTX-01).
      // Menu du clic droit ou pop-in de confirmation ouverts : ce clic est pour eux.
      if (e.button !== 0 || isContextMenuOpen() || hasModalLayer() || panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
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
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">Note — enregistrée automatiquement</p>
            <button
              type="button"
              data-zone="visionneuse.note.effacer"
              disabled={!text.trim()}
              // Garde le focus dans la note en écriture (elle se terminerait sinon).
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setConfirming(true)}
              aria-label="Effacer la note"
              title="Effacer la note"
              // -my-1 : la ligne de l'en-tête garde sa hauteur (la zone de texte ne descend pas).
              className="-my-1 grid h-6 w-6 place-items-center rounded text-rose-400 transition enabled:hover:bg-secondary enabled:hover:text-rose-300 disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
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
              onContextMenu={(e) =>
                openContextMenu(e, () => [
                  { label: "Modifier", run: () => setEditing(true) },
                  { label: "Copier le texte", run: () => void api.writeClipboardText(text) },
                  "separator",
                  {
                    label: "Effacer la note…",
                    danger: true,
                    confirm: ERASE_CONFIRM,
                    run: erase,
                  },
                ])
              }
              title="Cliquer pour modifier"
              className="max-h-60 min-h-10 cursor-text overflow-y-auto rounded-md p-2 text-sm whitespace-pre-wrap text-foreground hover:bg-secondary/50"
            >
              <Linked text={text} />
            </div>
          )}
        </div>
      )}
      {confirming && (
        <ConfirmDialog
          {...ERASE_CONFIRM}
          zone="visionneuse.note.confirmation"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            erase();
          }}
        />
      )}
    </>
  );
}
