// Pop-in des paires (IMP-64, IMP-68, demandes du 10/11) : la liste contient des versions compressées ou converties par
// MyBoard (« photo_c.jpg », « photo.webp », « video_c.mp4 ») et leurs originaux, dans la liste ou déjà dans la
// bibliothèque. Textes accordés selon le type (images, vidéos, médias) et « l'originale » (demande du 11/11). Boutons
// renommés le 11/11 (IMP-75) : « Importer les originaux » (ancien « Supprimer les doublons ») et « Importer les
// doublons » (ancien « Supprimer les originaux »), mêmes places, même fonctionnement ; la 2e confirmation garde « Supprimer… ». « Importer
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
import { mediaWords } from "@/lib/mediaWords";

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

/** « image(s) », « vidéo(s) » ou « médias » (IMP-68, 11/11) ; « l'original » s'accorde avec l'image ou la vidéo. */
function words(count: PairCount) {
  const w = mediaWords({ images: count.images, videos: count.videos, audio: 0, documents: 0 });
  const f = w.feminine;
  return { ...w, original: f ? "originale" : "original", originals: f ? "originales" : "originaux", it: f ? "elle" : "il", e: f ? "e" : "" };
}

/** Originaux déjà dans la bibliothèque (IMP-68) : ce que fait « Supprimer les originaux » (texte du 10/11, accordé le 11/11). */
function inLibraryText(count: PairCount): string {
  const w = words(count);
  const rest = `par sa version compressée ou convertie, qui reprend ses tags, ses favoris et ses dossiers.`;
  const replaced = `avec « Importer les doublons », ${w.it} y est remplacé${w.e} ${rest}`;
  if (count.total === 1) return `Son ${w.original} est déjà dans la bibliothèque : ${replaced}`;
  if (count.inLibrary === count.total)
    return `Leurs ${w.originals} sont déjà dans la bibliothèque : avec « Importer les doublons », chacun${w.e} y est remplacé${w.e} ${rest}`;
  return `Pour ${formatNumber(count.inLibrary)} d'entre ${w.feminine ? "elles" : "eux"}, l'${w.original} est déjà dans la bibliothèque : ${replaced}`;
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
        dangerBorder
        zone="import.paires.confirmation"
        title="Êtes-vous sûr de vouloir supprimer ces fichiers de votre stockage ?"
        message={
          <>
            <span className="block">{`${what[0].toUpperCase()}${what.slice(1)} (${formatNumber(total)}) ${erased} définitivement du disque, sans passer par la Corbeille.`}</span>
            {/* IMP-43, réponse Q3 B du 11/11 : des fichiers effacés, l'import ne peut plus être annulé. */}
            <span className="mt-4 block">{keepQuoted("« Annuler l'import » ne pourra pas défaire cet import.")}</span>
          </>
        }
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
              `Cette liste contient ${formatNumber(total)} ${words(count).noun} en deux versions : l'${words(count).original} et sa version compressée ou convertie par MyBoard.`,
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
          <Button data-zone="import.paires.importer-originaux" onClick={() => choose("originals")} className={deleteFiles ? RED : GOLD}>
            Importer les originaux
          </Button>
          <Button data-zone="import.paires.importer-doublons" onClick={() => choose("versions")} className={deleteFiles ? RED : GOLD}>
            Importer les doublons
          </Button>
        </>
      }
    >
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-foreground">
        <Checkbox data-principale data-zone="import.paires.stockage" checked={deleteFiles} onCheckedChange={(c) => setDeleteFiles(c === true)} />
        Supprimer du stockage la version non importée
      </label>
    </Modal>
  );
}
