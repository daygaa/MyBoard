// Tableau du gestionnaire de tags (TAGM-04) : en-tête aux colonnes triables (clic ; flèche du sens),
// case « tout cocher » (les tags affichés), puis les lignes, virtualisées comme la grille (D-008) :
// fluide même avec des milliers de tags. Colonnes « Synonymes » et « Parents » : TAGM-15, TAGM-16.
// Sous le cadre, centrés (retour T3, point TAGM-04.5) : « Afficher 100 de plus », en languette accrochée à
// son bord du bas, puis « N / X tags affichés ». La ligne des titres reste sous le haut fixe de la page
// pendant le défilement (retour T3, point TAGM-15.3 ; `--haut-fixe` : hauteur de ce haut, TagManagerPage),
// sur un fond opaque de la couleur du cadre.

import { useLayoutEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { Checkbox } from "@/components/ui/checkbox";
import { useCategories } from "@/hooks/useCategories";
import type { RulesIndex } from "@/hooks/useTagRules";
import type { ManagedTag } from "@/lib/api";
import { formatNumber, plural } from "@/lib/format";
import { scroller } from "@/lib/scroller";
import type { ParentRow } from "@/lib/rulesApi";
import { cn } from "@/lib/utils";
import type { TagOf } from "./RuleLines";
import { SortHeader } from "./SortHeader";
import { CheckCell, COLUMNS, TagRow } from "./TagRow";
import type { Sort, SortKey } from "./useTagList";

/** Hauteur d'une ligne, bordure du bas comprise : 38 px utiles, un nombre pair, pour que la case, le nom,
 *  la catégorie et les boutons tombent pile au milieu (TAGM-04.10 ; à 37 px, tout était à un demi-pixel). */
const ROW_HEIGHT = 39;
/** Liste vide partagée : la ligne mémorisée ne se redessine pas pour rien. */
const NONE: never[] = [];

type RowHandlers = Pick<React.ComponentProps<typeof TagRow>, "onCheck" | "onEdit" | "onRename" | "onSearch" | "onDelete" | "onMenu">;

type Props = RowHandlers & {
  tags: ManagedTag[];
  checked: Set<number>;
  editing: number | null;
  sort: Sort;
  onSort: (key: SortKey) => void;
  onCheckAll: (on: boolean) => void;
  rules: RulesIndex;
  tagOf: TagOf;
  /** Tags du filtre en cours, affichés ou non. */
  total: number;
  /** Tags qu'ajouterait « Afficher … de plus » (0 : tous sont affichés, pas de bouton). */
  more: number;
  onMore: () => void;
};

export function TagTable({ tags, checked, editing, sort, onSort, onCheckAll, rules, tagOf, total, more, onMore, ...row }: Props) {
  const { color } = useCategories();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  // Position de la liste dans la zone qui défile (ce qui est au-dessus a pu changer de hauteur).
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const area = scroller();
    const next = el.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop;
    if (next !== top) setTop(next);
  });
  const virtualizer = useVirtualizer({
    count: tags.length,
    getScrollElement: scroller,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    scrollMargin: top,
  });
  const all = tags.length > 0 && tags.every((t) => checked.has(t.id));
  const some = !all && tags.some((t) => checked.has(t.id));

  return (
    <div>
      <div data-zone="gestionnaire-tags.tableau" className="rounded-xl border border-border bg-card/40">
        {/* Collée sous le haut fixe avec sa propre bordure (haut, côtés, coins arrondis), posée exactement sur
            celle du cadre (-1 px) : elle la garde une fois collée et ne bouge pas d'un pixel (retour T3, point
            TAGM-15.3) ; autour des coins, le fond de la page. 36 px utiles entre ses bordures : case « tout
            cocher » centrée (TAGM-04.10). */}
        <div className="sticky z-20 -mx-px -mt-px bg-background" style={{ top: "calc(57px + var(--haut-fixe, 0px))" }}>
          <div
            className={cn(
              COLUMNS,
              "h-[38px] rounded-t-xl border border-border bg-[color-mix(in_srgb,var(--card)_40%,var(--background))] px-2 text-xs font-medium text-muted-foreground",
            )}
          >
            <CheckCell>
              <Checkbox
                checked={all ? true : some ? "indeterminate" : false}
                onCheckedChange={(c) => onCheckAll(c === true)}
                aria-label="Cocher tous les tags affichés"
              />
            </CheckCell>
            <SortHeader label="Nom" sortKey="name" sort={sort} onSort={onSort} />
            <SortHeader label="Catégorie" sortKey="category" sort={sort} onSort={onSort} />
            <SortHeader label="Médias" sortKey="count" sort={sort} onSort={onSort} className="justify-end" />
            <SortHeader label="Créé le" sortKey="created" sort={sort} onSort={onSort} className="justify-center" />
            <SortHeader label="Description" sortKey="description" sort={sort} onSort={onSort} className="justify-center" />
            <SortHeader label="Synonymes" sortKey="aliases" sort={sort} onSort={onSort} className="justify-center" />
            <SortHeader label="Parents" sortKey="parents" sort={sort} onSort={onSort} className="justify-center" />
            <span className="text-center">Actions</span>
          </div>
        </div>
        <div ref={bodyRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const tag = tags[item.index];
            return (
              <div key={tag.id} className="absolute inset-x-0 top-0" style={{ height: ROW_HEIGHT, transform: `translateY(${item.start - top}px)` }}>
                <TagRow
                  tag={tag}
                  color={color(tag.categoryId)}
                  checked={checked.has(tag.id)}
                  editing={editing === tag.id}
                  group={rules.groupOf.get(tag.id) ?? null}
                  parents={rules.parentsOf.get(tag.id) ?? (NONE as ParentRow[])}
                  childRules={rules.childrenOf.get(tag.id) ?? NONE}
                  tagOf={tagOf}
                  {...row}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div data-zone="gestionnaire-tags.plus" className="flex flex-col items-center">
        {more > 0 && (
          <button
            type="button"
            data-zone="gestionnaire-tags.plus.afficher"
            onClick={onMore}
            className="h-8 rounded-b-lg border border-t-0 border-border bg-card/40 px-4 text-xs text-foreground transition hover:bg-secondary"
          >
            Afficher {formatNumber(more)} de plus
          </button>
        )}
        <span className="mt-2 text-xs text-muted-foreground tabular-nums select-text">
          {formatNumber(tags.length)} / {formatNumber(total)} {plural(total, "tag affiché", "tags affichés")}
        </span>
      </div>
    </div>
  );
}
