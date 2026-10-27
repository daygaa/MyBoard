// Pop-in « Supprimer la règle ? » (refonte, décisions D10.3 et D10.4) : la règle et, si elle fait partie
// d'une chaîne, la chaîne (les autres règles restent) ; une case, décochée, pour retirer le parent des médias
// où la règle l'a posé, avec ce qui est venu avec lui en chaîne (jamais d'un média qui l'avait avant). Ouverte
// par la corbeille de la ligne et par son menu du clic droit (CTX-02 : « Annuler » rend le menu).

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { rulesApi, type ParentRow } from "@/lib/rulesApi";
import { copyPlain, deleteParent, media, q, type NameOf } from "@/lib/tagRules";

/** « « animal », venu avec lui, part aussi » ; plusieurs tags : « venus », « partent ». */
function chainedText(names: string[]): string {
  const list = names.map(q);
  const joined = list.length > 1 ? `${list.slice(0, -1).join(", ")} et ${list[list.length - 1]}` : list[0];
  return list.length > 1 ? ` ; ${joined}, venus avec lui, partent aussi.` : ` ; ${joined}, venu avec lui, part aussi.`;
}

type Props = { row: ParentRow; nameOf: NameOf; onCancel: () => void; onDone: () => void };

export function ParentDeleteDialog({ row, nameOf, onCancel, onDone }: Props) {
  const { data } = useQuery({ queryKey: ["parent-delete", row.id], queryFn: () => rulesApi.parentDeleteCheck(row.id), gcTime: 0, staleTime: 0 });
  const [remove, setRemove] = useState(false);
  const [child, parent] = [nameOf(row.childId), nameOf(row.parentId)];
  const n = data?.media ?? 0;
  const chains = data?.chains ?? [];
  const confirm = () => {
    onDone();
    void deleteParent(row, nameOf, remove && n > 0, n);
  };
  return (
    <ConfirmDialog
      zone="regle-suppression"
      title="Supprimer la règle ?"
      danger
      onCancel={onCancel}
      onConfirm={confirm}
      message={
        <div onCopy={copyPlain} className="space-y-2 [overflow-wrap:break-word]">
          <p>
            La règle {q(child)} → {q(parent)} sera oubliée.
          </p>
          {chains.length > 0 && (
            <p data-zone="regle-suppression.chaine">
              {chains.length > 1 ? "Chaînes" : "Chaîne"} :{" "}
              {chains.map((chain, i) => (
                <span key={i} className={chains.length > 1 ? "block" : undefined}>
                  {chain.map(q).join(" → ")}
                </span>
              ))}
              {chains.length > 1 ? "Les autres règles restent." : " ; les autres règles restent."}
            </p>
          )}
        </div>
      }
    >
      {n > 0 && (
        <div data-zone="regle-suppression.retirer" onCopy={copyPlain} className="[overflow-wrap:break-word]">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <Checkbox data-principale checked={remove} onCheckedChange={(c) => setRemove(c === true)} />
            <span className="min-w-0">
              Retirer {q(parent)} aux médias portant {q(child)} ({media(n)})
            </span>
          </label>
          <p className="mt-1 pl-6 text-xs text-muted-foreground">
            Seulement là où la règle l'a posé{data && data.chained.length > 0 ? chainedText(data.chained) : "."}
          </p>
        </div>
      )}
    </ConfirmDialog>
  );
}
