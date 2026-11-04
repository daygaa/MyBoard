// Pop-in de confirmation maison (GEN-10) : « Annuler » et « Oui » (rouge pour une action
// dangereuse, CTX-01). Entrée confirme (GEN-20) ; Échap, le bouton 4 de la souris, la croix ou un
// clic sur le fond annulent.
// Utilisée par les menus du clic droit (CTX-02) et par les boutons qui demandent confirmation
// (« Effacer la note », VIEW-45). `confirmLabel` remplace « Oui » ; `children` : contenu sous le
// texte (une case à cocher…).

import type { ReactNode } from "react";

import { Button } from "./button";
import { Modal } from "./modal";

type Props = {
  title: string;
  /** Sous le titre, fixe quand le texte défile. */
  subtitle?: ReactNode;
  message: ReactNode;
  danger?: boolean;
  zone: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  /** Remplace « Annuler » (« Non » : retrait des parents d'une chaîne, TAGM-22). */
  cancelLabel?: string;
  children?: ReactNode;
};

export function ConfirmDialog({ title, subtitle, message, danger = false, zone, onCancel, onConfirm, confirmLabel = "Oui", cancelLabel = "Annuler", children }: Props) {
  return (
    <Modal
      open
      even
      onEnter={onConfirm}
      onClose={onCancel}
      zone={zone}
      title={title}
      subtitle={subtitle}
      description={message}
      footer={
        <>
          <Button data-zone={`${zone}.non`} variant="ghost" onClick={onCancel} className="text-foreground hover:bg-secondary hover:text-foreground">
            {cancelLabel}
          </Button>
          <Button
            data-zone={`${zone}.oui`}
            onClick={onConfirm}
            className={danger ? "bg-destructive text-white hover:bg-destructive/90" : "bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]"}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
