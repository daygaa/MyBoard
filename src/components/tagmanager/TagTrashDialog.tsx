// Corbeille des tags (TAGM-19, réponses du 05/11), ouverte par « Corbeille (N) » du gestionnaire : pop-in assez grande.
// En haut, « Tout restaurer » et « Tout supprimer », chacun avec sa confirmation ; dessous, un tableau, les tags les
// plus récemment supprimés d'abord : le tag dans une pastille (celle de la recherche, un peu plus grande, sans croix),
// son nombre de médias, « Restaurer » et « Supprimer » (bordure rouge, fond rouge au survol), sans confirmation.
// TAGM-23 : seules les lignes visibles sont dessinées (13 000 lignes d'un coup prenaient 3,5 s à l'ouverture) ; les
// lignes restaurées ou supprimées partent au clic.

import { useLayoutEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";

import { TagPill } from "@/components/tags/TagPill";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useCategories } from "@/hooks/useCategories";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { deleteTrash, restoreTrash } from "@/lib/tagManager";
import { ask } from "@/lib/tagRules";
import { displayTag } from "@/lib/tags";
import { CANCEL } from "./TagChoice";

/** Tag masqué de la recherche : gris clair, comme dans la visionneuse (CTX-04). */
const HIDDEN_COLOR = "#a1a1aa";
const TOOL = "h-8 border-border bg-card/60 text-xs hover:bg-secondary hover:text-foreground";
const DELETE = "h-8 border border-destructive bg-transparent text-xs text-rose-300 hover:bg-destructive hover:text-white";
/** Tag · médias · deux boutons (largeur fixe : la ligne des titres, sans boutons, garde les mêmes colonnes). */
const COLUMNS = "grid grid-cols-[minmax(0,1fr)_5rem_11rem] items-center gap-3";
/** Hauteur d'une ligne (boutons de 32 px, 8 px au-dessus et dessous, trait de 1 px) ; mesurée ensuite. */
const ROW = 49;

export function TagTrashDialog({ onClose }: { onClose: () => void }) {
  const { data } = useQuery({ queryKey: ["tag-trash"], queryFn: api.trashList });
  const { color } = useCategories();
  const tags = data ?? [];
  const n = tags.length;
  const ids = tags.map((t) => t.id);
  // La liste défile avec le contenu de la pop-in : seules les lignes visibles sont dessinées.
  const listRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState<{ scroller: HTMLElement; margin: number } | null>(null);
  const shown = n > 0;
  useLayoutEffect(() => {
    const list = listRef.current;
    const scroller = list?.closest<HTMLElement>(".overflow-y-auto");
    if (!list || !scroller) return setArea(null);
    setArea({ scroller, margin: list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop });
  }, [shown]);
  const virtualizer = useVirtualizer({ count: n, getScrollElement: () => area?.scroller ?? null, estimateSize: () => ROW, overscan: 12, scrollMargin: area?.margin ?? 0 });
  const restoreAll = () =>
    void ask({
      title: "Tout restaurer ?",
      message:
        n > 1
          ? `Les ${formatNumber(n)} tags de la corbeille seront restaurés, avec leurs médias, leurs groupes de synonymes et leurs règles de parents.`
          : "Le tag de la corbeille sera restauré, avec ses médias, son groupe de synonymes et ses règles de parents.",
      confirmLabel: "Tout restaurer",
      run: () => restoreTrash(ids),
    });
  const deleteAll = () =>
    void ask({
      title: "Tout supprimer ?",
      message: n > 1 ? `Les ${formatNumber(n)} tags de la corbeille seront définitivement supprimés.` : "Le tag de la corbeille sera définitivement supprimé.",
      confirmLabel: "Tout supprimer",
      danger: true,
      run: () => deleteTrash(ids),
    });
  return (
    <Modal
      open
      wide
      onClose={onClose}
      zone="tags-corbeille"
      title="Corbeille"
      description="Chaque tag supprimé y reste 30 jours, avec ses médias, ses synonymes et ses règles de parents."
      footer={
        <Button variant="ghost" onClick={onClose} className={CANCEL}>
          Fermer
        </Button>
      }
    >
      <div className="flex gap-2">
        <Button data-zone="tags-corbeille.tout-restaurer" variant="outline" size="sm" disabled={n === 0} onClick={restoreAll} className={TOOL}>
          Tout restaurer
        </Button>
        <Button data-zone="tags-corbeille.tout-supprimer" size="sm" disabled={n === 0} onClick={deleteAll} className={DELETE}>
          Tout supprimer
        </Button>
      </div>
      {n === 0 ? (
        <p data-zone="tags-corbeille.vide" className="mt-4 text-sm text-muted-foreground">
          La corbeille est vide.
        </p>
      ) : (
        <div data-zone="tags-corbeille.liste" className="mt-4">
          <div className={`${COLUMNS} border-b border-border pb-1.5 text-xs font-medium text-muted-foreground`}>
            <span>Tag</span>
            <span className="text-right">Médias</span>
            <span />
          </div>
          <div ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((row) => {
              const t = tags[row.index];
              return (
                <div
                  key={t.id}
                  ref={virtualizer.measureElement}
                  data-index={row.index}
                  data-zone="tags-corbeille.ligne"
                  className={`${COLUMNS} absolute inset-x-0 top-0 border-b border-border/50 py-2`}
                  style={{ transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)` }}
                >
                  <span className="min-w-0">
                    {/* 1 px de plus en haut : avec la police plus grande, le texte (remonté de 2 px comme toutes les pastilles) était
                        0,5 px trop haut ; il tombe ainsi au centre, comme dans la recherche (mesuré le 05/11). */}
                    <TagPill color={t.hidden ? HIDDEN_COLOR : color(t.categoryId ?? 0)} fullTitleIfCut className="px-2.5 pt-[5px] pb-1 text-sm">
                      {displayTag(t.name)}
                    </TagPill>
                  </span>
                  <span className="text-right text-sm text-foreground tabular-nums">{formatNumber(t.media)}</span>
                  <span className="flex justify-end gap-2">
                    <Button data-zone="tags-corbeille.restaurer" variant="outline" size="sm" onClick={() => void restoreTrash([t.id])} className={TOOL}>
                      Restaurer
                    </Button>
                    <Button data-zone="tags-corbeille.supprimer" size="sm" onClick={() => void deleteTrash([t.id])} className={DELETE}>
                      Supprimer
                    </Button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
