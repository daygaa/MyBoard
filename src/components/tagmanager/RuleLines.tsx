// Lignes des synonymes (TAGM-15) et des règles de parents (TAGM-16), communes à la page « Synonymes
// et parents » et aux petites listes du tableau du gestionnaire : synonyme : case (cochée = actif ;
// décochée = désactivé, en gris, gardé dans la liste) ; règle : interrupteur (éteinte = en gris, refonte D10) ;
// « synonyme → tag » ou « enfant → parent », nombre de médias notés, corbeille. Clic droit (CTX-16) : les
// mêmes actions.

import { useState } from "react";
import { ArrowRight, Trash2 } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useCategories } from "@/hooks/useCategories";
import type { ManagedTag } from "@/lib/api";
import { openContextMenu, type MenuItem } from "@/lib/contextMenu";
import { formatNumber, plural } from "@/lib/format";
import type { AliasRow, ParentRow } from "@/lib/rulesApi";
import { aliasDeletion, deleteAlias, toggleAlias, toggleParent } from "@/lib/tagRules";
import { displayTag } from "@/lib/tags";
import { cn, titleIfCut } from "@/lib/utils";
import { ParentDeleteDialog } from "./ParentDeleteDialog";

export type TagOf = (id: number) => ManagedTag | undefined;

const LINE = "flex h-8 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-secondary/40";
const ARROW = "h-3 w-3 shrink-0 text-muted-foreground";

const nameOf = (tagOf: TagOf) => (id: number) => tagOf(id)?.name ?? "?";

/** Entrée rouge du menu, avec la même confirmation que la corbeille (CTX-01, CTX-02). */
const menuDeletion = (label: string, { title, message, run }: { title: string; message: string; run: () => unknown }): MenuItem => ({
  label,
  danger: true,
  confirm: { title, message, danger: true },
  run: () => void run(),
});

function TagName({ tag }: { tag: ManagedTag | undefined }) {
  const { color } = useCategories();
  return (
    <span onMouseEnter={(e) => titleIfCut(e.currentTarget)} className="min-w-0 truncate font-mono" style={{ color: tag && !tag.hidden ? color(tag.categoryId) : undefined }}>
      {tag ? displayTag(tag.name) : "?"}
    </span>
  );
}

function Count({ n, title }: { n: number; title: string }) {
  return (
    <span className="ml-auto shrink-0 pl-1 text-xs text-muted-foreground tabular-nums" title={n > 0 ? title : undefined}>
      {n > 0 ? formatNumber(n) : ""}
    </span>
  );
}

function Trash({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-zone="regles.supprimer"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-secondary hover:text-rose-400"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

export function AliasLine({ row, tagOf, showTarget = true }: { row: AliasRow; tagOf: TagOf; showTarget?: boolean }) {
  const names = nameOf(tagOf);
  return (
    <div
      data-zone="regles.synonyme"
      onContextMenu={(e) =>
        openContextMenu(e, () => [
          { label: row.enabled ? "Désactiver le synonyme" : "Réactiver le synonyme", run: () => void toggleAlias(row, names) },
          "separator",
          menuDeletion("Supprimer le synonyme…", aliasDeletion(row, names)),
        ])
      }
      className={cn(LINE, !row.enabled && "opacity-55")}
    >
      <Checkbox
        checked={row.enabled}
        onCheckedChange={() => void toggleAlias(row, names)}
        aria-label={`Synonyme « ${displayTag(row.alias)} » actif`}
        title={row.enabled ? "Actif. Décocher défait la fusion." : "Désactivé. Cocher le réactive."}
      />
      <span onMouseEnter={(e) => titleIfCut(e.currentTarget)} className="min-w-0 truncate font-mono text-muted-foreground">
        {displayTag(row.alias)}
      </span>
      {showTarget && (
        <>
          <ArrowRight className={ARROW} />
          <TagName tag={tagOf(row.tagId)} />
        </>
      )}
      <Count n={row.media} title={`${formatNumber(row.media)} ${plural(row.media, "média noté", "médias notés")} : décocher leur remet « ${displayTag(row.alias)} »`} />
      <Trash label="Supprimer le synonyme" onClick={() => deleteAlias(row, names)} />
    </div>
  );
}

export function ParentLine({ row, tagOf, showChild = true }: { row: ParentRow; tagOf: TagOf; showChild?: boolean }) {
  const names = nameOf(tagOf);
  const [deleting, setDeleting] = useState(false);
  const [child, parent] = [displayTag(names(row.childId)), displayTag(names(row.parentId))];
  return (
    <div
      data-zone="regles.parent"
      onContextMenu={(e) =>
        openContextMenu(e, () => [
          { label: row.enabled ? "Éteindre la règle" : "Allumer la règle", run: () => void toggleParent(row, names) },
          "separator",
          { label: "Supprimer la règle…", danger: true, dialog: ({ onCancel, onDone }) => <ParentDeleteDialog row={row} nameOf={names} onCancel={onCancel} onDone={onDone} /> },
        ])
      }
      className={cn(LINE, !row.enabled && "opacity-55")}
    >
      <Switch
        on={row.enabled}
        onToggle={() => void toggleParent(row, names)}
        zone="regles.interrupteur"
        label={`Règle « ${child} » → « ${parent} »`}
        title={row.enabled ? `Allumée : chaque nouvel ajout de « ${child} » pose « ${parent} ».` : `Éteinte : les nouveaux ajouts de « ${child} » ne posent plus « ${parent} » ; rien n'est retiré.`}
      />
      {showChild && (
        <>
          <TagName tag={tagOf(row.childId)} />
          <ArrowRight className={ARROW} />
        </>
      )}
      <TagName tag={tagOf(row.parentId)} />
      <Count n={row.media} title={`« ${parent} » posé sur ${formatNumber(row.media)} ${plural(row.media, "média")} par cette règle`} />
      <Trash label="Supprimer la règle" onClick={() => setDeleting(true)} />
      {deleting && <ParentDeleteDialog row={row} nameOf={names} onCancel={() => setDeleting(false)} onDone={() => setDeleting(false)} />}
    </div>
  );
}
