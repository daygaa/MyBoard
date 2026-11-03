// Lignes des règles de parents (TAGM-16), communes à la page « Synonymes et parents » et aux petites listes
// du tableau du gestionnaire : interrupteur (éteinte = en gris, refonte D10), « enfant → parent », nombre de
// médias où le parent a été posé, corbeille. Clic droit (CTX-16) : les mêmes actions. Fusion (lot R5) : une
// règle mise de côté est grise, son interrupteur grisé, avec une bulle ; une règle déplacée a le repère « = »,
// sa règle d'origine au survol. Les groupes de synonymes : GroupLine.tsx.

import { useState, type MouseEvent, type ReactNode } from "react";
import { ArrowRight, Equal, Trash2 } from "lucide-react";

import { HoverCard } from "@/components/ui/hover-card";
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
/** Colonne de l'interrupteur dans l'onglet « Synonymes et parents » : la largeur de son titre « On/Off » et de la
 *  flèche du tri (RulesTitles.tsx, retour T3, point TAGM-15.10). */
export const SWITCH_COLUMN = "w-[58px] shrink-0";

/** Nom d'un tag à la couleur de sa catégorie ; `fallback` : son nom tant que la liste des tags ne le connaît pas
 *  encore (tag tout juste créé avec son groupe : la ligne affichait « ? », retour T3, point TAGM-15.25). */
export function TagName({ tag, fallback }: { tag: ManagedTag | undefined; fallback?: string }) {
  const { color } = useCategories();
  const name = tag?.name ?? fallback;
  return (
    <span onMouseEnter={(e) => titleIfCut(e.currentTarget)} className="min-w-0 truncate font-mono" style={{ color: tag && !tag.hidden ? color(tag.categoryId) : undefined }}>
      {name !== undefined ? displayTag(name) : "?"}
    </span>
  );
}

function Count({ n, title, dim }: { n: number; title: string; dim: boolean }) {
  return (
    <span className={cn("ml-auto shrink-0 pl-1 text-xs text-muted-foreground tabular-nums", dim && "opacity-55")} title={n > 0 ? title : undefined}>
      {n > 0 ? formatNumber(n) : ""}
    </span>
  );
}

