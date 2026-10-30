// Pop-ins de nettoyage du gestionnaire de tags :
// - « Supprimer les N tags non utilisés ? » (TAGM-08) : case « Sélection manuelle » qui déplie la liste
//   des tags concernés, tous cochés ; décocher un tag le garde (N baisse de 1) ;
// - fusion de tags cochés (TAGM-11) : choix du nom gardé.
// Tags proches (TAGM-13) : SimilarTagsDialog.tsx. Les deux fusions ont la case « Garder les anciens noms
// comme synonymes » (TAGM-17).

import { useState } from "react";

import { KeepAliasesBox } from "@/components/tags/KeepAliasesBox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import type { ManagedTag } from "@/lib/api";
import { formatNumber, plural } from "@/lib/format";
import { deleteTags, mergeTags } from "@/lib/tagManager";
import { CANCEL, KeepChoice, kept, mostUsed, RED, TagName } from "./TagChoice";

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
