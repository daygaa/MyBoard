// Pop-in « Compresser aussi » (IMP-60) : au clic sur « Importer », « Compresser les images » cochée, quand la liste
// contient des médias déjà dans la bibliothèque au même endroit et jamais compressés. Compressés, ils gardent leur
// fiche (tags, dossiers, favoris, note) : seul le fichier indiqué change. Textes accordés selon les types de médias
// (image, vidéo, document, fichier audio, ou média s'ils sont mélangés). Entrée : « Compresser aussi ».

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatNumber } from "@/lib/format";
import { keepQuoted } from "@/lib/keepWords";
import { mediaWords, type KindCounts } from "@/lib/mediaWords";

type Props = {
  counts: KindCounts;
  /** « Supprimer les originaux » cochée (IMP-28, lot 4) : la ligne sur les originaux gardés disparaît. */
  deleteOriginals?: boolean;
  /** `true` : les compresser aussi ; `false` : les laisser tels quels. L'import démarre dans les deux cas. */
  onAnswer: (compressExisting: boolean) => void;
  /** Annuler : l'import ne démarre pas. */
  onCancel: () => void;
};

export function CompressExistingDialog({
  counts,
  deleteOriginals = false,
  onAnswer,
  onCancel,
}: Props) {
  const w = mediaWords(counts);
  const { pick } = w;
  const tel = (w.feminine ? "telle quelle" : "tel quel").replace(
    /(\S+)/g,
    (word) => word + (w.plural ? "s" : ""),
  );
  const leave = `${w.it[0].toUpperCase()}${w.it.slice(1)} laisser ${tel}`;
  return (
    <Modal
      open
      size="lg"
      zone="import.compresser-aussi"
      onClose={onCancel}
      onEnter={() => onAnswer(true)}
      title={`Compresser aussi ${w.the}${w.noun} déjà dans la bibliothèque ?`}
      description={
        <>
          <span className="block">
            {keepQuoted(
              `${formatNumber(w.total)} ${w.noun} de cette liste ${pick("est", "sont")} déjà dans la bibliothèque sans être ` +
                `${w.agree("compressé")}, souhaitez-vous ${w.it} remplacer ? (${w.they} ${pick("gardera", "garderont")} ` +
                `${pick("ses", "leurs")} tags, favoris, dossiers, etc. : ${w.the}${w.noun} ${pick("sera", "seront")} simplement ` +
                `${w.agree("échangé")} avec ${pick("sa", "leur")} version compressée)`,
            )}
          </span>
          {/* Une ligne vide au-dessus (demande du 10/11) ; disparaît quand « Supprimer les originaux » est cochée (IMP-28, lot 4). */}
          {!deleteOriginals && (
            <span
              data-zone="import.compresser-aussi.originaux"
              className="mt-5 block"
            >
              {pick(
                "L'original sera toujours disponible à son emplacement actuel.",
                "Les originaux seront toujours disponibles à leurs emplacements actuels.",
              )}
            </span>
          )}
        </>
      }
      footer={
        <>
          <Button
            variant="ghost"
            onClick={onCancel}
            className="text-foreground hover:bg-secondary hover:text-foreground"
          >
            Annuler
          </Button>
          <Button
            data-zone="import.compresser-aussi.non"
            variant="outline"
            onClick={() => onAnswer(false)}
            className="border-border text-foreground hover:bg-secondary hover:text-foreground"
          >
            {leave}
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
