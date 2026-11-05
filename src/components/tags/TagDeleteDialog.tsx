// Pop-in « Supprimer le tag… » (TAGM-04, CTX-04), pour un tag ou plusieurs tags cochés, avec les groupes de synonymes
// (refonte, décision D15 bis revue le 31/10 ; retour T3, point TAGM-15.28) : médias touchés, ce qui arrive aux groupes.
// Deux cases au besoin, décochées : « Supprimer aussi » les tags fusionnés dans un principal supprimé (décochée, ils
// sont d'abord défusionnés), et retirer le principal des médias qui ne l'ont reçu que par un tag fusionné supprimé
// (décochée, ils le gardent). Sous un trait, les règles de parents qui partent (retour T3, point TAGM-16.8) : une ligne
// par règle, les chaînes du tag et une case de retrait, comme dans la pop-in de suppression d'une règle
// (ParentDeleteDialog). Ouverte par le menu du clic droit (« Annuler » rend le menu, CTX-02) et par le gestionnaire
// (corbeille d'une ligne, barre des tags cochés). Les tags vont à la corbeille des tags pour 30 jours (TAGM-19), sauf avec
// la case « Supprimer définitivement », décochée à chaque ouverture.

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { ChainStrip } from "@/components/tagmanager/ChainStrip";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { api, type DeletePreview, type TagInfo } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { deleteTags } from "@/lib/tagManager";
import { copyPlain } from "@/lib/keepWords";
import { media, q } from "@/lib/tagRules";

type Props = { tags: Pick<TagInfo, "id" | "name" | "mediaCount">[]; onCancel: () => void; onDone: () => void };

/** « « a », « b » et « c » ». */
function list(names: string[]): string {
  const quoted = names.map(q);
  return quoted.length > 1 ? `${quoted.slice(0, -1).join(", ")} et ${quoted[quoted.length - 1]}` : (quoted[0] ?? "");
}

/** Ce que devient le groupe d'un principal supprimé, selon la case « Supprimer aussi ». */
function principalLines(fate: DeletePreview["principals"][number], merged: string[], also: boolean): string[] {
  const kept = also ? fate.keptAlso : fate.kept;
  const next = also ? fate.nextAlso : fate.next;
  const lines: string[] = [];
  if (!also && merged.length > 0)
    lines.push(merged.length > 1 ? `${list(merged)} seront d'abord défusionnés : leurs médias les retrouveront.` : `${list(merged)} sera d'abord défusionné : ses médias le retrouveront.`);
  if (next) lines.push(`${list(kept)} resteront synonymes ; ${q(next)} deviendra le tag principal.`);
  else if (kept.length === 1) lines.push(`${q(kept[0])} ne sera plus dans un groupe de synonymes.`);
  return lines;
}

/** Ce que devient le tag (TAGM-19) : la corbeille pour 30 jours, ou une suppression définitive. */
const TRASH_ONE = "sera placé dans la corbeille avant d'être supprimé définitivement dans 30 jours";
const TRASH_MANY = "seront placés dans la corbeille avant d'être supprimés définitivement dans 30 jours";

/** Texte de la pop-in pour un seul tag. */
function oneTagLines(tag: Props["tags"][number], data: DeletePreview, also: boolean, permanent: boolean): string[] {
  const fused = data.fused[0];
  const lines: string[] = [];
  if (fused) {
    const n = fused.media;
    // Mis à la corbeille, il pourra revenir avec sa fusion : la fin de la phrase ne vaut que sans corbeille.
    const undone = permanent ? ` ; cette fusion ne pourra plus être défaite pour ${n > 1 ? "eux" : "lui"}` : "";
    lines.push(
      n > 0
        ? `${q(fused.name)} est fusionné dans ${q(fused.principal)} : ${n > 1 ? `ses ${media(n)} garderont` : "son média gardera"} ${q(fused.principal)}${undone}.`
        : `${q(fused.name)} est fusionné dans ${q(fused.principal)} et n'est sur aucun média.`,
    );
    lines.push(permanent ? "Il sera définitivement supprimé." : `Il ${TRASH_ONE}.`);
  } else if (tag.mediaCount > 0) {
    lines.push(permanent ? `Il sera retiré de ${media(tag.mediaCount)} et sera définitivement supprimé.` : `Il sera retiré de ${media(tag.mediaCount)} puis ${TRASH_ONE}.`);
  } else lines.push(permanent ? "Il n'est sur aucun média et sera définitivement supprimé." : `Il n'est sur aucun média ; il ${TRASH_ONE}.`);
  for (const fate of data.principals) lines.push(...principalLines(fate, data.merged, also));
  for (const l of data.linked)
    lines.push(l.dissolved ? `Il quittera le groupe de synonymes de ${q(l.principal)}, qui n'aura plus de synonyme.` : `Il quittera le groupe de synonymes de ${q(l.principal)}.`);
  return lines;
}

