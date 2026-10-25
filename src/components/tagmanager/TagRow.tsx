// Ligne du gestionnaire de tags (TAGM-04) : case (actions groupées, TAGM-11 ; toute la colonne est
// cliquable, TAGM-04.4) · nom (clic : recherche ;
// crayon : modifiable dans la ligne, Entrée valide, Échap annule) · catégorie · nombre de médias ·
// « Créé le » (TAGM-12) · description (TAGM-14) · synonymes (TAGM-15) · parents (TAGM-16) · œil (masquer,
// TAGM-05) · crayon · corbeille ; date et actions au centre de leur colonne (TAGM-04.3).
// Tag masqué : en gris. Clic droit : menu du tag (CTX-04, sans « Retirer de… »).

import { memo, useState } from "react";
import { CornerDownLeft, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";

import { CategorySelect } from "@/components/tags/CategorySelect";
import { Checkbox } from "@/components/ui/checkbox";
import type { ManagedTag } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import type { AliasRow, ParentRow } from "@/lib/rulesApi";
import { displayTag, withDescription } from "@/lib/tags";
import { setTagsCategory, setTagsHidden } from "@/lib/tagManager";
import { cn, titleIfCut } from "@/lib/utils";
import { ParentsCell, SynonymsCell } from "./RuleCells";
import type { TagOf } from "./RuleLines";
import { TagDescriptionButton } from "./TagDescriptionButton";

/** Colonnes, communes à l'en-tête et aux lignes. Description, Synonymes, Parents : 84 px, la place de leur
 *  titre et de la flèche du tri (78 px pour « Description », retour T3, point TAGM-04.7), pris sur le nom. */
export const COLUMNS = "grid grid-cols-[28px_minmax(0,1fr)_150px_72px_88px_84px_84px_84px_92px] items-center gap-2";

const ICON = "grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground";

/** Case de la 1re colonne : un clic n'importe où dans la colonne (marge de la ligne et écart avec le nom
 *  compris) la coche ou la décoche (TAGM-04.4). Zone de 44 px, autant de chaque côté de la case (16 px) :
 *  14 px à gauche et à droite (TAGM-04.10). */
export function CheckCell({ children }: { children: React.ReactNode }) {
  return <label className="-mx-2 flex cursor-pointer items-center justify-center self-stretch px-2">{children}</label>;
}

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
  /** Synonymes du tag, règles dont il est l'enfant, puis le parent (TAGM-15, TAGM-16). */
  aliases: AliasRow[];
  parents: ParentRow[];
  childRules: ParentRow[];
  tagOf: TagOf;
};

function NameEditor({ tag, onDone, onRename }: { tag: ManagedTag; onDone: () => void; onRename: Props["onRename"] }) {
  const [value, setValue] = useState(displayTag(tag.name));
  const submit = async () => {
    if (!value.trim()) return;
    if (await onRename(tag, value)) onDone();
  };
  // Bouton au bout du champ (TAGM-04.6) : valide comme Entrée ; il ne prend pas le focus (le champ, en
  // le perdant, annulerait le renommage).
  return (
    <div className="relative">
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
        className="h-7 w-full rounded-md border border-[#d9a94e]/60 bg-background pr-8 pl-2 font-mono text-sm text-foreground outline-none"
      />
      <button
        type="button"
        data-zone="gestionnaire-tags.renommer.valider"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => void submit()}
        aria-label="Renommer (Entrée)"
        title="Renommer (Entrée)"
        className="absolute top-1/2 right-1 grid h-5 w-6 -translate-y-1/2 place-items-center rounded text-[#d9a94e] transition hover:bg-secondary"
      >
        <CornerDownLeft className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export const TagRow = memo(function TagRow(props: Props) {
  const { tag, color, checked, editing, onCheck, onEdit, onRename, onSearch, onDelete, onMenu } = props;
  const label = displayTag(tag.name);
  return (
    <div
      data-zone="gestionnaire-tags.ligne"
      onContextMenu={(e) => onMenu(e, tag)}
      className={cn(COLUMNS, "h-full border-b border-border/60 px-2 text-sm hover:bg-secondary/40", checked && "bg-[#d9a94e]/5")}
    >
      <CheckCell>
        <Checkbox checked={checked} onCheckedChange={(c) => onCheck(tag.id, c === true)} aria-label={`Cocher « ${label} »`} />
      </CheckCell>
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
      <span className="text-center text-xs text-muted-foreground tabular-nums">{new Date(tag.createdAt).toLocaleDateString("fr-FR")}</span>
      <div className="flex justify-center">
        <TagDescriptionButton tag={tag} />
      </div>
      <div className="flex justify-center">
        <SynonymsCell tag={tag} aliases={props.aliases} tagOf={props.tagOf} />
      </div>
      <div className="flex justify-center">
        <ParentsCell tag={tag} parents={props.parents} childRules={props.childRules} tagOf={props.tagOf} />
      </div>
      <div className="flex justify-center gap-0.5">
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
