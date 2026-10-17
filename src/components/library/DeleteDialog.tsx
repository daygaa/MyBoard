// Pop-in de suppression (DEL-04, textes validés le 17/10) : par défaut, le média est seulement retiré
// de la bibliothèque (ses données sont gardées 1 mois, DEL-05). La case « Supprimer les fichiers de
// votre stockage » est décochée à chaque ouverture ; cochée, « Oui » ouvre une 2e confirmation à
// bordure rouge, dont « Annuler » (ou Échap) revient à la première. Partagée par la visionneuse
// (bouton, touche Suppr, menus du clic droit) et le menu d'une vignette.

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import type { MediaItem } from "@/lib/api";
import type { MenuItem } from "@/lib/contextMenu";
import { titleIfCut } from "@/lib/utils";

const CANCEL = "text-foreground hover:bg-secondary hover:text-foreground";
const YES = "bg-destructive text-white hover:bg-destructive/90";

type Props = {
  items: MediaItem[];
  onCancel: () => void;
  /** Confirmé ; `deleteFiles` : effacer aussi les fichiers du disque. */
  onConfirm: (deleteFiles: boolean) => void;
};

export function DeleteDialog({ items, onCancel, onConfirm }: Props) {
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [sure, setSure] = useState(false);
  const one = items.length === 1;

  if (sure) {
    return (
      <Modal
        open
        danger
        onClose={() => setSure(false)}
        zone="suppression.confirmation-fichiers"
        title="Êtes-vous sûr de vouloir supprimer les fichiers de votre stockage ?"
        description="Ils seront effacés définitivement, sans passer par la Corbeille."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSure(false)} className={CANCEL}>
              Annuler
            </Button>
            <Button data-zone="suppression.confirmation-fichiers.oui" onClick={() => onConfirm(true)} className={YES}>
              Oui
            </Button>
          </>
        }
      />
    );
  }

  return (
    <Modal
      open
      onClose={onCancel}
      zone="suppression"
      title={one ? "Supprimer de la bibliothèque" : `Supprimer ${items.length} médias`}
      description={
        <div className="space-y-2">
          <p>
            {one ? (
              <>
                Supprimer «{" "}
                <span
                  onMouseEnter={(e) => titleIfCut(e.currentTarget)}
                  className="max-w-full overflow-hidden align-top font-semibold text-foreground [overflow-wrap:anywhere]"
                  // Boîte dans la ligne, coupée à 2 lignes par « … » (comme la pop-in de création de tag).
                  style={{ display: "-webkit-inline-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }}
                >
                  {items[0]?.fileName}
                </span>{" "}
                » de la bibliothèque ?
              </>
            ) : (
              `Supprimer ces ${items.length} médias de la bibliothèque ?`
            )}
          </p>
          <p>
            {one
              ? "Ses tags, son favori et ses dossiers sont gardés 1 mois : si vous réimportez ce fichier d'ici là, vous pourrez les récupérer."
              : "Leurs tags, leurs favoris et leurs dossiers sont gardés 1 mois : si vous réimportez ces fichiers d'ici là, vous pourrez les récupérer."}
          </p>
        </div>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} className={CANCEL}>
            Annuler
          </Button>
          <Button data-zone="suppression.oui" onClick={() => (deleteFiles ? setSure(true) : onConfirm(false))} className={YES}>
            Oui
          </Button>
        </>
      }
    >
      <label data-zone="suppression.fichiers" className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
        <Checkbox checked={deleteFiles} onCheckedChange={(c) => setDeleteFiles(c === true)} />
        Supprimer les fichiers de votre stockage
      </label>
    </Modal>
  );
}

/** Entrée « Supprimer de la bibliothèque… » d'un menu du clic droit (rouge, en dernier, CTX-01) ;
 *  `confirm` : action une fois la pop-in confirmée. Annuler la pop-in laisse le menu ouvert (CTX-02). */
export function deleteEntry(items: MediaItem[], confirm: (deleteFiles: boolean) => void): MenuItem {
  return {
    label: "Supprimer de la bibliothèque…",
    danger: true,
    dialog: ({ onCancel, onDone }) => (
      <DeleteDialog
        items={items}
        onCancel={onCancel}
        onConfirm={(deleteFiles) => {
          onDone();
          confirm(deleteFiles);
        }}
      />
    ),
  };
}
