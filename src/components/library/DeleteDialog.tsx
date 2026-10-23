// Pop-in de suppression (DEL-04, textes validés le 17/10) : par défaut, le média est seulement retiré
// de la bibliothèque (ses données sont gardées 1 mois, DEL-05). La case « Supprimer les fichiers de
// votre stockage » est décochée à chaque ouverture ; cochée, « Oui » ouvre une 2e confirmation à
// bordure rouge, dont « Annuler » (ou Échap) revient à la première, au singulier pour un seul média
// (DEL-07). Entrée confirme l'une et l'autre, Espace coche la case (GEN-20). Partagée par la visionneuse (bouton, touche Suppr, menus du clic droit), le menu d'une
// vignette et la sélection multiple (SEL-03, SEL-08).

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import type { MenuItem } from "@/lib/contextMenu";
import { formatNumber } from "@/lib/format";
import { titleIfCut } from "@/lib/utils";

const CANCEL = "text-foreground hover:bg-secondary hover:text-foreground";
const YES = "bg-destructive text-white hover:bg-destructive/90";
/** Les fichiers seront effacés pour de bon : Entrée ne confirme la 2e pop-in qu'une demi-seconde
 *  après son ouverture (choix de l'utilisateur, 24/10). */
const SURE_DELAY = 500;

/** Médias à supprimer : leur nombre, et le nom du fichier quand il est seul et connu. */
export type DeleteTarget = { count: number; name?: string };

type Props = DeleteTarget & {
  onCancel: () => void;
  /** Confirmé ; `deleteFiles` : effacer aussi les fichiers du disque. */
  onConfirm: (deleteFiles: boolean) => void;
};

export function DeleteDialog({ count, name, onCancel, onConfirm }: Props) {
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [sure, setSure] = useState(false);
  /** Ouverture de la 2e pop-in : Entrée n'y agit qu'après SURE_DELAY (deux appuis réflexes). */
  const sureAt = useRef(0);
  const one = count === 1;
  const many = formatNumber(count);
  const confirm = () => {
    if (!deleteFiles) return onConfirm(false);
    sureAt.current = Date.now();
    setSure(true);
  };

  if (sure) {
    return (
      <Modal
        open
        danger
        even
        onEnter={() => Date.now() - sureAt.current >= SURE_DELAY && onConfirm(true)}
        onClose={() => setSure(false)}
        zone="suppression.confirmation-fichiers"
        title={`Êtes-vous sûr de vouloir supprimer ${one ? "le fichier" : "les fichiers"} de votre stockage ?`}
        description={`${one ? "Il sera effacé" : "Ils seront effacés"} définitivement, sans passer par la Corbeille.`}
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
      even
      onEnter={confirm}
      onClose={onCancel}
      zone="suppression"
      title={one ? "Supprimer de la bibliothèque" : `Supprimer ${many} médias`}
      description={
        <div className="space-y-4">
          <p>
            {one && name ? (
              <>
                Supprimer «{" "}
                <span
                  onMouseEnter={(e) => titleIfCut(e.currentTarget)}
                  className="max-w-full overflow-hidden align-top font-semibold text-foreground [overflow-wrap:anywhere]"
                  // Boîte dans la ligne, coupée à 2 lignes par « … » (comme la pop-in de création de tag).
                  style={{ display: "-webkit-inline-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }}
                >
                  {name}
                </span>{" "}
                » de la bibliothèque ?
              </>
            ) : one ? (
              "Supprimer ce média de la bibliothèque ?"
            ) : (
              `Supprimer ces ${many} médias de la bibliothèque ?`
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
          <Button data-zone="suppression.oui" onClick={confirm} className={YES}>
            Oui
          </Button>
        </>
      }
    >
      <label data-zone="suppression.fichiers" className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
        <Checkbox data-principale checked={deleteFiles} onCheckedChange={(c) => setDeleteFiles(c === true)} />
        Supprimer les fichiers de votre stockage
      </label>
    </Modal>
  );
}

/** Entrée « Supprimer de la bibliothèque… » d'un menu du clic droit (rouge, en dernier, CTX-01) ;
 *  `counted` : libellé avec le nombre (« Supprimer 3 de la bibliothèque… », sélection, SEL-08) ;
 *  `confirm` : action une fois la pop-in confirmée. Annuler la pop-in laisse le menu ouvert (CTX-02). */
export function deleteEntry(target: DeleteTarget, confirm: (deleteFiles: boolean) => void, counted = false): MenuItem {
  return {
    label: counted ? `Supprimer ${formatNumber(target.count)} de la bibliothèque…` : "Supprimer de la bibliothèque…",
    danger: true,
    disabled: target.count === 0,
    dialog: ({ onCancel, onDone }) => (
      <DeleteDialog
        {...target}
        onCancel={onCancel}
        onConfirm={(deleteFiles) => {
          onDone();
          confirm(deleteFiles);
        }}
      />
    ),
  };
}
