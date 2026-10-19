// Ligne du gestionnaire de tags (TAGM-04) : case (actions groupées, TAGM-11) · nom (clic : recherche ;
// crayon : modifiable dans la ligne, Entrée valide, Échap annule) · catégorie · nombre de médias ·
// « Créé le » (TAGM-12) · description (TAGM-14) · œil (masquer, TAGM-05) · crayon · corbeille.
// Tag masqué : en gris. Clic droit : menu du tag (CTX-04, sans « Retirer de… »).

import { memo, useState } from "react";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";

import { CategorySelect } from "@/components/tags/CategorySelect";
import { Checkbox } from "@/components/ui/checkbox";
import type { ManagedTag } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { displayTag, withDescription } from "@/lib/tags";
import { setTagsCategory, setTagsHidden } from "@/lib/tagManager";
import { cn, titleIfCut } from "@/lib/utils";
import { TagDescriptionButton } from "./TagDescriptionButton";

/** Colonnes, communes à l'en-tête et aux lignes. */
export const COLUMNS = "grid grid-cols-[28px_minmax(0,1fr)_160px_84px_96px_60px_92px] items-center gap-2";

const ICON = "grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground";

type Props = {
  tag: ManagedTag;
  color: string;
  checked: boolean;
  editing: boolean;
  onCheck: (id: number, on: boolean) => void;
  onEdit: (id: number | null) => void;
  /** Nouveau nom validé ; renvoie vrai si l'écriture est terminée. */
  onRename: (tag: ManagedTag, name: string) => Promise<boolean>;
  onSearch: (tag: ManagedTag) => void;
  onDelete: (tag: ManagedTag) => void;
  onMenu: (e: React.MouseEvent, tag: ManagedTag) => void;
};

function NameEditor({ tag, onDone, onRename }: { tag: ManagedTag; onDone: () => void; onRename: Props["onRename"] }) {
  const [value, setValue] = useState(displayTag(tag.name));
  const submit = async () => {
    if (!value.trim()) return;
    if (await onRename(tag, value)) onDone();
  };
  return (
    <input
      data-zone="gestionnaire-tags.renommer"
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void submit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onDone();
        }
      }}
      onBlur={onDone}
      className="h-7 w-full rounded-md border border-[#d9a94e]/60 bg-background px-2 font-mono text-sm text-foreground outline-none"
    />
  );
}

export const TagRow = memo(function TagRow({ tag, color, checked, editing, onCheck, onEdit, onRename, onSearch, onDelete, onMenu }: Props) {
  const label = displayTag(tag.name);
  return (
    <div
      data-zone="gestionnaire-tags.ligne"
      onContextMenu={(e) => onMenu(e, tag)}
      className={cn(COLUMNS, "h-full border-b border-border/60 px-2 text-sm hover:bg-secondary/40", checked && "bg-[#d9a94e]/5")}
    >
      <Checkbox checked={checked} onCheckedChange={(c) => onCheck(tag.id, c === true)} aria-label={`Cocher « ${label} »`} />
      <div className="min-w-0">
        {editing ? (
          <NameEditor tag={tag} onDone={() => onEdit(null)} onRename={onRename} />
        ) : (
          <button
            type="button"
            onClick={() => onSearch(tag)}
            onMouseEnter={(e) => titleIfCut(e.currentTarget)}
            title={withDescription(`Rechercher « ${label} »`, tag.description)}
            className="block max-w-full truncate text-left font-mono hover:underline"
            style={{ color: tag.hidden ? undefined : color }}
          >
            <span className={cn(tag.hidden && "text-muted-foreground")}>{label}</span>
          </button>
        )}
      </div>
      <CategorySelect
        zone="gestionnaire-tags.categorie"
        value={tag.categoryId}
        onChange={(id) => id !== null && id !== tag.categoryId && void setTagsCategory([tag.id], id)}
        className="h-7 rounded-md px-2 text-xs"
      />
      <span className="text-right text-xs text-muted-foreground tabular-nums">{formatNumber(tag.mediaCount)}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{new Date(tag.createdAt).toLocaleDateString("fr-FR")}</span>
      <div className="flex justify-center">
        <TagDescriptionButton tag={tag} />
      </div>
      <div className="flex justify-end gap-0.5">
        <button
          type="button"
          data-zone="gestionnaire-tags.masquer"
          onClick={() => void setTagsHidden([tag.id], !tag.hidden)}
          aria-label={tag.hidden ? "Ne plus masquer de la recherche" : "Masquer de la recherche"}
          title={tag.hidden ? "Masqué de la recherche : cliquer pour le montrer" : "Masquer de la recherche"}
          className={cn(ICON, tag.hidden && "text-[#d9a94e]")}
        >
          {tag.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
        <button type="button" data-zone="gestionnaire-tags.crayon" onClick={() => onEdit(tag.id)} aria-label="Renommer" title="Renommer" className={ICON}>
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          data-zone="gestionnaire-tags.supprimer"
          onClick={() => onDelete(tag)}
          aria-label="Supprimer le tag"
          title="Supprimer le tag"
          className={cn(ICON, "hover:text-rose-400")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
});
