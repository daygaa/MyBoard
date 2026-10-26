// Pop-in « Tags proches » du gestionnaire (TAGM-13) : groupes de noms presque identiques ; pour chacun, nom
// gardé puis « Fusionner », ou « Ignorer » (plus proposé, pour ce groupe exact) ; une loupe au bout de chaque
// tag lance sa recherche (retour T3, point TAGM-13.1) : la pop-in est notée dans l'étape (position dans la
// liste, noms gardés, case), le retour arrière la rouvre telle quelle ; « Tout fusionner », à droite de
// « Fermer », fusionne tous les groupes après une confirmation simple (retour T3, point TAGM-13.3). En haut,
// « Détection : Strict | Large » (retour T3, point TAGM-13.5), retenu ; le compteur du bouton le suit.

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { KeepAliasesBox } from "@/components/tags/KeepAliasesBox";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { api, type ManagedTag } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { groupKey, mergeGroups, mergeTags, refreshTags, type SimilarLevel } from "@/lib/tagManager";
import { useUI } from "@/stores/ui";
import { CANCEL, GOLD, KeepChoice, kept, mostUsed } from "./TagChoice";
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
    <div data-zone="tags-proches.detection" className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
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

type GroupProps = { group: ManagedTag[]; aliases: boolean; keep: number; onKeep: (id: number) => void; onSearch: (tag: ManagedTag) => void };

function SimilarGroup({ group, aliases, keep, onKeep, onSearch }: GroupProps) {
  return (
    <div data-zone="tags-proches.groupe" className="rounded-lg border border-border p-2">
      <KeepChoice tags={group} value={keep} onChange={onKeep} onSearch={onSearch} />
      <div className="mt-2 flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void api.ignoreSimilar(group.map((t) => t.id)).then(refreshTags)}
          className={CANCEL}
          title="Ne plus proposer ce groupe"
        >
          Ignorer
        </Button>
        <Button size="sm" onClick={() => void mergeTags(group, kept(group, keep), aliases)} className={GOLD}>
          Fusionner
        </Button>
      </div>
    </div>
  );
}

/** Pop-in « Tags proches » telle qu'on l'a quittée par une loupe (retour T3, point TAGM-13.1). */
export type SimilarSnapshot = { scroll: number; keep: Record<string, number>; aliases: boolean };

type SimilarProps = {
  groups: ManagedTag[][];
  /** Pop-in rouverte par le retour arrière : position dans la liste, noms gardés, case. */
  initial?: SimilarSnapshot;
  onSearch: (tag: ManagedTag, snapshot: SimilarSnapshot) => void;
  onClose: () => void;
};

export function SimilarTagsDialog({ groups, initial, onSearch, onClose }: SimilarProps) {
  const [aliases, setAliases] = useState(initial?.aliases ?? true);
  // Nom gardé de chaque groupe choisi à la main (sinon : le plus utilisé).
  const [keep, setKeep] = useState<Record<string, number>>(initial?.keep ?? {});
  const listRef = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  // Retour arrière : la liste revient à sa position, une fois ses groupes affichés.
  useLayoutEffect(() => {
    if (restored.current || !initial || !listRef.current || groups.length === 0) return;
    restored.current = true;
    listRef.current.scrollTop = initial.scroll;
  }, [initial, groups.length]);
  const search = (tag: ManagedTag) => onSearch(tag, { scroll: listRef.current?.scrollTop ?? 0, keep, aliases });
  // Autre niveau de détection : la nouvelle liste repart du haut.
  const level = useUI((s) => s.similarLevel);
  const shownLevel = useRef(level);
  useEffect(() => {
    if (shownLevel.current === level) return;
    shownLevel.current = level;
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [level]);
  const [confirming, setConfirming] = useState(false);
  const mergeAll = () => {
    setConfirming(false);
    void mergeGroups(
      groups.map((g) => ({ sources: g, target: kept(g, keep[groupKey(g)] ?? mostUsed(g)) })),
      aliases,
    );
  };
  return (
    <>
      <Modal
        open
        wide
        onClose={onClose}
        zone="tags-proches"
        title="Tags proches"
        description={groups.length ? "Noms presque identiques : choisis le nom gardé, ses médias reçoivent ceux des autres." : "Aucun tag proche à fusionner."}
        footer={
          <>
            <Button variant="ghost" onClick={onClose} className={CANCEL}>
              Fermer
            </Button>
            {groups.length > 0 && (
              <Button data-zone="tags-proches.tout" onClick={() => setConfirming(true)} className={GOLD}>
                Tout fusionner
              </Button>
            )}
          </>
        }
      >
        <LevelChoice />
        {groups.length > 0 && (
          <>
            <div ref={listRef} className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {groups.map((g) => {
                const key = groupKey(g);
                return (
                  <SimilarGroup
                    key={key}
                    group={g}
                    aliases={aliases}
                    keep={keep[key] ?? mostUsed(g)}
                    onKeep={(id) => setKeep((k) => ({ ...k, [key]: id }))}
                    onSearch={search}
                  />
                );
              })}
            </div>
            <div className="mt-3">
              <KeepAliasesBox checked={aliases} onChange={setAliases} />
            </div>
          </>
        )}
      </Modal>
      {/* Même texte quelle que soit la case « Garder les anciens noms » : elle sera revue avec la refonte des
          synonymes (TAGM-15.12, TAGM-15.13, choix de l'utilisateur). */}
      {confirming && (
        <ConfirmDialog
          zone="tags-proches.confirmation"
          title={groups.length === 1 ? "Fusionner le groupe ?" : `Fusionner les ${formatNumber(groups.length)} groupes ?`}
          message="Dans chaque groupe, le nom gardé reçoit les médias des autres tags."
          confirmLabel="Tout fusionner"
          onCancel={() => setConfirming(false)}
          onConfirm={mergeAll}
        />
      )}
    </>
  );
}
