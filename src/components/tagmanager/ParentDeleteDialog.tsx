// Pop-in « Supprimer la règle ? » (refonte, décisions D10.3 et D10.4 ; textes et croquis de l'utilisateur du
// 28/10, retour T3, point TAGM-16.1) : la règle, puis les chaînes dont elle fait partie, dessinées en colonnes
// (ChainStrip, les autres règles restent) ; une case, décochée, pour retirer le parent, et la suite de la chaîne,
// des médias qui les ont obtenus par cette règle (jamais d'un média qui les avait avant). Ouverte par la corbeille
// de la ligne et par son menu du clic droit (CTX-02 : « Annuler » rend le menu).

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { rulesApi, type ParentRow } from "@/lib/rulesApi";
import { copyPlain, deleteParent, media, q, type NameOf } from "@/lib/tagRules";
import { ChainStrip } from "./ChainStrip";

type Props = { row: ParentRow; nameOf: NameOf; onCancel: () => void; onDone: () => void };

export function ParentDeleteDialog({ row, nameOf, onCancel, onDone }: Props) {
  const { data } = useQuery({ queryKey: ["parent-delete", row.id], queryFn: () => rulesApi.parentDeleteCheck(row.id), gcTime: 0, staleTime: 0 });
  const [remove, setRemove] = useState(false);
  const [child, parent] = [nameOf(row.childId), nameOf(row.parentId)];
  const n = data?.media ?? 0;
  const chains = data?.chains ?? [];
  // La chaîne continue au-dessus du parent : ces tags-là partent aussi.
  const further = chains.some((c) => c.tags.length > c.at + 2);
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
        <div onCopy={copyPlain} className="space-y-1 [overflow-wrap:break-word]">
          <p>
            La règle {q(child)} → {q(parent)} sera oubliée.
          </p>
          {chains.length > 0 && (
            <p>{chains.length > 1 ? `Elle fait partie de ces ${chains.length} chaînes` : "Elle fait partie de cette chaîne"} ; les autres règles restent.</p>
          )}
        </div>
      }
    >
      {chains.length > 0 && <ChainStrip chains={chains} removing={remove && n > 0} />}
      {n > 0 && (
        <div data-zone="regle-suppression.retirer" onCopy={copyPlain} className={chains.length > 0 ? "mt-4 [overflow-wrap:break-word]" : "[overflow-wrap:break-word]"}>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <Checkbox data-principale checked={remove} onCheckedChange={(c) => setRemove(c === true)} />
            <span className="min-w-0">
              {further
                ? `Retirer ${q(parent)} ainsi que les tags ultérieurs de la chaîne aux médias les ayant obtenus par cette règle (${media(n)})`
                : `Retirer ${q(parent)} aux médias l'ayant obtenu par cette règle (${media(n)})`}
            </span>
          </label>
          <p className="mt-1 pl-6 text-xs text-muted-foreground">Seuls les tags sont retirés des médias ; les règles, elles, ne sont ni supprimées ni désactivées.</p>
        </div>
      )}
    </ConfirmDialog>
  );
}
