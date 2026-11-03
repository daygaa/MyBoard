// « Ignorés (N) » des tags proches (TAGM-13.8 ; refonte, D8.3 ; réponse 4 du lot R6) : une ligne par « Ignorer » ou
// décochage, telle qu'elle a été faite, avec « Ne plus ignorer » (ces tags pourront de nouveau être proposés ensemble).
// Ouverte par-dessus la pop-in « Tags proches ».

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { api, type ManagedTag, type SimilarIgnore } from "@/lib/api";
import { runTagAction } from "@/lib/tagManager";
import { q } from "@/lib/tagRules";
import { CANCEL } from "./TagChoice";

/** « « a », « b » » ; « « x » écarté de « a », « b » ». */
function lineOf(i: SimilarIgnore, tagOf: (id: number) => ManagedTag | undefined) {
  const names = (ids: number[]) => ids.map((id) => q(tagOf(id)?.name ?? "?")).join(", ");
  return i.kind === "group" ? names(i.apart) : `${names(i.apart)} ${i.apart.length > 1 ? "écartés" : "écarté"} de ${names(i.kept)}`;
}

export function IgnoredDialog({ ignores, tagOf, onClose }: { ignores: SimilarIgnore[]; tagOf: (id: number) => ManagedTag | undefined; onClose: () => void }) {
  return (
    <Modal
      open
      wide
      onClose={onClose}
      zone="tags-proches.ignores"
      title="Ignorés"
      description={ignores.length ? "Ces tags ne sont plus proposés ensemble dans les tags proches." : "Aucun tag proche ignoré."}
      footer={
        <Button variant="ghost" onClick={onClose} className={CANCEL}>
          Fermer
        </Button>
      }
    >
      {ignores.length > 0 && (
        <div className="max-h-[50vh] space-y-1 overflow-y-auto overscroll-contain pr-1">
          {ignores.map((i) => (
            <div key={i.id} data-zone="tags-proches.ignores.ligne" className="flex items-center gap-3 rounded-lg border border-border px-2.5 py-1.5 text-sm">
              <span className="min-w-0 flex-1 select-text [overflow-wrap:anywhere]">{lineOf(i, tagOf)}</span>
              <Button variant="ghost" size="sm" onClick={() => void runTagAction("Ne plus ignorer", () => api.unignoreSimilar(i.id))} className={CANCEL}>
                Ne plus ignorer
              </Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