function Trash({ label, onClick, dim }: { label: string; onClick: () => void; dim: boolean }) {
  return (
    <button
      type="button"
      data-zone="regles.supprimer"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn("grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-secondary hover:text-rose-400", dim && "opacity-55")}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

/** Bulle de MyBoard sous la ligne, au survol de `children`. */
function Hint({ text, zone, dim = false, children }: { text: string | null; zone: string; dim?: boolean; children: ReactNode }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const enter = (e: MouseEvent<HTMLElement>) => text && setAnchor(e.currentTarget.closest('[data-zone="regles.parent"]')?.getBoundingClientRect() ?? null);
  return (
    <span onMouseEnter={enter} onMouseLeave={() => setAnchor(null)} className={cn("flex min-w-0 items-center gap-2", dim && "opacity-55")}>
      {children}
      {anchor && text && (
        <HoverCard anchor={anchor} place="below" zone={zone}>
          {text}
        </HoverCard>
      )}
    </span>
  );
}

/** Repère « = » d'une règle déplacée par une fusion (réponse 4 du lot R5, refonte D11.2). */
function OriginMark({ text, dim }: { text: string; dim: boolean }) {
  return (
    <Hint text={text} zone="regles.parent.origine" dim={dim}>
      <span data-zone="regles.parent.egal" className="grid shrink-0 place-items-center text-muted-foreground">
        <Equal className="h-3.5 w-3.5" />
      </span>
    </Hint>
  );
}

/** `origin` : repère « = » des règles déplacées (seulement dans l'onglet « Synonymes et parents », réponse 4 du lot R5) ;
 *  `column` : interrupteur dans la colonne de son titre (même onglet). */
export function ParentLine({ row, tagOf, showChild = true, origin = true, column = false }: { row: ParentRow; tagOf: TagOf; showChild?: boolean; origin?: boolean; column?: boolean }) {
  // Noms lus avec la règle tant que la liste des tags ne connaît pas un tag tout juste créé (retour T3, point TAGM-16.7).
  const names = (id: number) => tagOf(id)?.name ?? (id === row.childId ? row.childName : id === row.parentId ? row.parentName : "?");
  const [deleting, setDeleting] = useState(false);
  const [child, parent] = [displayTag(names(row.childId)), displayTag(names(row.parentId))];
  // Mise de côté : elle ne pose rien pendant la fusion, son interrupteur est grisé (réponse 2 du lot R5).
  // Éteinte ou mise de côté : la ligne en gris ; l'icône de suppression d'une règle mise de côté reste nette, la
  // suppression restant possible (retour du 02/11 sur le lot R5-1).
  const dim = !row.enabled || row.aside !== null;
  const aside = row.aside ? `Mise de côté : « ${displayTag(row.aside.name)} » est fusionné dans « ${displayTag(row.aside.principal)} ». Elle reviendra à la défusion.` : null;
  const from = (tag: string | null, now: string) => (tag ? `« ${displayTag(tag)} » est fusionné dans « ${now} »` : "");
  const moved =
    origin && (row.childFrom || row.parentFrom)
      ? `Règle d'origine : « ${row.childFrom ? displayTag(row.childFrom) : child} » → « ${row.parentFrom ? displayTag(row.parentFrom) : parent} » (${[from(row.childFrom, child), from(row.parentFrom, parent)].filter(Boolean).join(", ")})`
      : null;
  // Le tag déplacé montre aussi la règle d'origine au survol.
  const name = (id: number, fallback: string, wasMoved: boolean) => (
    <Hint text={wasMoved && !aside ? moved : null} zone="regles.parent.origine">
      <TagName tag={tagOf(id)} fallback={fallback} />
    </Hint>
  );
  return (
    <div
      data-zone="regles.parent"
      onContextMenu={(e) =>
        openContextMenu(e, () => [
          { label: row.enabled ? "Désactiver la règle" : "Activer la règle", run: () => void toggleParent(row, names), disabled: aside !== null },
          "separator",
          { label: "Supprimer la règle…", danger: true, dialog: ({ onCancel, onDone }) => <ParentDeleteDialog row={row} nameOf={names} onCancel={onCancel} onDone={onDone} /> },
        ])
      }
      className={LINE}
    >
      <Hint text={aside} zone="regles.parent.mise-de-cote" dim={dim}>
        <span className={cn("flex", column && SWITCH_COLUMN)}>
          <Switch
            on={row.enabled}
            onToggle={() => void toggleParent(row, names)}
            zone="regles.interrupteur"
            disabled={aside !== null}
            label={`Règle « ${child} » → « ${parent} »`}
            title={aside ? undefined : row.enabled ? `Activée : chaque nouvel ajout de « ${child} » pose « ${parent} ».` : `Désactivée : les nouveaux ajouts de « ${child} » ne posent plus « ${parent} » ; rien n'est retiré.`}
          />
        </span>
        {showChild && (
          <>
            {name(row.childId, row.childName, row.childFrom !== null)}
            <ArrowRight className={ARROW} />
          </>
        )}
        {name(row.parentId, row.parentName, row.parentFrom !== null)}
      </Hint>
      {moved && <OriginMark text={moved} dim={dim} />}
      <Count dim={dim} n={row.media} title={`« ${parent} » posé sur ${formatNumber(row.media)} ${plural(row.media, "média")} par cette règle`} />
      <Trash label="Supprimer la règle" onClick={() => setDeleting(true)} dim={!row.enabled && !aside} />
      {deleting && <ParentDeleteDialog row={row} nameOf={names} onCancel={() => setDeleting(false)} onDone={() => setDeleting(false)} />}
    </div>
  );
}
