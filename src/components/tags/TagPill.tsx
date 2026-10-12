// Pastille de tag colorée selon sa catégorie (VIEW-23, SRCH-07, IMP-30), apparence v8 :
// fond et bordure de la couleur en transparence, texte de la couleur.

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
      {onClick ? (
        <button type="button" onClick={onClick} className="min-w-0 truncate hover:underline">
          {children}
        </button>
      ) : (
        <span className="min-w-0 truncate">{children}</span>
      )}
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
    </span>
  );
}
