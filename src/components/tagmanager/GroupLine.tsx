// Ligne d'un groupe de synonymes (refonte, décisions D2, D2.1, D3 ; propositions 3, 4 et 7 du lot R3) :
// « ▸ » pour déplier (en douceur), ★ principal en doré, long tiret, les autres noms entiers tant qu'ils tiennent
// puis « … + N » (couleur de leur catégorie s'ils sont reliés, gris s'ils sont fusionnés), interrupteur du groupe (« à moitié » s'il est en partie fusionné), nombre de médias, corbeille.
// Dépliée : une ligne par nom (GroupNames.tsx : étoile pour en faire le principal, interrupteur de fusion, croix
// « Retirer du groupe »). Clic droit (CTX-16) sur le groupe et sur chaque nom ; « Annuler » rend le menu (CTX-02).

import { useLayoutEffect, useRef, useState, type TransitionEvent } from "react";
import { ChevronRight, Star, Trash2 } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { openContextMenu, type MenuEntry } from "@/lib/contextMenu";
import { formatNumber, plural } from "@/lib/format";
import { groupDeletion, groupState, toggleGroup, unmergeGroup } from "@/lib/groupRules";
import type { GroupRow } from "@/lib/rulesApi";
import { ask } from "@/lib/tagRules";
import { displayTag } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { FitLine } from "./FitLine";
import { byName, GroupNames, ICON, LINE, menuConfirm, Name } from "./GroupNames";
import type { TagOf } from "./RuleLines";
import { useRulesStore } from "./rulesTabState";

/** Dépliage en douceur (retouches de R3) : le panneau passe de 0 à sa hauteur en 200 ms ; replié, il quitte la
 *  page à la fin du mouvement. Un groupe déplié le reste au retour sur l'onglet (point TAGM-15.20). */
function useUnfold(id: number) {
  const store = useRulesStore();
  const [was] = useState(() => store.getState().open.includes(id));
  const [open, setOpen] = useState(was);
  const [mounted, setMounted] = useState(was);
  const [expanded, setExpanded] = useState(was);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open || !mounted || expanded) return;
    ref.current?.getBoundingClientRect(); // hauteur 0 calculée : le mouvement part de là
    setExpanded(true);
  }, [open, mounted, expanded]);
  const toggle = () => {
    setOpen(!open);
    store.setState((s) => ({ open: open ? s.open.filter((x) => x !== id) : [...s.open, id] }));
    if (!open) setMounted(true);
    else if (expanded) setExpanded(false);
    else setMounted(false); // replié avant d'avoir commencé à se déplier : aucun mouvement à attendre
  };
  const onEnd = (e: TransitionEvent) => e.target === e.currentTarget && !open && setMounted(false);
  return { open, mounted, expanded, ref, toggle, onEnd };
}

export function GroupLine({ group, tagOf }: { group: GroupRow; tagOf: TagOf }) {
  const { open, mounted, expanded, ref, toggle, onEnd } = useUnfold(group.id);
  const principal = group.principalName;
  const names = [...group.names].sort(byName);
  const state = groupState(group);
  const deletion = groupDeletion(group, principal);
  const menu = (): MenuEntry[] => [
    { label: open ? "Replier" : "Déplier", run: toggle },
    "separator",
    ...(state !== true ? [{ label: "Tout fusionner", run: () => void toggleGroup(group, principal) }] : []),
    ...(state !== false ? [{ label: "Tout défusionner", run: () => void unmergeGroup(group) }] : []),
    "separator",
    { label: "Supprimer le groupe…", ...menuConfirm(deletion) },
  ];
  return (
    // Déplié : la ligne et son panneau forment un seul bloc (fond plus clair, cadre fin dessiné à l'intérieur, sans
    // changer la hauteur des lignes ; retour T3, point TAGM-15.17).
    <div data-zone="regles.groupe" className={cn("rounded-md", (open || mounted) && "mb-1 bg-secondary/20 outline outline-1 -outline-offset-1 outline-border")}>
      <div onContextMenu={(e) => openContextMenu(e, menu)} className={LINE}>
        <button
          type="button"
          data-zone="regles.groupe.deplier"
          onClick={toggle}
          aria-expanded={open}
          title={open ? "Replier" : "Déplier"}
          className={cn(ICON, "hover:text-foreground")}
        >
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-90")} />
        </button>
        {/* Principal en doré, long tiret, puis les noms entiers qui tiennent et « … + N » (retouches de R3). */}
        <FitLine
          className="flex-1"
          head={
            <>
              <Star className="mr-1.5 h-3.5 w-3.5 shrink-0 fill-[#d9a94e] text-[#d9a94e]" />
              <span className="min-w-0 truncate font-mono text-[#d9a94e]">{displayTag(principal)}</span>
              {group.names.length > 0 && <span className="px-2 text-muted-foreground">—</span>}
            </>
          }
          items={names.map((n) => ({ key: String(n.id), node: <Name name={n} tagOf={tagOf} /> }))}
          more={(n) => `… + ${n}`}
          title={[principal, ...names.map((n) => n.name)].map(displayTag).join(" · ")}
        />
        <span className="shrink-0 pl-1 text-xs text-muted-foreground tabular-nums" title={`${formatNumber(group.media)} ${plural(group.media, "média")} trouvés en cherchant un de ces noms`}>
          {formatNumber(group.media)}
        </span>
        <Switch
          on={state}
          onToggle={() => void toggleGroup(group, principal)}
          zone="regles.groupe.fusion"
          label={`Fusion du groupe de « ${displayTag(principal)} »`}
          title={state === true ? "Fusion activée" : state === false ? "Fusion désactivée" : "Fusion partielle, cliquer fusionnera ceux qui ne le sont pas"}
        />
        <button type="button" data-zone="regles.supprimer" onClick={() => void ask({ ...deletion, confirmLabel: "Oui" })} title="Supprimer le groupe" className={cn(ICON, "hover:text-rose-400")}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {mounted && (
        // Trait fin sous la ligne du groupe ; colonnes de droite (nombre, interrupteur, croix) alignées sur
        // celles de la ligne du groupe (retouches de R3).
        <div ref={ref} onTransitionEnd={onEnd} className={cn("grid transition-[grid-template-rows] duration-200 ease-out", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="min-h-0 overflow-hidden">
            <div data-trait className="h-px bg-[#3a3d47]" />
            {/* Étoiles sous la flèche de dépliage (point TAGM-15.17). */}
            <GroupNames group={group} tagOf={tagOf} zone="regles.groupe.panneau" />
          </div>
        </div>
      )}
    </div>
  );
}
