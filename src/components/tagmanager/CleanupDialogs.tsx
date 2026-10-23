// Pop-ins de nettoyage du gestionnaire de tags :
// - « Supprimer les N tags non utilisés ? » (TAGM-08) : case « Sélection manuelle » qui déplie la liste
//   des tags concernés, tous cochés ; décocher un tag le garde (N baisse de 1) ;
// - tags proches (TAGM-13) : groupes de noms presque identiques ; pour chacun, nom gardé puis
//   « Fusionner », ou « Ignorer » (plus proposé) ;
// - fusion de tags cochés (TAGM-11) : choix du nom gardé.
// Les deux fusions ont la case « Garder les anciens noms comme synonymes » (TAGM-17).

import { useState } from "react";

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

/** Liste de noms à choisir (radio) : le nom gardé d'une fusion. */
function KeepChoice({ tags, value, onChange }: { tags: ManagedTag[]; value: number; onChange: (id: number) => void }) {
  return (
    <div className="space-y-0.5">
      {tags.map((t) => (
        <label key={t.id} className={cn("flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-secondary/50", value === t.id && "bg-secondary/60")}>
          <input type="radio" checked={value === t.id} onChange={() => onChange(t.id)} className="accent-[#d9a94e]" />
          <TagName tag={t} />
        </label>
      ))}
    </div>
  );
}

/** Le plus utilisé est proposé comme nom gardé. */
const mostUsed = (tags: ManagedTag[]) => tags.reduce((a, b) => (b.mediaCount > a.mediaCount ? b : a)).id;

/** Tag gardé parmi `tags`. */
const kept = (tags: ManagedTag[], id: number) => tags.find((t) => t.id === id) ?? tags[0];

function SimilarGroup({ group, aliases }: { group: ManagedTag[]; aliases: boolean }) {
  const [keep, setKeep] = useState(() => mostUsed(group));
  return (
    <div data-zone="tags-proches.groupe" className="rounded-lg border border-border p-2">
      <KeepChoice tags={group} value={keep} onChange={setKeep} />
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

export function SimilarTagsDialog({ groups, onClose }: { groups: ManagedTag[][]; onClose: () => void }) {
  const [aliases, setAliases] = useState(true);
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
          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {groups.map((g) => (
              <SimilarGroup key={groupKey(g)} group={g} aliases={aliases} />
            ))}
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
