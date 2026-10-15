// Pop-in « Créer un nouveau tag » (VIEW-22, v8 ✓) : le tag tapé n'existe pas encore,
// on choisit sa catégorie avant de le créer. Nom long (VIEW-46) : à la ligne dans la largeur de
// la pop-in, 2 lignes au plus puis « … » (nom complet dans une bulle au survol) ; la pop-in grandit
// vers le haut, les boutons restent à leur place.

import { useLayoutEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { titleIfCut } from "@/lib/utils";
import { CategorySelect, useDefaultCategory } from "./CategorySelect";

type Props = {
  /** Nom du tag à créer ; `null` = pop-in fermée. */
  name: string | null;
  onCancel: () => void;
  onCreate: (categoryId: number) => void;
};

export function CreateTagDialog({ name, onCancel, onCreate }: Props) {
  const fallback = useDefaultCategory();
  const [chosen, setChosen] = useState<number | null>(null);
  const category = chosen ?? fallback;
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const [lift, setLift] = useState(0);
  // Avec un nom court, la phrase tient sur 2 lignes : chaque ligne de plus fait remonter la pop-in
  // d'une demi-ligne, ce qui garde son bas (et ses boutons) au même endroit.
  useLayoutEffect(() => {
    const p = descriptionRef.current;
    if (p) setLift(Math.max(0, p.offsetHeight - 2 * parseFloat(getComputedStyle(p).lineHeight)) / 2);
  }, [name]);
  const close = () => {
    setChosen(null);
    onCancel();
  };
  return (
    <Modal
      open={name !== null}
      onClose={close}
      zone="creation-tag"
      title="Créer un nouveau tag"
      lift={lift}
      description={
        <p ref={descriptionRef}>
          Le tag «{" "}
          <code
            onMouseEnter={(e) => titleIfCut(e.currentTarget)}
            className="max-w-full overflow-hidden align-top font-mono font-semibold text-foreground [overflow-wrap:anywhere]"
            // Boîte dans la ligne, coupée à 2 lignes par « … » (propriétés sans équivalent Tailwind).
            style={{ display: "-webkit-inline-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }}
          >
            {name}
          </code>{" "}
          » n'existe pas encore. Choisis une catégorie avant de le créer.
        </p>
      }
      footer={
        <>
          <Button variant="ghost" onClick={close} className="text-foreground hover:bg-secondary hover:text-foreground">
            Annuler
          </Button>
          <Button
            data-zone="creation-tag.creer"
            disabled={category === null}
            onClick={() => {
              if (category === null) return;
              setChosen(null);
              onCreate(category);
            }}
            className="bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f] disabled:hover:bg-[#d9a94e]"
          >
            <Plus className="h-4 w-4" />
            Créer
          </Button>
        </>
      }
    >
      <p className="mb-2 text-xs font-medium text-muted-foreground">Catégorie</p>
      <CategorySelect zone="creation-tag.categorie" value={category} onChange={setChosen} className="w-full" />
    </Modal>
  );
}
