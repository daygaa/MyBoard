// Barre du bas de la visionneuse (apparence v8, deux lignes).
// Ligne 1 : infos du fichier (VIEW-10), juste à droite le champ d'ajout de tag (VIEW-20),
// puis les actions : Copier le fichier (VIEW-35), Favori (VIEW-11), Dossier (VIEW-15),
// Explorer (VIEW-13), Ouvrir avec l'application par défaut (VIEW-24), Imprimer (VIEW-17, images
// seulement), Supprimer (VIEW-14). Pas de « Télécharger » (VIEW-12). Favori, Dossier et
// Supprimer : grisés « bientôt » jusqu'à la phase 3 (D-016). Échec d'une action : message
// d'erreur (VIEW-28). Chaque action a son raccourci clavier (VIEW-36, lib/shortcuts.ts).
// Dessous : les tags du média (`children`, zone dépliable de BottomPanel, VIEW-23, VIEW-39).

import { useEffect, type ComponentType, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, FolderOpen, FolderPlus, Printer, Star, Trash2 } from "lucide-react";

import { api, type MediaItem } from "@/lib/api";
import { hasModalLayer } from "@/lib/escape";
import { formatBytes, formatDuration } from "@/lib/format";
import { viewerActionFor, withShortcut, type ViewerAction } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { useViewer } from "@/stores/viewer";
import { runExternal } from "./externalOpen";
import { isTyping } from "./navigation";
import { printImage } from "./printMedia";
import { TagAdder } from "./ViewerTags";

const ACTION = "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm transition";

type ActionDef = {
  action: ViewerAction;
  zone: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  title: string;
  /** Absent : action grisée « bientôt disponible » (phase 3). */
  run?: () => void;
  /** Raison pour laquelle l'action est grisée pour ce média. */
  unavailable?: string;
  className?: string;
};

function Action({ zone, icon: Icon, label, title, run, unavailable, className, action }: ActionDef) {
  const disabled = !run || unavailable !== undefined;
  const hint = withShortcut(title, action);
  return (
    <button
      type="button"
      data-zone={zone}
      disabled={disabled}
      onClick={run}
      title={unavailable ?? (run ? hint : `${hint} — bientôt disponible`)}
      className={cn(
        ACTION,
        disabled ? "cursor-not-allowed opacity-45" : "hover:bg-secondary hover:text-foreground",
        className ?? "text-muted-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}

function dateFr(ms: number | null | undefined): string {
  return ms ? new Date(ms).toLocaleDateString("fr-FR") : "";
}

/** Raccourcis des actions disponibles (sauf pendant une saisie, une pop-in ou si du texte est
 *  sélectionné : Ctrl+C copie alors ce texte, comme partout). */
function useShortcuts(actions: ActionDef[]) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || hasModalLayer()) return;
      const found = actions.find((a) => a.action === viewerActionFor(e));
      if (!found?.run || found.unavailable !== undefined) return;
      if (found.action === "copy" && window.getSelection()?.toString()) return;
      e.preventDefault();
      found.run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions]);
}

export function InfoBar({ item, children }: { item: MediaItem; children: ReactNode }) {
  const { data: detail } = useQuery({ queryKey: ["media-detail", item.id], queryFn: () => api.mediaDetail(item.id) });
  const copied = useViewer((s) => s.copied === item.id);
  const meta = [
    item.width && item.height ? `${item.width}×${item.height}` : "",
    formatBytes(item.size),
    formatDuration(item.durationMs),
    detail?.fileCreatedAt ? `créé le ${dateFr(detail.fileCreatedAt)}` : "",
  ].filter(Boolean);

  const copy = async () => {
    if (await runExternal("Copier le fichier", () => api.copyMedia(item.id))) useViewer.getState().markCopied(item.id);
  };
  const actions: ActionDef[] = [
    {
      action: "copy",
      zone: "visionneuse.copier",
      icon: copied ? Check : Copy,
      label: copied ? "Copié" : "Copier",
      title: "Copier le fichier (à coller dans un dossier, une conversation…)",
      run: () => void copy(),
      className: copied ? "text-[#d9a94e]" : undefined,
    },
    { action: "favorite", zone: "visionneuse.favori", icon: Star, label: "Ajouter aux favoris", title: "Ajouter aux favoris" },
    { action: "folder", zone: "visionneuse.dossier", icon: FolderPlus, label: "Ajouter à un dossier", title: "Ajouter à un dossier" },
    {
      action: "reveal",
      zone: "visionneuse.explorer",
      icon: FolderOpen,
      label: "Explorer",
      title: "Ouvrir dans l'explorateur (fichier sélectionné)",
      run: () => void runExternal("Ouvrir dans l'explorateur", () => api.revealMedia(item.id)),
    },
    {
      action: "open",
      zone: "visionneuse.ouvrir",
      icon: ExternalLink,
      label: "Ouvrir avec…",
      title: "Ouvrir avec l'application par défaut",
      run: () => void runExternal("Ouvrir avec l'application par défaut", () => api.openMedia(item.id)),
    },
    {
      action: "print",
      zone: "visionneuse.imprimer",
      icon: Printer,
      label: "Imprimer",
      title: "Imprimer l'image",
      run: () => void printImage(item),
      unavailable: item.kind === "image" ? undefined : "Imprimer : réservé aux images",
    },
    { action: "delete", zone: "visionneuse.supprimer", icon: Trash2, label: "Supprimer", title: "Supprimer", className: "text-rose-400" },
  ];
  useShortcuts(actions);

  return (
    <div data-zone="visionneuse.barre" className="flex min-h-0 flex-col gap-3 border-t border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div data-zone="visionneuse.infos" className="max-w-[32rem] min-w-0 shrink">
          <p className="truncate text-sm font-medium text-foreground" title={detail?.path ?? item.fileName}>
            {item.fileName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{meta.join(" · ")}</p>
        </div>

        <TagAdder mediaId={item.id} />

        <div data-zone="visionneuse.actions" className="ml-auto flex items-center gap-1">
          {actions.map((a) => (
            <Action key={a.action} {...a} />
          ))}
        </div>
      </div>

      {children}
    </div>
  );
}
