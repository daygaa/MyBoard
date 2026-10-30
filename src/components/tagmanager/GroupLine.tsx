// Ligne d'un groupe de synonymes (refonte, décisions D2, D2.1, D3 ; propositions 3, 4 et 7 du lot R3) :
// « ▸ » pour déplier (en douceur), ★ principal en doré, long tiret, les autres noms entiers tant qu'ils tiennent
// puis « … + N » (couleur de leur catégorie s'ils sont reliés, gris s'ils sont fusionnés), interrupteur du groupe (« à moitié » s'il est en partie fusionné), nombre de médias, corbeille.
// Dépliée : une ligne par nom (étoile pour en faire le principal, interrupteur de fusion, croix « Retirer du
// groupe »). Clic droit (CTX-16) sur le groupe et sur chaque nom ; « Annuler » rend le menu (CTX-02).

import { useLayoutEffect, useRef, useState, type TransitionEvent } from "react";
import { ChevronRight, Star, Trash2, X } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { openContextMenu, type MenuEntry } from "@/lib/contextMenu";
import { formatNumber, plural } from "@/lib/format";
import { groupDeletion, groupState, makePrincipal, nameRemoval, toggleGroup, toggleName, unmergeGroup } from "@/lib/groupRules";
import type { GroupRow, NameRow } from "@/lib/rulesApi";
import { ask } from "@/lib/tagRules";
import { displayTag } from "@/lib/tags";
import { cn, titleIfCut } from "@/lib/utils";
import { FitLine } from "./FitLine";
import { TagName, type TagOf } from "./RuleLines";
import { useRulesTab } from "./rulesTabState";

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
        title={name.merged ? `Fusionné dans « ${displayTag(principal)} ».` : "Activer la fusion"}
      />
      <button type="button" data-zone="regles.groupe.retirer" onClick={() => void ask({ ...removal, confirmLabel: "Oui" })} title="Retirer du groupe" className={cn(ICON, "hover:text-rose-400")}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Noms par ordre alphabétique (sans les « _ »). */
const byName = (a: { name: string }, b: { name: string }) => displayTag(a.name).localeCompare(displayTag(b.name));

/** Place de l'interrupteur et de l'icône de fin de ligne, pour aligner les colonnes de droite. */
const SPACER = <span aria-hidden className="w-7 shrink-0" />;
const ICON_SPACER = <span aria-hidden className="w-6 shrink-0" />;

/** Dépliage en douceur (retouches de R3) : le panneau passe de 0 à sa hauteur en 200 ms ; replié, il quitte la
 *  page à la fin du mouvement. Un groupe déplié le reste au retour sur l'onglet (point TAGM-15.20). */
function useUnfold(id: number) {
  const [was] = useState(() => useRulesTab.getState().open.includes(id));
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
    useRulesTab.setState((s) => ({ open: open ? s.open.filter((x) => x !== id) : [...s.open, id] }));
    if (!open) setMounted(true);
    else if (expanded) setExpanded(false);
    else setMounted(false); // replié avant d'avoir commencé à se déplier : aucun mouvement à attendre
  };
  const onEnd = (e: TransitionEvent) => e.target === e.currentTarget && !open && setMounted(false);
  return { open, mounted, expanded, ref, toggle, onEnd };
}

export function GroupLine({ group, tagOf }: { group: GroupRow; tagOf: TagOf }) {
  const { open, mounted, expanded, ref, toggle, onEnd } = useUnfold(group.id);
  const principalTag = tagOf(group.principalId);
  const principal = principalTag?.name ?? "?";
  // Ordre alphabétique, le tag principal rangé avec les autres dans le panneau : changer de principal ne
  // déplace aucun nom (point TAGM-15.17).
  const names = [...group.names].sort(byName);
  const rows = [...names.map((n) => ({ key: n.id, name: n.name, row: n as NameRow | null })), { key: -1, name: principal, row: null }].sort(byName);
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
            <div data-zone="regles.groupe.panneau" className="py-1">
              {rows.map(({ key, row }) =>
                row ? (
                  <NameLine key={key} group={group} name={row} principal={principal} tagOf={tagOf} />
                ) : (
                  <div key={key} className={LINE}>
                    <span className={ICON} title="Tag principal">
                      <Star className="h-3.5 w-3.5 fill-[#d9a94e] text-[#d9a94e]" />
                    </span>
                    <TagName tag={principalTag} />
                    <span className="ml-auto shrink-0 pl-1 text-xs text-muted-foreground tabular-nums">{principalTag ? formatNumber(principalTag.mediaCount) : ""}</span>
                    {SPACER}
                    {ICON_SPACER}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
