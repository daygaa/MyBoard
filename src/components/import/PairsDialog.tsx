// Pop-in des paires (IMP-64, IMP-68, demandes du 10/11) : la liste contient des versions compressées ou converties par
// MyBoard (« photo_c.jpg », « photo.webp ») et leurs originaux, dans la liste ou déjà dans la bibliothèque. « Importer
// les deux » ; « Supprimer les doublons » : seuls les originaux sont gardés ; « Supprimer les originaux » : seules les
// versions (un original déjà dans la bibliothèque y est remplacé par sa version, sur la même fiche). Case « Supprimer
// du stockage » (décochée à chaque ouverture) : les fichiers écartés sont aussi effacés du disque, après une 2e pop-in
// à bordure rouge, définitivement (comme DEL-04) ; cochée, la pop-in prend le style des suppressions (bordure et boutons
// « Supprimer… » rouges). Échap ou la croix : rien n'est importé. Pas de raccourci Entrée : ce n'est pas un simple oui /
// non (demande du 10/11).

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import type { PairChoice, PairCount } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { keepQuoted } from "@/lib/keepWords";

/** Boutons rouges des suppressions (comme DeleteDialog, DEL-04). */
const RED = "bg-destructive text-white hover:bg-destructive/90";
const PLAIN = "border-border text-foreground hover:bg-secondary hover:text-foreground";
/** Les deux boutons « Supprimer… » sont dorés, puis rouges avec le stockage : même taille dans les deux cas (10/11). */
const GOLD = "bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]";

type Props = {
  count: PairCount;
  onAnswer: (choice: PairChoice, deleteFiles: boolean) => void;
  onCancel: () => void;
};

/** Originaux déjà dans la bibliothèque (IMP-68) : ce que fait « Supprimer les originaux » (texte reformulé le 10/11). */
function inLibraryText({ total, inLibrary }: PairCount): string {
  const replaced = "avec « Supprimer les originaux », il y est remplacé par sa version compressée ou convertie, qui reprend ses tags, ses favoris et ses dossiers.";
  if (total === 1) return `Son original est déjà dans la bibliothèque : ${replaced}`;
  if (inLibrary === total)
    return "Leurs originaux sont déjà dans la bibliothèque : avec « Supprimer les originaux », chacun y est remplacé par sa version compressée ou convertie, qui reprend ses tags, ses favoris et ses dossiers.";
  return `Pour ${formatNumber(inLibrary)} d'entre elles, l'original est déjà dans la bibliothèque : ${replaced}`;
}

export function PairsDialog({ count, onAnswer, onCancel }: Props) {
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [confirm, setConfirm] = useState<PairChoice | null>(null);
  const total = count.total;
  const one = total === 1;
  const choose = (choice: PairChoice) => (choice !== "both" && deleteFiles ? setConfirm(choice) : onAnswer(choice, false));

  if (confirm) {
    // Versions (féminin) ou originaux (masculin) : le participe s'accorde.
    const versions = confirm === "originals";
    const what = versions
      ? one
        ? "la version compressée ou convertie écartée"
        : "les versions compressées ou converties écartées"
      : one
        ? "l'original écarté"
        : "les originaux écartés";
    const erased = `${one ? "sera" : "seront"} effacé${versions ? "e" : ""}${one ? "" : "s"}`;
    return (
      <ConfirmDialog
        danger
        zone="import.paires.confirmation"
        title="Êtes-vous sûr de vouloir supprimer ces fichiers de votre stockage ?"
        message={`${what[0].toUpperCase()}${what.slice(1)} (${formatNumber(total)}) ${erased} définitivement du disque, sans passer par la Corbeille.`}
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
      danger={deleteFiles}
      zone="import.paires"
      onClose={onCancel}
      title="Originaux et versions compressées ou converties"
      description={
        <>
          <span className="block">
            {keepQuoted(
              `Cette liste contient ${formatNumber(total)} ${one ? "image" : "images"} en deux versions : l'original et sa version compressée ou convertie par MyBoard (par exemple « photo.jpg » et « photo_c.jpg », ou « photo.jpg » et « photo.webp »).`,
            )}
          </span>
          {count.inLibrary > 0 && <span className="mt-3 block">{keepQuoted(inLibraryText(count))}</span>}
          <span className="mt-5 block">Souhaitez-vous importer les originaux ET/OU leurs versions compressées ou converties dans la bibliothèque ?</span>
        </>
      }
      footer={
        <>
          <Button data-zone="import.paires.les-deux" variant="outline" onClick={() => choose("both")} className={PLAIN}>
            Importer les deux
          </Button>
          <Button data-zone="import.paires.doublons" onClick={() => choose("originals")} className={deleteFiles ? RED : GOLD}>
            Supprimer les doublons
          </Button>
          <Button data-zone="import.paires.originaux" onClick={() => choose("versions")} className={deleteFiles ? RED : GOLD}>
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
