// Pop-in maison (GEN-10), apparence des dialogues de la v8. Sans bibliothèque de dialogue :
// rien ne reste dans la page une fois fermé, donc aucun calque invisible ne peut bloquer
// l'interface (bogue critique de la v5, VIEW-07). Échap et le bouton 4 de la souris ferment.

import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { useEscape } from "@/lib/escape";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  zone: string;
};

export function Modal({ open, onClose, title, description, children, footer, zone }: Props) {
  useEscape(open, onClose, true);
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/60 p-4"
      // Clic sur le fond (et pas dans la fenêtre) : fermer.
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-zone={zone}
        className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="pr-6 text-lg font-semibold text-foreground">{title}</h2>
        {description && <div className="mt-1.5 text-sm text-muted-foreground">{description}</div>}
        {children && <div className="mt-5">{children}</div>}
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
