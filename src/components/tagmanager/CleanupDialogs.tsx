// Pop-ins de nettoyage du gestionnaire de tags :
// - « Supprimer les N tags non utilisés ? » (TAGM-08) : case « Sélection manuelle » qui déplie la liste
//   des tags concernés, tous cochés ; décocher un tag le garde (N baisse de 1) ;
// - tags proches (TAGM-13) : groupes de noms presque identiques ; pour chacun, nom gardé puis
//   « Fusionner », ou « Ignorer » (plus proposé) ; une loupe au bout de chaque tag lance sa recherche
//   (retour T3, point TAGM-13.1) : la pop-in est notée dans l'étape (position dans la liste, noms gardés,
//   case), le retour arrière la rouvre telle quelle ;
// - fusion de tags cochés (TAGM-11) : choix du nom gardé.
// Les deux fusions ont la case « Garder les anciens noms comme synonymes » (TAGM-17).

import { useLayoutEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import { KeepAliasesBox } from "@/components/tags/KeepAliasesBox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import { useCategories } from "@/hooks/useCategories";
import { api, type ManagedTag } from "@/lib/api";
import { formatNumber, plural } from "@/lib/format";
import { displayTag } from "@/lib/tags";
import { deleteTags, groupKey, mergeTags, refreshTags } from "@/lib/tagManager";
import { cn } from "@/lib/utils";

const CANCEL = "text-foreground hover:bg-secondary hover:text-foreground";
const RED = "bg-destructive text-white hover:bg-destructive/90";
const GOLD = "bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f] disabled:hover:bg-[#d9a94e]";

/** Nom coloré selon la catégorie, avec son nombre de médias. */
function TagName({ tag }: { tag: ManagedTag }) {
  const { color } = useCategories();
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="truncate font-mono" style={{ color: color(tag.categoryId) }}>
        {displayTag(tag.name)}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatNumber(tag.mediaCount)}</span>
    </span>
  );
}

export function UnusedTagsDialog({ tags, onClose }: { tags: ManagedTag[]; onClose: () => void }) {
  const [manual, setManual] = useState(false);
  const [kept, setKept] = useState<Set<number>>(new Set());
  const doomed = tags.filter((t) => !kept.has(t.id));
  const n = doomed.length;
  const confirm = () => {
    if (n === 0) return;
    void deleteTags(doomed.map((t) => t.id)).then(onClose);
  };
  return (
    <Modal
      open
      even
      onEnter={confirm}
      onClose={onClose}
      zone="tags-non-utilises"
      title={`Supprimer ${n === 1 ? "le tag non utilisé" : `les ${formatNumber(n)} tags non utilisés`} ?`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className={CANCEL}>
            Annuler
          </Button>
          <Button data-zone="tags-non-utilises.oui" disabled={n === 0} onClick={confirm} className={RED}>
            Oui
          </Button>
        </>
      }
    >
      <label data-zone="tags-non-utilises.manuelle" className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
        <Checkbox data-principale checked={manual} onCheckedChange={(c) => setManual(c === true)} />
        Sélection manuelle
      </label>
      {manual && (
        <div data-zone="tags-non-utilises.liste" className="mt-3 max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1.5">
          {tags.map((t) => (
            <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-secondary/50">
              <Checkbox
                checked={!kept.has(t.id)}
                onCheckedChange={(c) =>
                  setKept((s) => {
                    const next = new Set(s);
                    if (c === true) next.delete(t.id);
                    else next.add(t.id);
                    return next;
                  })
                }
              />
              <TagName tag={t} />
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}

/** Liste de noms à choisir (radio) : le nom gardé d'une fusion. Avec `onSearch`, une loupe au bout de
 *  chaque ligne lance la recherche du tag (la ligne, elle, choisit toujours le nom gardé). */
function KeepChoice({ tags, value, onChange, onSearch }: { tags: ManagedTag[]; value: number; onChange: (id: number) => void; onSearch?: (tag: ManagedTag) => void }) {
  return (
    <div className="space-y-0.5">
      {tags.map((t) => (
        <label key={t.id} className={cn("flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-secondary/50", value === t.id && "bg-secondary/60")}>
          <input type="radio" checked={value === t.id} onChange={() => onChange(t.id)} className="accent-[#d9a94e]" />
          <TagName tag={t} />
          {onSearch && (
            <button
              type="button"
              data-zone="tags-proches.rechercher"
              onClick={(e) => {
                e.preventDefault(); // pas de choix du nom gardé
                onSearch(t);
              }}
              aria-label={`Rechercher « ${displayTag(t.name)} »`}
              title={`Rechercher « ${displayTag(t.name)} »`}
              className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
      ))}
    </div>
  );
}

/** Le plus utilisé est proposé comme nom gardé. */
const mostUsed = (tags: ManagedTag[]) => tags.reduce((a, b) => (b.mediaCount > a.mediaCount ? b : a)).id;

/** Tag gardé parmi `tags`. */
const kept = (tags: ManagedTag[], id: number) => tags.find((t) => t.id === id) ?? tags[0];

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
  return (
    <Modal
      open
      wide
      onClose={onClose}
      zone="tags-proches"
      title="Tags proches"
      description={groups.length ? "Noms presque identiques : choisis le nom gardé, ses médias reçoivent ceux des autres." : "Aucun tag proche à fusionner."}
      footer={
        <Button variant="ghost" onClick={onClose} className={CANCEL}>
          Fermer
        </Button>
      }
    >
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
  );
}

export function MergeTagsDialog({ tags, onClose, onDone }: { tags: ManagedTag[]; onClose: () => void; onDone: () => void }) {
  const [keep, setKeep] = useState(() => mostUsed(tags));
  const [aliases, setAliases] = useState(true);
  const merge = () => void mergeTags(tags, kept(tags, keep), aliases).then(onDone);
  return (
    <Modal
      open
      even
      onEnter={merge}
      onClose={onClose}
      zone="tags-fusionner"
      title={`Fusionner ${formatNumber(tags.length)} ${plural(tags.length, "tag")}`}
      description="Choisis le nom gardé : ses médias reçoivent ceux des autres tags, qui disparaissent."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className={CANCEL}>
            Annuler
          </Button>
          <Button data-zone="tags-fusionner.oui" onClick={merge} className={RED}>
            Fusionner
          </Button>
        </>
      }
    >
      <div className="max-h-64 overflow-y-auto rounded-lg border border-border p-1.5">
        <KeepChoice tags={tags} value={keep} onChange={setKeep} />
      </div>
      <div className="mt-4">
        <KeepAliasesBox checked={aliases} onChange={setAliases} />
      </div>
    </Modal>
  );
}
