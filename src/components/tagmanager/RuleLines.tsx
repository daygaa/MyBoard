// Lignes des synonymes (TAGM-15) et des règles de parents (TAGM-16), communes à la page « Synonymes
// et parents » et aux petites listes du tableau du gestionnaire : case (cochée = active ; décochée =
// désactivée, en gris, gardée dans la liste), « synonyme → tag » ou « enfant → parent », nombre de
// médias notés, interrupteur « Auto » des règles, corbeille. Clic droit (CTX-16) : les mêmes actions.

import { ArrowRight, Trash2 } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { useCategories } from "@/hooks/useCategories";
import type { ManagedTag } from "@/lib/api";
import { openContextMenu, type MenuItem } from "@/lib/contextMenu";
import { formatNumber, plural } from "@/lib/format";
import type { AliasRow, ParentRow } from "@/lib/rulesApi";
import { aliasDeletion, deleteAlias, deleteParent, parentDeletion, toggleAlias, toggleAuto, toggleParent } from "@/lib/tagRules";
import { displayTag } from "@/lib/tags";
import { cn, titleIfCut } from "@/lib/utils";

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

function AutoSwitch({ row, names }: { row: ParentRow; names: (id: number) => string }) {
  const on = row.auto;
  return (
    <button
      type="button"
      role="switch"
      data-zone="regles.auto"
      aria-checked={on}
      disabled={!row.enabled}
      onClick={() => void toggleAuto(row, names)}
      title={`Ajout automatique : ${on ? "allumé" : "éteint"}. Allumé, chaque nouvel ajout de « ${displayTag(names(row.childId))} » pose « ${displayTag(names(row.parentId))} ».`}
      className="flex shrink-0 items-center gap-1.5 rounded px-1 text-[11px] text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
    >
      Auto
      <span className={cn("relative h-4 w-7 rounded-full border transition", on ? "border-[#d9a94e] bg-[#d9a94e]/30" : "border-[#70737d] bg-transparent")}>
        <span className={cn("absolute top-0.5 h-2.5 w-2.5 rounded-full transition-all", on ? "left-3.5 bg-[#d9a94e]" : "left-0.5 bg-[#70737d]")} />
      </span>
    </button>
  );
}

export function ParentLine({ row, tagOf, showChild = true }: { row: ParentRow; tagOf: TagOf; showChild?: boolean }) {
  const names = nameOf(tagOf);
  const parent = displayTag(names(row.parentId));
  return (
    <div
      data-zone="regles.parent"
      onContextMenu={(e) =>
        openContextMenu(e, () => [
          { label: row.enabled ? "Désactiver la règle" : "Réactiver la règle", run: () => void toggleParent(row, names) },
          { label: row.auto ? "Couper l'ajout automatique" : "Rallumer l'ajout automatique", disabled: !row.enabled, run: () => void toggleAuto(row, names) },
          "separator",
          menuDeletion("Supprimer la règle…", parentDeletion(row, names)),
        ])
      }
      className={cn(LINE, !row.enabled && "opacity-55")}
    >
      <Checkbox
        checked={row.enabled}
        onCheckedChange={() => void toggleParent(row, names)}
        aria-label={`Règle vers « ${parent} » active`}
        title={row.enabled ? `Active. Décocher retire « ${parent} » des médias qui l'ont reçu par elle.` : `Désactivée. Cocher remet « ${parent} » sur ces médias.`}
      />
      {showChild && (
        <>
          <TagName tag={tagOf(row.childId)} />
          <ArrowRight className={ARROW} />
        </>
      )}
      <TagName tag={tagOf(row.parentId)} />
      <Count n={row.media} title={`« ${parent} » posé sur ${formatNumber(row.media)} ${plural(row.media, "média")} par cette règle`} />
      <AutoSwitch row={row} names={names} />
      <Trash label="Supprimer la règle" onClick={() => deleteParent(row, names)} />
    </div>
  );
}
