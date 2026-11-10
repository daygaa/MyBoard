// Pop-in des paires (IMP-64, demande du 10/11) : la liste contient des originaux ET leurs versions compressées
// (« photo.jpg » et « photo_c.jpg »), aucun des deux dans la bibliothèque. « Importer les deux » ; « Supprimer les
// doublons » : seuls les originaux sont importés ; « Supprimer les originaux » : seules les versions. Case « Supprimer
// du stockage » (décochée à chaque ouverture) : les fichiers écartés sont aussi effacés du disque, après une 2e pop-in
// à bordure rouge, définitivement (comme DEL-04). Échap ou la croix : rien n'est importé. Entrée : « Importer les deux ».

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import type { PairChoice } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { keepQuoted } from "@/lib/keepWords";

type Props = {
  count: number;
  onAnswer: (choice: PairChoice, deleteFiles: boolean) => void;
  onCancel: () => void;
};

export function PairsDialog({ count, onAnswer, onCancel }: Props) {
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [confirm, setConfirm] = useState<PairChoice | null>(null);
  const one = count === 1;
  const choose = (choice: PairChoice) => (choice !== "both" && deleteFiles ? setConfirm(choice) : onAnswer(choice, false));

  if (confirm) {
    // Versions (féminin) ou originaux (masculin) : le participe s'accorde.
    const versions = confirm === "originals";
    const what = versions ? (one ? "la version compressée écartée" : "les versions compressées écartées") : one ? "l'original écarté" : "les originaux écartés";
    const erased = `${one ? "sera" : "seront"} effacé${versions ? "e" : ""}${one ? "" : "s"}`;
    return (
      <ConfirmDialog
        danger
        zone="import.paires.confirmation"
        title="Êtes-vous sûr de vouloir supprimer ces fichiers de votre stockage ?"
        message={`${what[0].toUpperCase()}${what.slice(1)} (${formatNumber(count)}) ${erased} définitivement du disque, sans passer par la Corbeille.`}
        confirmLabel={confirm === "originals" ? "Supprimer les doublons" : "Supprimer les originaux"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => onAnswer(confirm, true)}
      />
    );
  }

  return (
    <Modal
      open
      wide
      zone="import.paires"
      onClose={onCancel}
      onEnter={() => onAnswer("both", false)}
      title="Originaux et versions compressées"
      description={
        <>
          <span className="block">
            {keepQuoted(
              one
                ? "1 image de cette liste a aussi sa version compressée dans la liste (par exemple « photo.jpg » et « photo_c.jpg »)."
                : `${formatNumber(count)} images de cette liste ont aussi leur version compressée dans la liste (par exemple « photo.jpg » et « photo_c.jpg »).`,
            )}
          </span>
          <span className="mt-5 block">Souhaitez-vous importer les originaux ET leurs versions compressées dans la bibliothèque ?</span>
        </>
      }
      footer={
        <>
          <Button data-zone="import.paires.les-deux" variant="outline" onClick={() => choose("both")} className="border-border text-foreground hover:bg-secondary hover:text-foreground">
            Importer les deux
          </Button>
          <Button data-zone="import.paires.doublons" variant="outline" onClick={() => choose("originals")} className="border-border text-foreground hover:bg-secondary hover:text-foreground">
            Supprimer les doublons
          </Button>
          <Button data-zone="import.paires.originaux" onClick={() => choose("versions")} className="bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]">
            Supprimer les originaux
          </Button>
        </>
      }
    >
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-foreground">
        <Checkbox data-principale data-zone="import.paires.stockage" checked={deleteFiles} onCheckedChange={(c) => setDeleteFiles(c === true)} />
        Supprimer du stockage
      </label>
    </Modal>
  );
}