/** Texte de la pop-in pour plusieurs tags. */
function manyTagsLines(data: DeletePreview, also: boolean, permanent: boolean): string[] {
  const n = data.media;
  const lines = [
    n > 0
      ? permanent
        ? `Ils seront retirés de ${media(n)} et seront définitivement supprimés.`
        : `Ils seront retirés de ${media(n)} puis ${TRASH_MANY}.`
      : permanent
        ? "Ils ne sont sur aucun média et seront définitivement supprimés."
        : `Ils ne sont sur aucun média ; ils ${TRASH_MANY}.`,
  ];
  if (!also && data.merged.length > 0) lines.push(`Les tags fusionnés dans ces tags (${list(data.merged)}) seront d'abord défusionnés : leurs médias les retrouveront.`);
  // Groupe par groupe, ce qui reste (la défusion est dite une fois, au-dessus).
  for (const fate of data.principals) lines.push(...principalLines(fate, [], also));
  const fused = data.fused.length;
  if (fused > 0) lines.push(`${fused > 1 ? `Les ${fused} tags fusionnés supprimés` : `${q(data.fused[0].name)}, fusionné,`} : leurs médias garderont leur tag principal.`);
  if (data.linked.length > 0) lines.push(`${data.linked.length > 1 ? `Les ${data.linked.length} tags reliés quitteront` : `${q(data.linked[0].name)} quittera`} leur groupe de synonymes.`);
  return lines;
}

/** Lignes de règles montrées au plus ; au-delà, « … et N autres règles ». */
const MAX_RULES = 10;

/** Règles de parents qui partent avec le ou les tags, sous un trait : une ligne par règle, les chaînes du tag (le tag
 *  rayé, la suite en rouge pâle quand la case est cochée) et la case de retrait, décochée. */
function RulesBlock({ data, removing, onRemove }: { data: DeletePreview; removing: boolean; onRemove: (on: boolean) => void }) {
  const n = data.posed;
  const many = data.rules.length > 1;
  const objects = data.parents.length > 1 || data.further;
  // Plusieurs chaînes : « des chaînes » (retour T3, point TAGM-16.11) ; sans dessin (plusieurs tags), dès deux règles.
  const chains = data.chains.length > 1 || (data.chains.length === 0 && many) ? "des chaînes" : "de la chaîne";
  return (
    <div data-zone="tag-suppression.regles" onCopy={copyPlain} className="border-t border-border pt-3 [overflow-wrap:break-word]">
      <div className="space-y-1 text-sm text-muted-foreground">
        {data.rules.slice(0, MAX_RULES).map((r) => (
          <p key={`${r.child}>${r.parent}`}>
            La règle {q(r.child)} → {q(r.parent)} sera supprimée.
          </p>
        ))}
        {data.rules.length > MAX_RULES && <p>… et {formatNumber(data.rules.length - MAX_RULES)} autres règles.</p>}
      </div>
      {data.chains.length > 0 && (
        <div className="mt-3">
          <ChainStrip chains={data.chains} removing={removing && n > 0} deleted />
        </div>
      )}
      {n > 0 && data.parents.length > 0 && (
        <div data-zone="tag-suppression.retirer" className="mt-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <Checkbox checked={removing} onCheckedChange={(c) => onRemove(c === true)} />
            <span className="min-w-0">
              {`Retirer ${list(data.parents)}${data.further ? ` ainsi que les tags ultérieurs ${chains}` : ""} aux médias ${objects ? "les ayant obtenus" : "l'ayant obtenu"} par ${many ? "ces règles" : "cette règle"} (${media(n)})`}
            </span>
          </label>
          <p className="mt-1 pl-6 text-xs text-muted-foreground">Seuls ces tags sont retirés des médias ; les autres règles de la chaîne restent.</p>
        </div>
      )}
    </div>
  );
}

