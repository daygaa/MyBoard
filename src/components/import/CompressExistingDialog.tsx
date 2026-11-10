// Pop-in « Compresser aussi » / « Convertir aussi » (IMP-60, IMP-21) : au clic sur « Importer », compression ou
// conversion cochée, quand la liste contient des médias déjà dans la bibliothèque au même endroit et jamais traités.
// Remplacés, ils gardent leur fiche (tags, dossiers, favoris, note) : seul le fichier indiqué change. Textes accordés
// selon les types de médias (image, vidéo, document, fichier audio, ou média s'ils sont mélangés). « Supprimer les
// originaux » cochée (IMP-28) : ligne rouge à la place de celle des originaux gardés (réponse Q7 du 10/11).

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatNumber } from "@/lib/format";
import { keepQuoted } from "@/lib/keepWords";
import { mediaWords, type KindCounts } from "@/lib/mediaWords";

type Props = {
  counts: KindCounts;
  /** Conversion cochée : « Convertir aussi », « version convertie ». */
  convert: boolean;
  deleteOriginals: boolean;
  /** `true` : les traiter aussi ; `false` : les laisser tels quels. L'import démarre dans les deux cas. */
  onAnswer: (processExisting: boolean) => void;
  /** Annuler : l'import ne démarre pas. */
  onCancel: () => void;
};

export function CompressExistingDialog({ counts, convert, deleteOriginals, onAnswer, onCancel }: Props) {
  const w = mediaWords(counts);
  const { pick } = w;
  const tel = (w.feminine ? "telle quelle" : "tel quel").replace(/(\S+)/g, (word) => word + (w.plural ? "s" : ""));
  const leave = `${w.it[0].toUpperCase()}${w.it.slice(1)} laisser ${tel}`;
  const verb = convert ? "Convertir" : "Compresser";
  const done = convert ? "converti" : "compressé";
  return (
    <Modal
      open
      size="lg"
      zone="import.compresser-aussi"
      onClose={onCancel}
      onEnter={() => onAnswer(true)}
      title={`${verb} aussi ${w.the}${w.noun} déjà dans la bibliothèque ?`}
      description={
        <>
          <span className="block">
            {keepQuoted(
              `${formatNumber(w.total)} ${w.noun} de cette liste ${pick("est", "sont")} déjà dans la bibliothèque sans être ` +
                `${w.agree(done)}, souhaitez-vous ${w.it} remplacer ? (${w.they} ${pick("gardera", "garderont")} ` +
                `${pick("ses", "leurs")} tags, favoris, dossiers, etc. : ${w.the}${w.noun} ${pick("sera", "seront")} simplement ` +
                `${w.agree("échangé")} avec ${pick("sa", "leur")} version ${convert ? "convertie" : "compressée"})`,
            )}
          </span>
          {/* Une ligne vide au-dessus (demande du 10/11). */}
          {deleteOriginals ? (
            <span data-zone="import.compresser-aussi.originaux" className="mt-5 block text-rose-400">
              {pick("L'original sera supprimé définitivement du disque.", "Les originaux seront supprimés définitivement du disque.")}
            </span>
          ) : (
            <span data-zone="import.compresser-aussi.originaux" className="mt-5 block">
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
          <Button variant="ghost" onClick={onCancel} className="text-foreground hover:bg-secondary hover:text-foreground">
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
          <Button data-zone="import.compresser-aussi.oui" onClick={() => onAnswer(true)} className="bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]">
            {verb} aussi
          </Button>
        </>
      }
    />
  );
}
