// Pop-in « Créer un nouveau tag » (VIEW-22, v8 ✓) : le tag tapé n'existe pas encore,
// on choisit sa catégorie avant de le créer.

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
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
      description={
        <>
          Le tag « <code className="font-mono font-semibold text-foreground">{name}</code> » n'existe pas encore. Choisis
          une catégorie avant de le créer.
        </>
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
            className="bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]"
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
