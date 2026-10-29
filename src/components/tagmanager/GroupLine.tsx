// Ligne d'un groupe de synonymes (refonte, décisions D2, D2.1, D3 ; propositions 3, 4 et 7 du lot R3) :
// « ▸ » pour déplier, ★ principal, les autres noms (couleur de leur catégorie s'ils sont reliés, gris s'ils sont
// fusionnés), interrupteur du groupe (« à moitié » s'il est en partie fusionné), nombre de médias, corbeille.
// Dépliée : une ligne par nom (étoile pour en faire le principal, interrupteur de fusion, croix « Retirer du
// groupe »). Clic droit (CTX-16) sur le groupe et sur chaque nom ; « Annuler » rend le menu (CTX-02).

import { useState } from "react";
import { ChevronRight, Star, Trash2, X } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { openContextMenu, type MenuEntry } from "@/lib/contextMenu";
import { formatNumber, plural } from "@/lib/format";
import { groupDeletion, groupState, makePrincipal, nameRemoval, toggleGroup, toggleName, unmergeGroup } from "@/lib/groupRules";
import type { GroupRow, NameRow } from "@/lib/rulesApi";
import { ask } from "@/lib/tagRules";
import { displayTag } from "@/lib/tags";
import { cn, titleIfCut } from "@/lib/utils";
import { TagName, type TagOf } from "./RuleLines";

const LINE = "flex h-8 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-secondary/40";
const ICON = "grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-secondary";

/** Confirmation d'une entrée rouge du menu (CTX-02) : le texte sur une seule ligne. */
const menuConfirm = ({ title, message, run }: { title: string; message: string; run: () => unknown }) => ({
  danger: true,
  confirm: { title, message: message.replace(/\n/g, " "), danger: true },
  run: () => void run(),
});

/** Nom d'un groupe : un tag relié à la couleur de sa catégorie, un nom fusionné en gris. */
function Name({ name, tagOf }: { name: NameRow; tagOf: TagOf }) {
  if (name.tagId !== null) return <TagName tag={tagOf(name.tagId)} />;
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
        title={name.merged ? `Fusionné dans « ${displayTag(principal)} ». Éteindre la fusion la défait.` : `Relié, à part. Activer la fusion fait passer ses médias à « ${displayTag(principal)} ».`}
      />
      <button type="button" data-zone="regles.groupe.retirer" onClick={() => void ask({ ...removal, confirmLabel: "Oui" })} title="Retirer du groupe" className={cn(ICON, "hover:text-rose-400")}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function GroupLine({ group, tagOf }: { group: GroupRow; tagOf: TagOf }) {
  const [open, setOpen] = useState(false);
  const principalTag = tagOf(group.principalId);
  const principal = principalTag?.name ?? "?";
  const state = groupState(group);
  const deletion = groupDeletion(group, principal);
  const menu = (): MenuEntry[] => [
    { label: open ? "Replier" : "Déplier", run: () => setOpen(!open) },
    "separator",
    ...(state !== true ? [{ label: "Tout fusionner", run: () => void toggleGroup(group, principal) }] : []),
    ...(state !== false ? [{ label: "Tout défusionner", run: () => void unmergeGroup(group) }] : []),
    "separator",
    { label: "Supprimer le groupe…", ...menuConfirm(deletion) },
  ];
  return (
    <div data-zone="regles.groupe">
      <div onContextMenu={(e) => openContextMenu(e, menu)} className={LINE}>
        <button
          type="button"
          data-zone="regles.groupe.deplier"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          title={open ? "Replier" : "Déplier"}
          className={cn(ICON, "hover:text-foreground")}
        >
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        </button>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <Star className="h-3.5 w-3.5 shrink-0 fill-[#d9a94e] text-[#d9a94e]" />
          <TagName tag={principalTag} />
          {group.names.map((n) => (
            <span key={n.id} className="flex min-w-0 shrink items-center gap-1.5">
              <span className="text-muted-foreground">·</span>
              <Name name={n} tagOf={tagOf} />
            </span>
          ))}
        </span>
        <span className="shrink-0 pl-1 text-xs text-muted-foreground tabular-nums" title={`${formatNumber(group.media)} ${plural(group.media, "média")} trouvés en cherchant un de ces noms`}>
          {formatNumber(group.media)}
        </span>
        <Switch
          on={state}
          onToggle={() => void toggleGroup(group, principal)}
          zone="regles.groupe.fusion"
          label={`Fusion du groupe de « ${displayTag(principal)} »`}
          title={state === true ? "Tout est fusionné. Éteindre défait toutes les fusions." : state === false ? "Rien n'est fusionné. Allumer fusionne tous les noms." : "En partie fusionné. Un clic fusionne tous les noms."}
        />
        <button type="button" data-zone="regles.supprimer" onClick={() => void ask({ ...deletion, confirmLabel: "Oui" })} title="Supprimer le groupe" className={cn(ICON, "hover:text-rose-400")}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && (
        <div data-zone="regles.groupe.panneau" className="mb-1 ml-6 rounded-md border border-border bg-secondary/20 p-1">
          <div className={LINE}>
            <span className={ICON} title="Tag principal">
              <Star className="h-3.5 w-3.5 fill-[#d9a94e] text-[#d9a94e]" />
            </span>
            <TagName tag={principalTag} />
            <span className="ml-auto shrink-0 pl-1 text-xs text-muted-foreground tabular-nums">{principalTag ? formatNumber(principalTag.mediaCount) : ""}</span>
          </div>
          {group.names.map((n) => (
            <NameLine key={n.id} group={group} name={n} principal={principal} tagOf={tagOf} />
          ))}
        </div>
      )}
    </div>
  );
}
