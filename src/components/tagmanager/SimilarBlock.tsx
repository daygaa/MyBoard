// Un bloc de la pop-in « Tags proches » (TAGM-13 ; refonte, D8, D8.2 ; lot R6-2, réponse 5 du lot R6) : une case par
// tag (un tag décoché est écarté de ce groupe), le tag principal au choix quand aucun groupe n'existe ; sinon le
// groupe existant en gris, sans case, et les tags proches à y ajouter ; plusieurs groupes : ils seront réunis.
// Interrupteur « Fusionner » du bloc, « Ignorer », bouton « Créer un / des synonymes », « Ajouter au groupe » ou
// « Réunir les groupes ». Une loupe au bout de chaque tag lance sa recherche (retour T3, point TAGM-13.1).

import { Search } from "lucide-react";

import { MergeSwitch } from "@/components/tags/MergeSwitch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { ManagedTag } from "@/lib/api";
import { createBlock, ignoreBlock, type BlockPlan, type BlockState } from "@/lib/similarActions";
import type { SimilarBlock as Block } from "@/lib/similarTags";
import { displayTag } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { CANCEL, GOLD, PrincipalStar, TagName } from "./TagChoice";

type Props = {
  block: Block;
  state: BlockState;
  plan: BlockPlan;
  onChange: (state: BlockState) => void;
  onSearch: (tag: ManagedTag) => void;
};

function Loupe({ tag, onSearch }: { tag: ManagedTag; onSearch: (tag: ManagedTag) => void }) {
  const label = `Rechercher « ${displayTag(tag.name)} »`;
  return (
    <button
      type="button"
      data-zone="tags-proches.rechercher"
      onClick={(e) => {
        e.preventDefault(); // ni case ni principal
        onSearch(tag);
      }}
      aria-label={label}
      title={label}
      className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground"
    >
      <Search className="h-3.5 w-3.5" />
    </button>
  );
}

export function SimilarBlock({ block, state, plan, onChange, onSearch }: Props) {
  const free = block.groups.length === 0;
  const on = (t: ManagedTag) => !state.off.includes(t.id);
  const toggle = (t: ManagedTag, checked: boolean) => onChange({ ...state, off: checked ? state.off.filter((id) => id !== t.id) : [...state.off, t.id] });
  return (
    <div data-zone="tags-proches.groupe" className="rounded-lg border border-border p-2">
      {!free && (
        <div className="mb-1 space-y-0.5 px-1.5 py-1 text-sm text-muted-foreground select-text [overflow-wrap:anywhere]">
          {block.groups.map((g) => (
            <p key={g.id} data-zone="tags-proches.groupe.existant" className="flex flex-wrap items-center gap-x-1.5">
              <span>Groupe existant :</span>
              <PrincipalStar />
              <span>{[g.principalName, ...g.names.map((n) => n.name)].map(displayTag).join(" = ")}</span>
            </p>
          ))}
          {block.groups.length > 1 && <p>Les groupes seront réunis ; tag principal : « {displayTag(plan.principal.name)} ».</p>}
        </div>
      )}
      <div className="space-y-0.5">
        {(free ? block.tags : block.fresh).map((t) => {
          const box = <Checkbox data-zone="tags-proches.case" checked={on(t)} onCheckedChange={(c) => toggle(t, c === true)} aria-label={`Garder « ${displayTag(t.name)} »`} />;
          const row = cn("flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-secondary/50", free && plan.principal.id === t.id && "bg-secondary/60", !on(t) && "opacity-55");
          // Sans groupe, le nom choisit le tag principal (comme le bouton radio) ; avec un groupe, il coche la case.
          return free ? (
            <div key={t.id} className={row}>
              {box}
              <label className={cn("flex min-w-0 flex-1 items-center gap-2", on(t) ? "cursor-pointer" : "cursor-default")}>
                <input type="radio" checked={plan.principal.id === t.id} disabled={!on(t)} onChange={() => onChange({ ...state, chief: t.id })} title="Tag principal" className="accent-[#d9a94e]" />
                <TagName tag={t} />
                <Loupe tag={t} onSearch={onSearch} />
              </label>
            </div>
          ) : (
            <label key={t.id} className={cn(row, "cursor-pointer")}>
              {box}
              <TagName tag={t} />
              <Loupe tag={t} onSearch={onSearch} />
            </label>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <MergeSwitch on={plan.merge} onChange={(merge) => onChange({ ...state, merge })} zone="tags-proches.groupe.fusion" />
        <Button variant="ghost" size="sm" data-zone="tags-proches.groupe.ignorer" onClick={() => void ignoreBlock(block)} className={cn("ml-auto", CANCEL)} title="Ne plus proposer ces tags ensemble">
          Ignorer
        </Button>
        <Button size="sm" data-zone="tags-proches.groupe.creer" disabled={!plan.ready} onClick={() => void createBlock(plan)} className={GOLD}>
          {plan.label}
        </Button>
      </div>
    </div>
  );
}
