// Pop-ins de nettoyage du gestionnaire de tags :
// - « Supprimer les N tags non utilisés ? » (TAGM-08) : case « Sélection manuelle » qui déplie la liste
//   des tags concernés, tous cochés ; décocher un tag le garde (N baisse de 1) ; ils vont à la corbeille pour 30 jours,
//   sauf avec la case « Supprimer définitivement » (TAGM-19), décochée d'office et retenue d'une fois sur l'autre ;
// - « Créer un synonyme » / « Créer des synonymes » des tags cochés (retour T3, point TAGM-11.4 ; refonte, D8,
//   D8.1, lot R6-1) : tag principal au choix, aperçu du groupe obtenu, interrupteur « Fusionner ».
// Tags proches (TAGM-13) : SimilarTagsDialog.tsx.

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { MergeSwitch } from "@/components/tags/MergeSwitch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/ui/modal";
import type { ManagedTag } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { whole } from "@/lib/keepWords";
import { createGroup } from "@/lib/groupRules";
import { rulesApi, type GroupRow } from "@/lib/rulesApi";
import { deleteTags } from "@/lib/tagManager";
import { useUI } from "@/stores/ui";
import { q } from "@/lib/tagRules";
import { displayTag } from "@/lib/tags";
import { CANCEL, GOLD, KeepChoice, kept, mostUsed, RED, TagName } from "./TagChoice";

export function UnusedTagsDialog({ tags, onClose }: { tags: ManagedTag[]; onClose: () => void }) {
  const [manual, setManual] = useState(false);
  const [kept, setKept] = useState<Set<number>>(new Set());
  const doomed = tags.filter((t) => !kept.has(t.id));
  const n = doomed.length;
  const permanent = useUI((s) => s.unusedPermanent);
  const setPermanent = useUI((s) => s.setUnusedPermanent);
  const confirm = () => {
    if (n === 0) return;
    void deleteTags(doomed.map((t) => t.id), false, false, false, permanent).then(onClose);
  };
  const fate = permanent
    ? n > 1
      ? "Ils seront définitivement supprimés."
      : "Il sera définitivement supprimé."
    : n > 1
      ? "Ils seront placés dans la corbeille pendant 30 jours."
      : "Il sera placé dans la corbeille pendant 30 jours.";
  return (
    <Modal
      open
      even
      onEnter={confirm}
      onClose={onClose}
      zone="tags-non-utilises"
      title={`Supprimer ${n === 1 ? "le tag non utilisé" : `les ${formatNumber(n)} tags non utilisés`} ?`}
      description={<p data-zone="tags-non-utilises.texte">{fate}</p>}
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
      {/* Sous la liste quand elle est ouverte (TAGM-19). */}
      <label data-zone="tags-non-utilises.definitif" className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-foreground">
        <Checkbox checked={permanent} onCheckedChange={(c) => setPermanent(c === true)} />
        Supprimer définitivement
      </label>
    </Modal>
  );
}

/** Tags cochés → un groupe de synonymes autour du tag principal choisi (le plus utilisé d'office). « Créer » ferme la
 *  pop-in ; la pop-in de fusion (médias, règles, « Étendre ») ou de réunion de groupes suit si besoin (réponse 1 du
 *  lot R6). Retouches du 03/11 (point TAGM-11.4) : le principal du groupe d'un tag coché est proposé aussi, et les
 *  principaux de groupe ont une étoile ; un nom d'un groupe choisi en devient le principal, comme avec l'étoile (la
 *  pop-in qui suit le dit), sauf si tous les tags sont déjà de ce groupe (« déjà des synonymes », réponse du 03/11). */
export function CreateSynonymsDialog({ checked, onClose, groupOf, tagOf }: { checked: ManagedTag[]; onClose: () => void; groupOf: Map<number, GroupRow>; tagOf: (id: number) => ManagedTag | undefined }) {
  const { tags, principals } = useMemo(() => {
    const list = [...checked];
    const principals = new Set<number>();
    for (const t of checked) {
      const group = groupOf.get(t.id);
      if (!group) continue;
      principals.add(group.principalId);
      const chief = tagOf(group.principalId);
      if (chief && !list.some((x) => x.id === chief.id)) list.push(chief);
    }
    return { tags: list, principals };
  }, [checked, groupOf, tagOf]);
  const [keep, setKeepId] = useState(() => mostUsed(tags));
  // Interrupteur touché à la main ; sinon, allumé si le groupe obtenu est entièrement fusionné (D2.2, D8.1).
  const [merge, setMerge] = useState<boolean | null>(null);
  const chief = kept(tags, keep);
  const others = tags.filter((t) => t.id !== chief.id).map((t) => t.name);
  // L'aperçu précédent reste affiché pendant que le nouveau arrive : la pop-in ne change pas de taille (retouche du 03/11).
  const { data: preview } = useQuery({ queryKey: ["group-preview", chief.name, others, "promote"], queryFn: () => rulesApi.groupPreview(chief.name, others, true), placeholderData: keepPreviousData });
  const on = merge ?? preview?.fullyMerged ?? false;
  const head = preview?.principal ?? chief.name;
  const nothing = preview !== undefined && preview.added.length === 0;
  // Rien à ajouter : le principal ne change pas (il se change avec l'étoile).
  const current = preview?.replaced ?? head;
  const create = () => {
    if (!preview || nothing) return;
    onClose();
    void createGroup({ id: chief.id, name: head }, others, on, preview, [], () => {}, true);
  };
  // Chaque nom d'un bloc (GEN-22).
  const names = preview ? [...preview.existing, ...preview.added].map((n) => whole(displayTag(n.name))) : [];
  return (
    <Modal
      open
      even
      onEnter={create}
      onClose={onClose}
      zone="tags-synonymes"
      title={checked.length > 2 ? "Créer des synonymes" : "Créer un synonyme"}
      description="Choisis le tag principal ; les autres deviennent ses synonymes."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} className={CANCEL}>
            Annuler
          </Button>
          <Button data-zone="tags-synonymes.creer" disabled={!preview || nothing} onClick={create} className={GOLD}>
            Créer
          </Button>
        </>
      }
    >
      <div className="max-h-64 overflow-y-auto rounded-lg border border-border p-1.5">
        <KeepChoice
          tags={tags}
          principals={principals}
          value={keep}
          onChange={(id) => {
            setKeepId(id);
            setMerge(null);
          }}
        />
      </div>
      <p data-zone="tags-synonymes.resultat" className="mt-3 text-sm text-muted-foreground select-text [overflow-wrap:anywhere]">
        {nothing ? `Ces tags sont déjà des synonymes de ${q(current)}.` : preview ? `Résultat : ★ ${[whole(displayTag(head)), ...names].join(" = ")}` : " "}
      </p>
      {!nothing && (
        <div className="mt-3">
          <MergeSwitch on={on} onChange={setMerge} zone="tags-synonymes.fusion" />
        </div>
      )}
    </Modal>
  );
}
