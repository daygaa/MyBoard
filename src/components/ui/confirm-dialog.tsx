// Pop-in de confirmation maison (GEN-10) : « Annuler » et « Oui » (rouge pour une action
// dangereuse, CTX-01). Échap, le bouton 4 de la souris, la croix ou un clic sur le fond annulent.
// Utilisée par les menus du clic droit (CTX-02) et par les boutons qui demandent confirmation
// (« Effacer la note », VIEW-45).

import type { ReactNode } from "react";

import { Button } from "./button";
import { Modal } from "./modal";

type Props = {
  title: string;
  message: ReactNode;
  danger?: boolean;
  zone: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({ title, message, danger = false, zone, onCancel, onConfirm }: Props) {
  return (
    <Modal
      open
      onClose={onCancel}
      zone={zone}
      title={title}
      description={message}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} className="text-foreground hover:bg-secondary hover:text-foreground">
            Annuler
          </Button>
          <Button
            onClick={onConfirm}
            className={danger ? "bg-destructive text-white hover:bg-destructive/90" : "bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]"}
          >
            Oui
          </Button>
        </>
      }
    />
  );
}
