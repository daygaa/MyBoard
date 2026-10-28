// Lignes des règles de parents (TAGM-16), communes à la page « Synonymes et parents » et aux petites listes
// du tableau du gestionnaire : interrupteur (éteinte = en gris, refonte D10), « enfant → parent », nombre de
// médias où le parent a été posé, corbeille. Clic droit (CTX-16) : les mêmes actions. Les groupes de
// synonymes : GroupLine.tsx.

import { useState } from "react";
import { ArrowRight, Trash2 } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { useCategories } from "@/hooks/useCategories";
import type { ManagedTag } from "@/lib/api";
import { openContextMenu } from "@/lib/contextMenu";
import { formatNumber, plural } from "@/lib/format";
import type { ParentRow } from "@/lib/rulesApi";
import { toggleParent } from "@/lib/tagRules";
import { displayTag } from "@/lib/tags";
import { cn, titleIfCut } from "@/lib/utils";
import { ParentDeleteDialog } from "./ParentDeleteDialog";

export type TagOf = (id: number) => ManagedTag | undefined;

const LINE = "flex h-8 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-secondary/40";
const ARROW = "h-3 w-3 shrink-0 text-muted-foreground";

const nameOf = (tagOf: TagOf) => (id: number) => tagOf(id)?.name ?? "?";

export function TagName({ tag }: { tag: ManagedTag | undefined }) {
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
