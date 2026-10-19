// Zone de texte libre partagée par la note d'un média (VIEW-19, VIEW-45, CTX-09, CTX-10) et la
// description d'un tag (TAGM-14, « mêmes fonctions que les notes ») : enregistrée automatiquement
// pendant la frappe ; Entrée termine l'écriture (Maj + Entrée = retour à la ligne). En lecture, les
// liens collés (http…) sont cliquables et s'ouvrent dans le navigateur ; un clic ailleurs dans le
// texte le modifie. Échap, ou un clic en dehors, la ferme (ce clic ne fait rien d'autre). Clic droit :
// menu du texte écrit ou d'un lien ; en écriture, menu d'édition (CTX-03, automatique). Poubelle rouge
// en haut à droite : « Effacer », même confirmation que dans le menu.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Trash2 } from "lucide-react";

import { runExternal } from "@/components/viewer/externalOpen";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api";
import { isContextMenuOpen, openContextMenu, type Confirm } from "@/lib/contextMenu";
import { hasModalLayer, useEscape } from "@/lib/escape";
import { cn } from "@/lib/utils";

/** Délai d'enregistrement après la dernière frappe. */
const SAVE_DELAY = 400;
const LINK = /(https?:\/\/[^\s<>"]+)/gi;

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

/** État d'une zone de texte : `saved` = texte enregistré, `onSave` l'enregistre (vide = effacé). */
export function useNoteEditor(saved: string, onSave: (value: string) => void) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  /** Texte en cours de frappe ; `null` = celui enregistré. */
  const [draft, setDraft] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<string | null>(null);
  const save = useRef(onSave);
  save.current = onSave;
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const text = draft ?? saved;

  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current === null) return;
    const value = pending.current;
    pending.current = null;
    save.current(value);
  };
  // Composant retiré (autre média, visionneuse fermée…) : rien n'est perdu. (`flush` ne lit que des
  // références.)
  useEffect(() => flush, []);

  const close = () => {
    flush();
    setOpen(false);
    setEditing(false);
    setDraft(null);
  };
  useEscape(open, close);
  /** « Effacer… » : texte vide enregistré, zone fermée. */
  const erase = () => {
    clearTimeout(timer.current);
    pending.current = null;
    save.current("");
    setOpen(false);
    setEditing(false);
    setDraft(null);
  };

  // Un clic en dehors de la zone la ferme, comme Échap : ce clic ne fait rien d'autre.
  useEffect(() => {
    if (!open) return;
    const swallow = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      // Menu du clic droit ou pop-in de confirmation ouverts : ce clic est pour eux (CTX-01).
      if (e.button !== 0 || isContextMenuOpen() || hasModalLayer() || panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      swallow(e);
      window.addEventListener("click", swallow, { capture: true, once: true });
      close();
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  });

  const toggle = () => {
    if (open) return close();
    setOpen(true);
    setEditing(!saved);
  };
  const type = (value: string) => {
    setDraft(value);
    pending.current = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY);
  };

  return { open, editing, setEditing, text, saved, confirming, setConfirming, panelRef, buttonRef, flush, close, erase, toggle, type };
}

export type NoteEditor = ReturnType<typeof useNoteEditor>;

export type NoteTexts = {
  /** En-tête de la zone (« Note — enregistrée automatiquement »). */
  header: string;
  placeholder: string;
  /** « Effacer la note » : bulle de la poubelle ; le menu y ajoute « … ». */
  erase: string;
  confirm: Confirm;
};

type PanelProps = { editor: NoteEditor; texts: NoteTexts; zone: string; className?: string; style?: CSSProperties };

/** La zone elle-même (`zone` : nom de base, « visionneuse.note » → « visionneuse.note.zone »…). */
export function NotePanel({ editor, texts, zone, className, style }: PanelProps) {
  const { editing, setEditing, text, flush, close, erase, setConfirming, confirming, panelRef } = editor;
  return (
    <>
      <div ref={panelRef} data-zone={`${zone}.zone`} className={cn("w-80 rounded-lg border border-border bg-card p-3 shadow-xl", className)} style={style}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">{texts.header}</p>
          <button
            type="button"
            data-zone={`${zone}.effacer`}
            disabled={!text.trim()}
            // Garde le focus dans le texte en écriture (l'écriture se terminerait sinon).
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setConfirming(true)}
            aria-label={texts.erase}
            title={texts.erase}
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
            onChange={(e) => editor.type(e.target.value)}
            onKeyDown={(e) => {
              // Entrée : texte terminé, affiché « écrit ». Maj + Entrée : retour à la ligne.
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
            placeholder={texts.placeholder}
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
                { label: `${texts.erase}…`, danger: true, confirm: texts.confirm, run: erase },
              ])
            }
            title="Cliquer pour modifier"
            className="max-h-60 min-h-10 cursor-text overflow-y-auto rounded-md p-2 text-sm whitespace-pre-wrap text-foreground hover:bg-secondary/50"
          >
            <Linked text={text} />
          </div>
        )}
      </div>
      {confirming && (
        <ConfirmDialog
          {...texts.confirm}
          zone={`${zone}.confirmation`}
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
