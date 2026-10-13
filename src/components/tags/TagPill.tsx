// Pastille de tag colorée selon sa catégorie (VIEW-23, SRCH-07, IMP-30), apparence v8 :
// fond et bordure de la couleur en transparence, texte de la couleur. La croix de retrait est à
// GAUCHE du texte (GEN-14) : toujours au même endroit, quelle que soit la longueur du tag.

import type { ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  color: string;
  children: ReactNode;
  /** Clic sur le nom (ex. lancer la recherche de ce tag). */
  onClick?: () => void;
  /** Croix de retrait. */
  onRemove?: () => void;
  removeLabel?: string;
  title?: string;
  className?: string;
};

export function TagPill({ color, children, onClick, onRemove, removeLabel, title, className }: Props) {
  return (
    <span
      data-zone="tag.pastille"
      title={title}
      className={cn("inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs", className)}
      // Couleur de la base (TAGM-01) : 15 % pour le fond, 30 % pour la bordure (comme la v8).
      style={{ color, backgroundColor: `${color}26`, borderColor: `${color}4d` }}
    >
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="shrink-0 text-muted-foreground/70 transition hover:text-rose-300"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      {/* Texte remonté de 2 px : sinon il paraît plus bas que la croix, qui est bien centrée
          (mesuré au pixel le 13/10, GEN-09 puis GEN-14 : lettres sans jambage à 1 px du haut et
          du bas de la croix). */}
      {onClick ? (
        <button type="button" onClick={onClick} className="relative -top-[2px] min-w-0 truncate hover:underline">
          {children}
        </button>
      ) : (
        <span className="relative -top-[2px] min-w-0 truncate">{children}</span>
      )}
    </span>
  );
}