function Option({ zone, checked, onChange, children }: { zone: string; checked: boolean; onChange: (on: boolean) => void; children: ReactNode }) {
  return (
    <label data-zone={zone} onCopy={copyPlain} className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-foreground [overflow-wrap:break-word] first:mt-0">
      <Checkbox checked={checked} onCheckedChange={(c) => onChange(c === true)} />
      <span className="min-w-0">{children}</span>
    </label>
  );
}

export function TagDeleteDialog({ tags, onCancel, onDone }: Props) {
  const ids = tags.map((t) => t.id);
  const { data } = useQuery({ queryKey: ["delete-preview", ids], queryFn: () => api.deletePreview(ids), gcTime: 0, staleTime: 0 });
  const [also, setAlso] = useState(false);
  const [strip, setStrip] = useState(false);
  const [remove, setRemove] = useState(false);
  const [permanent, setPermanent] = useState(false);
  const one = tags.length === 1 ? tags[0] : null;
  const lines = !data ? [] : one ? oneTagLines(one, data, also, permanent) : manyTagsLines(data, also, permanent);
  // Médias qui n'ont reçu le principal que par un tag fusionné supprimé.
  const only = data?.fused.reduce((n, f) => n + f.only, 0) ?? 0;
  const fused = data?.fused[0];
  const confirm = () => {
    onDone();
    void deleteTags(ids, also, strip && only > 0, remove && (data?.posed ?? 0) > 0, permanent);
  };
  const merged = data?.merged ?? [];
  return (
    <ConfirmDialog
      zone="tag-suppression"
      danger
      title={one ? `Supprimer ${q(one.name)} ?` : `Supprimer ces ${formatNumber(tags.length)} tags ?`}
      message={
        // Les synonymes (texte et cases) au-dessus du trait ; les règles de parents dessous.
        <div onCopy={copyPlain} className="[overflow-wrap:break-word]">
          <div className="space-y-1">
            {lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          {data && (
            <div className="mt-3">
              {merged.length > 0 && (
                <Option zone="tag-suppression.fusionnes" checked={also} onChange={setAlso}>
                  {one && data?.principals.length === 1
                    ? `Supprimer aussi ${list(merged)} (${merged.length > 1 ? "fusionnés" : "fusionné"} dans ${q(data.principals[0].name)})`
                    : `Supprimer aussi les ${formatNumber(merged.length)} tags fusionnés dans ces tags`}
                </Option>
              )}
              {only > 0 && fused && (
                <Option zone="tag-suppression.principal" checked={strip} onChange={setStrip}>
                  {one
                    ? only === fused.media
                      ? `Supprimer ${q(fused.principal)} ${only > 1 ? `de ces ${media(only)}` : "de ce média"}`
                      : `Supprimer ${q(fused.principal)} ${only > 1 ? `des ${media(only)} qui ne l'avaient pas` : "du média qui ne l'avait pas"} avant la fusion`
                    : `Retirer leur tag principal des ${media(only)} qui ne l'ont reçu que par les tags fusionnés supprimés`}
                </Option>
              )}
              {/* Sans passer par la corbeille (TAGM-19), décochée à chaque ouverture. */}
              <Option zone="tag-suppression.definitif" checked={permanent} onChange={setPermanent}>
                Supprimer définitivement
              </Option>
            </div>
          )}
        </div>
      }
      onCancel={onCancel}
      onConfirm={confirm}
    >
      {data && data.rules.length > 0 && <RulesBlock data={data} removing={remove} onRemove={setRemove} />}
    </ConfirmDialog>
  );
}
