// Barre du bas de la visionneuse (apparence v8, deux lignes).
// Ligne 1 : infos du fichier (VIEW-10), juste à droite le champ d'ajout de tag (VIEW-20),
// puis les actions : Favori (VIEW-11), Dossier (VIEW-15), Explorer (VIEW-13),
// Ouvrir avec l'application par défaut (VIEW-24), Imprimer (VIEW-17, images seulement),
// Supprimer (VIEW-14). Pas de « Télécharger » (VIEW-12). Favori, Dossier et Supprimer : grisés
// « bientôt » jusqu'à la phase 3 (D-016). Échec d'une ouverture : message d'erreur (VIEW-28).
// Ligne 2 : les tags du média en pastilles (VIEW-23).

import type { ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FolderOpen, FolderPlus, Printer, Star, Trash2 } from "lucide-react";

import { api, type MediaItem } from "@/lib/api";
import { formatBytes, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { runExternal } from "./externalOpen";
import { printImage } from "./printMedia";
import { TagAdder, TagPills } from "./ViewerTags";

const ACTION = "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm transition";

function Action({
  icon: Icon,
  label,
  title,
  onClick,
  unavailable,
  className,
  zone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  title: string;
  onClick?: () => void;
  /** Raison pour laquelle l'action est grisée (sinon, sans `onClick` : « bientôt disponible »). */
  unavailable?: string;
  className?: string;
  zone: string;
}) {
  const disabled = !onClick || unavailable !== undefined;
  return (
    <button
      type="button"
      data-zone={zone}
      disabled={disabled}
      onClick={onClick}
      title={unavailable ?? (onClick ? title : `${title} — bientôt disponible`)}
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

export function InfoBar({ item, onSearch }: { item: MediaItem; onSearch: (name: string) => void }) {
  const { data: detail } = useQuery({ queryKey: ["media-detail", item.id], queryFn: () => api.mediaDetail(item.id) });
  const meta = [
    item.width && item.height ? `${item.width}×${item.height}` : "",
    formatBytes(item.size),
    formatDuration(item.durationMs),
    detail?.fileCreatedAt ? `créé le ${dateFr(detail.fileCreatedAt)}` : "",
  ].filter(Boolean);

  return (
    <div data-zone="visionneuse.barre" className="flex flex-col gap-3 border-t border-border bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div data-zone="visionneuse.infos" className="max-w-[32rem] min-w-0 shrink">
          <p className="truncate text-sm font-medium text-foreground" title={detail?.path ?? item.fileName}>
            {item.fileName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{meta.join(" · ")}</p>
        </div>

        <TagAdder mediaId={item.id} />

        <div data-zone="visionneuse.actions" className="ml-auto flex items-center gap-1">
          <Action zone="visionneuse.favori" icon={Star} label="Ajouter aux favoris" title="Ajouter aux favoris" />
          <Action zone="visionneuse.dossier" icon={FolderPlus} label="Ajouter à un dossier" title="Ajouter à un dossier" />
          <Action
            zone="visionneuse.explorer"
            icon={FolderOpen}
            label="Explorer"
            title="Ouvrir dans l'explorateur (fichier sélectionné)"
            onClick={() => void runExternal("Ouvrir dans l'explorateur", () => api.revealMedia(item.id))}
          />
          <Action
            zone="visionneuse.ouvrir"
            icon={ExternalLink}
            label="Ouvrir avec…"
            title="Ouvrir avec l'application par défaut"
            onClick={() => void runExternal("Ouvrir avec l'application par défaut", () => api.openMedia(item.id))}
          />
          <Action
            zone="visionneuse.imprimer"
            icon={Printer}
            label="Imprimer"
            title="Imprimer l'image"
            onClick={() => void printImage(item)}
            unavailable={item.kind === "image" ? undefined : "Imprimer : réservé aux images"}
          />
          <Action
            zone="visionneuse.supprimer"
            icon={Trash2}
            label="Supprimer"
            title="Supprimer"
            className="text-rose-400"
          />
        </div>
      </div>

      <div data-zone="visionneuse.tags" className="flex min-h-6 flex-wrap items-center gap-1.5">
        {detail && <TagPills mediaId={item.id} tags={detail.tags} onSearch={onSearch} />}
      </div>
    </div>
  );
}
