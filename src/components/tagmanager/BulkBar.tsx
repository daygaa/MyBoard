// Actions groupées du gestionnaire de tags (TAGM-11), comme la barre du bas de la sélection des
// médias (SEL-07) : « K cochés · Sélectionner les N tags (ceux du filtre, TAGM-04.5) · Modifier la
// catégorie · Masquer · Ne plus masquer · Fusionner… · Supprimer… · Décocher », collée en bas de l'écran
// pendant le défilement. Changer la catégorie de 2 tags ou plus demande confirmation (retour T3, point
// TAGM-04.9, GEN-21) ; d'un seul, non (comme la liste de sa ligne).

import { useState } from "react";
import { X } from "lucide-react";

import { CategorySelect } from "@/components/tags/CategorySelect";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCategories } from "@/hooks/useCategories";
import type { ManagedTag } from "@/lib/api";
import { formatNumber, plural } from "@/lib/format";
import { setTagsCategory, setTagsHidden } from "@/lib/tagManager";

const ACTION = "h-8 border-border bg-card/60 text-xs hover:bg-secondary hover:text-foreground";

type Props = {
  tags: ManagedTag[];
  /** Tags du filtre en cours (tous, affichés ou non) : « Sélectionner les N tags » les coche tous. */
  matching: number;
  onSelectAll: () => void;
  allSelected: boolean;
  onMerge: () => void;
  onDelete: () => void;
  onClear: () => void;
};

export function BulkBar({ tags, matching, onSelectAll, allSelected, onMerge, onDelete, onClear }: Props) {
  const ids = tags.map((t) => t.id);
  const { byId } = useCategories();
  // Catégorie choisie, en attente de la confirmation.
  const [pending, setPending] = useState<number | null>(null);
  return (
    <div data-zone="gestionnaire-tags.groupe" className="sticky bottom-4 z-30 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-xl">
      <span className="mr-1 text-sm font-semibold text-foreground tabular-nums">
        {formatNumber(tags.length)} {plural(tags.length, "coché")}
      </span>
      <Button
        data-zone="gestionnaire-tags.groupe.tout"
        variant="outline"
        size="sm"
        disabled={allSelected}
        onClick={onSelectAll}
        className={ACTION}
      >
        Sélectionner {matching === 1 ? "le tag" : `les ${formatNumber(matching)} tags`}
      </Button>
      <CategorySelect
        zone="gestionnaire-tags.groupe.categorie"
        value={null}
        onChange={(id) => {
          if (id === null) return;
          if (ids.length > 1) setPending(id);
          else void setTagsCategory(ids, id);
        }}
        placeholder="Modifier la catégorie"
        className="h-8 w-48 text-xs"
      />
      <Button variant="outline" size="sm" onClick={() => void setTagsHidden(ids, true)} className={ACTION}>
        Masquer
      </Button>
      <Button variant="outline" size="sm" onClick={() => void setTagsHidden(ids, false)} className={ACTION}>
        Ne plus masquer
      </Button>
      <Button variant="outline" size="sm" disabled={tags.length < 2} onClick={onMerge} className={ACTION} title="Réunir ces tags en un seul">
        Fusionner…
      </Button>
      <Button variant="outline" size="sm" onClick={onDelete} className={`${ACTION} text-rose-300 hover:text-rose-200`}>
        Supprimer…
      </Button>
      <button
        type="button"
        onClick={onClear}
        aria-label="Tout décocher"
        title="Tout décocher"
        className="ml-auto grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      {pending !== null && (
        <ConfirmDialog
          zone="gestionnaire-tags.groupe.confirmation"
          title={`Changer la catégorie de ${formatNumber(ids.length)} tags ?`}
          message={`Les ${formatNumber(ids.length)} tags cochés passeront dans la catégorie « ${byId.get(pending)?.name ?? ""} ».`}
          confirmLabel="Changer"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            setPending(null);
            void setTagsCategory(ids, pending);
          }}
        />
      )}
    </div>
  );
}
