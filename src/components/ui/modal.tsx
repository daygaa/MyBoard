// Pop-in maison (GEN-10), apparence des dialogues de la v8. Sans bibliothèque de dialogue :
// rien ne reste dans la page une fois fermé, donc aucun calque invisible ne peut bloquer
// l'interface (bogue critique de la v5, VIEW-07). Échap et le bouton 4 de la souris ferment.

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { useEscape } from "@/lib/escape";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  zone: string;
  /** Remonte la pop-in de `lift` px : un contenu plus haut que d'habitude la fait grandir vers le
   *  haut, ses boutons restent à leur place (VIEW-46). */
  lift?: number;
  /** Bordure rouge : confirmation d'une action irréversible (2e confirmation de DEL-04). */
  danger?: boolean;
  /** Faux : seule une réponse par ses boutons la ferme (ni croix, ni Échap, ni clic sur le fond). */
  dismissible?: boolean;
  /** Plus large, pour une liste (restauration des données, DEL-05). */
  wide?: boolean;
  /** Confirmation : le même espace (16 px) entre le titre, le texte, le contenu et les boutons
   *  (DEL-06). Le texte en plusieurs paragraphes les espace de même (`space-y-4`). */
  even?: boolean;
  /** Entrée = bouton de confirmation (GEN-20), même quand la case à cocher a le focus ; un autre
   *  bouton de la pop-in qui a le focus (Annuler…) garde son rôle. */
  onEnter?: () => void;
};

export function Modal(props: Props) {
  const { open, onClose, title, description, children, footer, zone, lift = 0, danger = false, dismissible = true, wide = false, even = false, onEnter } = props;
  const close = dismissible ? onClose : () => {};
  const isTop = useEscape(open, close, { modal: true });
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !onEnter) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat || e.ctrlKey || e.altKey || e.shiftKey || e.metaKey || !isTop()) return;
      const focused = document.activeElement;
      if (focused instanceof HTMLButtonElement && focused.role !== "checkbox" && dialogRef.current?.contains(focused)) return;
      // Ni la case, ni le bouton resté en focus derrière la pop-in ne réagissent en plus.
      e.preventDefault();
      e.stopPropagation();
      onEnter();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onEnter, isTop]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/60 p-4"
      // Clic sur le fond (et pas dans la fenêtre) : fermer.
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-zone={zone}
        className={cn(
          "relative w-full rounded-xl border bg-card p-6 text-card-foreground shadow-xl",
          wide ? "max-w-2xl" : "max-w-md",
          danger ? "border-destructive" : "border-border",
        )}
        style={lift ? { transform: `translateY(-${lift}px)` } : undefined}
      >
        {dismissible && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="absolute top-4 right-4 text-muted-foreground transition hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <h2 className="pr-6 text-lg font-semibold text-foreground">{title}</h2>
        {description && <div className={cn("text-sm text-muted-foreground", even ? "mt-4" : "mt-1.5")}>{description}</div>}
        {children && <div className={even ? "mt-4" : "mt-5"}>{children}</div>}
        {footer && <div className={cn("flex justify-end gap-2", even ? "mt-4" : "mt-6")}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
