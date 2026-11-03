// Pop-in « Tags proches » du gestionnaire (TAGM-13 ; refonte, décisions D8 à D8.3 ; lot R6-2) : des blocs de noms
// presque identiques (SimilarBlock.tsx), qui tiennent compte des groupes de synonymes ; en haut, « Détection : Strict
// | Large » (retour T3, point TAGM-13.5), retenu, et l'interrupteur « Fusionner tous » (« à moitié » quand les blocs
// diffèrent, D8.2) ; en bas, « Ignorés (N) » (D8.3), « Fermer » et « Créer des synonymes pour tous » (retour T3, point
// TAGM-13.3). Une loupe lance la recherche d'un tag : la pop-in est notée dans l'étape (position, réglages des blocs),
// le retour arrière la rouvre telle quelle (retour T3, point TAGM-13.1).

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import type { ManagedTag, SimilarIgnore } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { createAll, planOf, type BlockState } from "@/lib/similarActions";
import type { SimilarBlock as Block, SimilarLevel } from "@/lib/similarTags";
import { useUI } from "@/stores/ui";
import { IgnoredDialog } from "./IgnoredDialog";
import { SimilarBlock } from "./SimilarBlock";
import { CANCEL, GOLD } from "./TagChoice";
import { segment } from "./TagFilters";

const LEVELS: { level: SimilarLevel; label: string; help: string }[] = [
  { level: "strict", label: "Strict", help: "Mêmes noms sans tenir compte des accents, des « _ », « - », espaces et points, ni du « s » final" },
  { level: "large", label: "Large", help: "En plus : le « s » de chaque mot (« hand on own hip » = « hands on own hips ») et les mots dans un autre ordre" },
];

/** Niveau de détection, retenu d'une ouverture à l'autre (même après redémarrage). */
function LevelChoice() {
  const level = useUI((s) => s.similarLevel);
  const setLevel = useUI((s) => s.setSimilarLevel);
  return (
    <div data-zone="tags-proches.detection" className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Détection :</span>
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card/60 p-0.5">
        {LEVELS.map((l) => (
          <button
            key={l.level}
            type="button"
            data-zone={`tags-proches.detection.${l.level}`}
            aria-pressed={level === l.level}
            onClick={() => setLevel(l.level)}
            title={l.help}
            className={segment(level === l.level)}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Pop-in telle qu'on l'a quittée par une loupe : position dans la liste, réglages des blocs. */
export type SimilarSnapshot = { scroll: number; states: Record<string, BlockState> };

type SimilarProps = {
  blocks: Block[];
  ignores: SimilarIgnore[];
  tagOf: (id: number) => ManagedTag | undefined;
  /** Pop-in rouverte par le retour arrière. */
  initial?: SimilarSnapshot;
  onSearch: (tag: ManagedTag, snapshot: SimilarSnapshot) => void;
  onClose: () => void;
};

const NONE: BlockState = { off: [] };

export function SimilarTagsDialog({ blocks, ignores, tagOf, initial, onSearch, onClose }: SimilarProps) {
  const [states, setStates] = useState<Record<string, BlockState>>(initial?.states ?? {});
  const [ignoredOpen, setIgnoredOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  // Retour arrière : la liste revient à sa position, une fois ses blocs affichés.
  useLayoutEffect(() => {
    if (restored.current || !initial || !listRef.current || blocks.length === 0) return;
    restored.current = true;
    listRef.current.scrollTop = initial.scroll;
  }, [initial, blocks.length]);
  // Autre niveau de détection : la nouvelle liste repart du haut.
  const level = useUI((s) => s.similarLevel);
  const shownLevel = useRef(level);
  useEffect(() => {
    if (shownLevel.current === level) return;
    shownLevel.current = level;
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [level]);
  const plans = useMemo(() => blocks.map((b) => planOf(b, states[b.key] ?? NONE, tagOf)), [blocks, states, tagOf]);
  const ready = plans.filter((p) => p.ready);
  // « Fusionner tous » : allumé si tous les blocs le sont, éteint si aucun, « à moitié » sinon ; un clic allume tout, ou
  // éteint tout s'ils l'étaient tous (D2.1).
  const merged = ready.filter((p) => p.merge).length;
  const all = ready.length > 0 && merged === ready.length ? true : merged === 0 ? false : "mixed";
  const setAll = (merge: boolean) => setStates((s) => Object.fromEntries(blocks.map((b) => [b.key, { ...(s[b.key] ?? NONE), merge }])));
  const search = (tag: ManagedTag) => onSearch(tag, { scroll: listRef.current?.scrollTop ?? 0, states });
  return (
    <>
      <Modal
        open
        wide
        onClose={onClose}
        zone="tags-proches"
        title="Tags proches"
        description={blocks.length ? "Noms presque identiques : coche les tags à relier et choisis le tag principal." : "Aucun tag proche."}
        footer={
          <>
            <button type="button" data-zone="tags-proches.ignores.lien" onClick={() => setIgnoredOpen(true)} className="mr-auto text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
              Ignorés ({formatNumber(ignores.length)})
            </button>
            <Button variant="ghost" onClick={onClose} className={CANCEL}>
              Fermer
            </Button>
            {ready.length > 0 && (
              <Button data-zone="tags-proches.tout" onClick={() => void createAll(plans)} className={GOLD}>
                Créer des synonymes pour tous
              </Button>
            )}
          </>
        }
      >
        <div className="mb-3 flex items-center gap-3">
          <LevelChoice />
          {ready.length > 0 && (
            <label data-zone="tags-proches.fusion" className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              Fusionner tous
              <Switch on={all} onToggle={() => setAll(all !== true)} zone="tags-proches.fusion.interrupteur" label="Fusionner tous" />
            </label>
          )}
        </div>
        {blocks.length > 0 && (
          <div ref={listRef} className="max-h-[55vh] space-y-2 overflow-y-auto overscroll-contain pr-1">
            {blocks.map((b, i) => (
              <SimilarBlock key={b.key} block={b} state={states[b.key] ?? NONE} plan={plans[i]} onChange={(st) => setStates((s) => ({ ...s, [b.key]: st }))} onSearch={search} />
            ))}
          </div>
        )}
      </Modal>
      {ignoredOpen && <IgnoredDialog ignores={ignores} tagOf={tagOf} onClose={() => setIgnoredOpen(false)} />}
    </>
  );
}
