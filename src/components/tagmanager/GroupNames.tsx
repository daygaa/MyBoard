// Noms d'un groupe de synonymes, une ligne chacun (refonte, décisions D2, D3 ; point TAGM-15.17 : par ordre
// alphabétique, le principal rangé avec les autres) : étoile pour en faire le principal, nom, médias, interrupteur de
// fusion, croix « Retirer du groupe » ; le principal a son étoile pleine, sans interrupteur ni croix. Clic droit
// (CTX-16) sur chaque nom. Panneau déplié d'un groupe (GroupLine) et petite liste de la colonne « Synonymes » du
// tableau des tags (RuleCells, réponse 3 A du lot R4).

import { Star, X } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { openContextMenu } from "@/lib/contextMenu";
import { formatNumber } from "@/lib/format";
import { makePrincipal, nameRemoval, toggleName } from "@/lib/groupRules";
import type { GroupRow, NameRow } from "@/lib/rulesApi";
import { ask } from "@/lib/tagRules";
import { displayTag } from "@/lib/tags";
import { cn, titleIfCut } from "@/lib/utils";
import { TagName, type TagOf } from "./RuleLines";

export const LINE = "flex h-8 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-secondary/40";
export const ICON = "grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-secondary";

/** Confirmation d'une entrée rouge du menu (CTX-02) : le texte sur une seule ligne. */
export const menuConfirm = ({ title, message, run }: { title: string; message: string; run: () => unknown }) => ({
  danger: true,
  confirm: { title, message: message.replace(/\n/g, " "), danger: true },
  run: () => void run(),
});

/** Nom d'un groupe : un tag relié à la couleur de sa catégorie, un tag fusionné en gris. */
export function Name({ name, tagOf }: { name: NameRow; tagOf: TagOf }) {
  if (!name.merged) return <TagName tag={tagOf(name.tagId)} fallback={name.name} />;
  return (
    <span onMouseEnter={(e) => titleIfCut(e.currentTarget)} className="min-w-0 truncate font-mono text-muted-foreground">
      {displayTag(name.name)}
    </span>
  );
}

function NameLine({ group, name, principal, tagOf }: { group: GroupRow; name: NameRow; principal: string; tagOf: TagOf }) {
  const removal = nameRemoval(name, principal);
  return (
    <div
      data-zone="regles.groupe.nom"
      onContextMenu={(e) =>
        openContextMenu(e, () => [
          { label: "Devenir le tag principal", run: () => void makePrincipal(group, name, principal) },
          { label: name.merged ? "Défusionner" : "Fusionner", run: () => void toggleName(name, principal) },
          "separator",
          { label: "Retirer du groupe…", ...menuConfirm(removal) },
        ])
      }
      className={LINE}
    >
      <button type="button" data-zone="regles.groupe.etoile" onClick={() => void makePrincipal(group, name, principal)} title="En faire le tag principal" className={cn(ICON, "hover:text-[#d9a94e]")}>
        <Star className="h-3.5 w-3.5" />
      </button>
      <Name name={name} tagOf={tagOf} />
      <span className="ml-auto shrink-0 pl-1 text-xs text-muted-foreground tabular-nums" title={name.merged ? "Médias fusionnés dans le tag principal" : undefined}>
        {name.media > 0 ? formatNumber(name.media) : ""}
      </span>
      <Switch
        on={name.merged}
        onToggle={() => void toggleName(name, principal)}
        zone="regles.groupe.nom.fusion"
        label={`Fusion de « ${displayTag(name.name)} »`}
        title={name.merged ? `Fusionné dans « ${displayTag(principal)} ».` : "Activer la fusion"}
      />
      <button type="button" data-zone="regles.groupe.retirer" onClick={() => void ask({ ...removal, confirmLabel: "Oui" })} title="Retirer du groupe" className={cn(ICON, "hover:text-rose-400")}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Noms par ordre alphabétique (sans les « _ »). */
export const byName = (a: { name: string }, b: { name: string }) => displayTag(a.name).localeCompare(displayTag(b.name));

/** Place de l'interrupteur et de l'icône de fin de ligne, pour aligner les colonnes de droite. */
const SPACER = <span aria-hidden className="w-7 shrink-0" />;
const ICON_SPACER = <span aria-hidden className="w-6 shrink-0" />;

export function GroupNames({ group, tagOf, zone }: { group: GroupRow; tagOf: TagOf; zone: string }) {
  const principal = group.principalName;
  const principalTag = tagOf(group.principalId);
  // Ordre alphabétique, le tag principal rangé avec les autres : changer de principal ne déplace aucun nom.
  const rows = [...group.names.map((n) => ({ key: n.id, name: n.name, row: n as NameRow | null })), { key: -1, name: principal, row: null }].sort(byName);
  return (
    <div data-zone={zone} className="py-1">
      {rows.map(({ key, row }) =>
        row ? (
          <NameLine key={key} group={group} name={row} principal={principal} tagOf={tagOf} />
        ) : (
          <div key={key} className={LINE}>
            <span className={ICON} title="Tag principal">
              <Star className="h-3.5 w-3.5 fill-[#d9a94e] text-[#d9a94e]" />
            </span>
            <TagName tag={principalTag} fallback={principal} />
            <span className="ml-auto shrink-0 pl-1 text-xs text-muted-foreground tabular-nums">{principalTag ? formatNumber(principalTag.mediaCount) : ""}</span>
            {SPACER}
            {ICON_SPACER}
          </div>
        ),
      )}
    </div>
  );
}
