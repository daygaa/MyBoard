// Tags du média dans la barre du bas de la visionneuse (VIEW-23, VIEW-39) : 3 lignes au plus ;
// s'il y en a davantage, « Afficher plus » au centre d'une 4ᵉ ligne (même flèche en V que les
// catégories de la barre latérale) déplie la barre vers le haut ; il devient « Réduire ».
// Hauteurs et dépliage : BottomPanel.

import type { CSSProperties, RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TagPills } from "./ViewerTags";

type Props = {
  mediaId: number;
  onSearch: (name: string) => void;
  expanded: boolean;
  /** Plus de 3 lignes : bouton « Afficher plus » / « Réduire ». */
  overflow: boolean;
  onToggle: () => void;
  areaRef: RefObject<HTMLDivElement | null>;
  boxRef: RefObject<HTMLDivElement | null>;
  /** Hauteur maximale des lignes de tags (3 lignes, ou la hauteur dépliée), animée. */
  maxHeight: number | undefined;
  /** Déplié et trop de tags pour la moitié de l'écran : barre de défilement. */
  scroll: boolean;
  onTransitionEnd: () => void;
  /** Hauteur gardée tant que les tags ne sont pas lus (VIEW-40) : sans elle, la barre rétrécissait
   *  à une ligne puis regrandissait, et le média sautait deux fois. */
  pendingHeight: number;
};

export function TagsArea(props: Props) {
  const { mediaId, onSearch, expanded, overflow, onToggle, areaRef, boxRef, maxHeight, scroll, onTransitionEnd, pendingHeight } = props;
  const { data: detail, isPending } = useQuery({ queryKey: ["media-detail", mediaId], queryFn: () => api.mediaDetail(mediaId) });
  const style: CSSProperties = { maxHeight, transition: "max-height 200ms ease-out" };
  return (
    <div ref={areaRef} className="flex min-h-0 flex-col gap-1" style={isPending ? { minHeight: pendingHeight } : undefined}>
      <div
        ref={boxRef}
        data-zone="visionneuse.tags"
        className={cn("flex min-h-6 flex-wrap items-center gap-1.5", scroll ? "overflow-y-auto pr-1" : "overflow-hidden")}
        style={style}
        onTransitionEnd={(e) => e.target === e.currentTarget && onTransitionEnd()}
      >
        {detail && <TagPills mediaId={mediaId} tags={detail.tags} onSearch={onSearch} />}
      </div>
      {overflow && (
        <button
          type="button"
          data-zone="visionneuse.tags.plus"
          onClick={onToggle}
          // Pas de focus au clic de la souris (le clavier y accède toujours) : sinon le contour de
          // focus apparaissait après un appui sur F (VIEW-43).
          onMouseDown={(e) => e.preventDefault()}
          aria-expanded={expanded}
          className="mx-auto flex items-center gap-1 rounded px-2 text-xs text-muted-foreground transition hover:text-foreground"
        >
          {expanded ? "Réduire" : "Afficher plus"}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
        </button>
      )}
    </div>
  );
}
