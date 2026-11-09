// Pop-in « Compresser aussi » (IMP-60) : au clic sur « Importer », « Compresser les images » cochée, quand la liste
// contient des images déjà dans la bibliothèque au même endroit et jamais compressées. Compressées, elles gardent
// leur fiche (tags, dossiers, favoris, note) : seul le fichier indiqué change. Entrée : « Compresser aussi ».

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatNumber } from "@/lib/format";

type Props = {
  count: number;
  /** `true` : les compresser aussi ; `false` : les laisser telles quelles. L'import démarre dans les deux cas. */
  onAnswer: (compressExisting: boolean) => void;
  /** Annuler : l'import ne démarre pas. */
  onCancel: () => void;
};

export function CompressExistingDialog({ count, onAnswer, onCancel }: Props) {
  const one = count === 1;
  return (
    <Modal
      open
      zone="import.compresser-aussi"
      onClose={onCancel}
      onEnter={() => onAnswer(true)}
      title={one ? "Compresser aussi l'image déjà dans la bibliothèque ?" : "Compresser aussi les images déjà dans la bibliothèque ?"}
      description={
        <>
          {one
            ? "1 image de cette liste est déjà dans la bibliothèque. Compressée, elle garde ses tags, dossiers, favoris et note : seul son fichier change."
            : `${formatNumber(count)} images de cette liste sont déjà dans la bibliothèque. Compressées, elles gardent leurs tags, dossiers, favoris et note : seul leur fichier change.`}{" "}
          La version compressée (« photo (compressé).jpg ») est écrite à côté de l'original, qui reste sur le disque.
        </>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} className="text-foreground hover:bg-secondary hover:text-foreground">
            Annuler
          </Button>
          <Button
            data-zone="import.compresser-aussi.non"
            variant="outline"
            onClick={() => onAnswer(false)}
            className="border-border text-foreground hover:bg-secondary hover:text-foreground"
          >
            {one ? "La laisser telle quelle" : "Les laisser telles quelles"}
          </Button>
          <Button
            data-zone="import.compresser-aussi.oui"
            onClick={() => onAnswer(true)}
            className="bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]"
          >
            Compresser aussi
          </Button>
        </>
      }
    />
  );
}
