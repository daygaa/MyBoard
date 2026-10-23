// Pop-in maison (GEN-10), apparence des dialogues de la v8. Sans bibliothèque de dialogue :
// rien ne reste dans la page une fois fermé, donc aucun calque invisible ne peut bloquer
// l'interface (bogue critique de la v5, VIEW-07). Échap et le bouton 4 de la souris ferment. Le
// clavier y entre et y reste (GEN-20.1) ; Espace coche la case principale et Entrée confirme, sans
// avoir à leur donner le focus (GEN-20.2).

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { useEscape } from "@/lib/escape";
import { cn } from "@/lib/utils";

/** Commandes atteignables au clavier dans une pop-in (cases à cocher comprises : ce sont des boutons). */
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** Champs de saisie : Entrée leur appartient (elle valide le champ ou va à la ligne). */
const FIELD = 'input:not([type="radio"]):not([type="checkbox"]), textarea, select, [contenteditable="true"]';
/** Commandes qui gardent Espace quand elles ont le focus. */
const CONTROL = 'button, a[href], input, textarea, select, [contenteditable="true"], [role="checkbox"], [role="radio"]';

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
  /** Entrée = bouton de confirmation, celui de droite (GEN-20), même quand la case à cocher a le
   *  focus ; un autre bouton de la pop-in qui a le focus (Annuler…) garde son rôle. Espace coche la
   *  case marquée `data-principale` (ou la seule case de la pop-in). */
  onEnter?: () => void;
};

export function Modal(props: Props) {
  const { open, onClose, title, description, children, footer, zone, lift = 0, danger = false, dismissible = true, wide = false, even = false, onEnter } = props;
  const close = dismissible ? onClose : () => {};
  const isTop = useEscape(open, close, { modal: true });
  const dialogRef = useRef<HTMLDivElement>(null);

  // Élément qui avait le focus à l'ouverture, lu pendant l'affichage : un champ de la pop-in
  // (autoFocus) le prend avant que les effets ne s'exécutent.
  const opener = useMemo(() => (open ? document.activeElement : null), [open]);

  // Le clavier entre dans la pop-in et y reste (GEN-20.1) : à l'ouverture, elle prend le focus (sauf
  // si l'un de ses champs l'a déjà) ; à la fermeture, il revient là où il était.
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus({ preventScroll: true });
    return () => {
      if (opener instanceof HTMLElement && opener !== document.body && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open, opener]);

  // Contenu remplacé (2e pop-in de suppression…) : l'élément qui avait le focus a disparu, il revient
  // à la pop-in.
  useEffect(() => {
    if (open && isTop() && document.activeElement === document.body) dialogRef.current?.focus({ preventScroll: true });
  });

  // Clavier de la pop-in au premier plan (GEN-20) ; une liste ouverte par-dessus (choix d'une
  // catégorie…) garde le sien.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog || !isTop() || e.ctrlKey || e.altKey || e.metaKey) return;
      const active = document.activeElement;
      if (active && active !== document.body && !dialog.contains(active) && !active.closest("#root")) return;
      // Commande de la pop-in qui a le focus, s'il y en a une.
      const own = active && dialog.contains(active) && active !== dialog ? active : null;
      if (e.key === "Tab") {
        // Tab et Maj + Tab tournent entre les commandes de la pop-in, sans passer à la page derrière.
        const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (items.length === 0) return;
        const i = own ? items.indexOf(own as HTMLElement) : -1;
        const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === -1 || i === items.length - 1 ? 0 : i + 1;
        e.preventDefault();
        items[next].focus();
      } else if (e.key === "Enter" && onEnter && !e.repeat && !e.shiftKey) {
        // Entrée = bouton de confirmation, même sans focus et même sur la case ; un champ (Entrée y
        // valide ou va à la ligne) et un autre bouton (Annuler…) gardent leur rôle.
        if (own?.matches(FIELD) || (own instanceof HTMLButtonElement && own.role !== "checkbox")) return;
        e.preventDefault();
        e.stopPropagation();
        onEnter();
      } else if (e.key === " " && !e.repeat && !e.shiftKey) {
        // Espace coche ou décoche la case principale (GEN-20.2), même sans focus ; une commande
        // qui a le focus garde son rôle (bouton, autre case, champ).
        if (own?.matches(CONTROL)) return;
        const boxes = dialog.querySelectorAll<HTMLElement>('[role="checkbox"]:not([disabled])');
        const main = dialog.querySelector<HTMLElement>('[role="checkbox"][data-principale]:not([disabled])') ?? (boxes.length === 1 ? boxes[0] : null);
        if (!main) return;
        e.preventDefault();
        main.click();
      }
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
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-zone={zone}
        className={cn(
          "relative w-full rounded-xl border bg-card p-6 text-card-foreground shadow-xl outline-none",
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
