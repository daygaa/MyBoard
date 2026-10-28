// Formulaire de création d'un groupe de synonymes (refonte, décisions D2.2, D3, D4, D4.1, D14 ; retour T3,
// points TAGM-15.5 et TAGM-15.6 ; proposition 5 du lot R3) : « Tag principal » (une seule pastille),
// « Synonymes » (des pastilles), interrupteur « Fusionner » (éteint ; allumé d'office si le groupe du principal
// est entièrement fusionné) et « Créer ». Sous les champs, l'aperçu du groupe obtenu et ce qui va se passer.
// Les champs ne se vident qu'une fois le groupe créé (pop-in annulée : ils gardent tout).

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";

import { PillField } from "@/components/tags/PillField";
import { TagPill } from "@/components/tags/TagPill";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useCategories } from "@/hooks/useCategories";
import { usePills } from "@/hooks/usePills";
import type { ManagedTag } from "@/lib/api";
import { createGroup } from "@/lib/groupRules";
import { removePill } from "@/lib/pillText";
import { rulesApi, type GroupPreview } from "@/lib/rulesApi";
import { displayTag, normalizeTag } from "@/lib/tags";
import { useTagResolver } from "./RuleForm";

/** Pastille : un tag (`id`), ou un nom qui n'en est pas un (`id` vide : il deviendra un nom fusionné). */
type Chip = { name: string; id: number | null };

/** Cadre des champs, comme ceux de la barre de la sélection. */
const FIELD = "flex min-h-9 min-w-0 flex-1 items-center rounded-lg border border-border bg-background px-1.5 py-0.5 focus-within:border-[#d9a94e]";
/** Nom qui n'est pas un tag (il deviendra un nom fusionné) : gris. */
const MERGED_GREY = "#8b8d96";
const list = (names: string[]) => names.map((n) => `« ${displayTag(n)} »`).join(", ");

function Preview({ preview, merge }: { preview: GroupPreview; merge: boolean }) {
  if (!preview.principal) return null;
  const names = [
    ...preview.existing.map((n) => ({ name: n.name, merged: n.merged })),
    ...preview.added.map((n) => ({ name: n.name, merged: merge })),
    ...preview.pure.map((name) => ({ name, merged: true })),
  ];
  const p = `« ${displayTag(preview.principal)} »`;
  return (
    <div data-zone="regles.synonymes.ajout.apercu" className="mt-1.5 space-y-0.5 text-xs text-muted-foreground select-text">
      {names.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-1.5">
          Résultat :
          <Star className="h-3 w-3 fill-[#d9a94e] text-[#d9a94e]" />
          <span className="font-mono text-foreground">{displayTag(preview.principal)}</span>
          {names.map((n) => (
            <span key={n.name} className="font-mono">
              = <span className={n.merged ? undefined : "text-foreground"}>{displayTag(n.name)}</span>
            </span>
          ))}
        </p>
      )}
      {preview.newPrincipal && <p>{p} n'existe pas encore : il sera créé.</p>}
      {preview.principalFrom && <p>{p} fait partie du groupe de « {displayTag(preview.principalFrom)} » : il en deviendra le tag principal.</p>}
      {!preview.principalFrom && preview.existing.length > 0 && <p>{p} a déjà des synonymes : les nouveaux noms y seront ajoutés.</p>}
      {preview.joined.length > 0 && <p>{preview.joined.length > 1 ? `Les groupes de ${list(preview.joined)} seront réunis à celui-ci.` : `Le groupe de ${list(preview.joined)} sera réuni à celui-ci.`}</p>}
      {preview.pure.length > 0 && (
        <p>
          {list(preview.pure)} {preview.pure.length > 1 ? "ne sont pas des tags : ils seront des noms fusionnés" : "n'est pas un tag : ce sera un nom fusionné"} dans {p}, sans média.
        </p>
      )}
    </div>
  );
}

export function GroupForm({ tags, tagOf }: { tags: ManagedTag[]; tagOf: (id: number) => ManagedTag | undefined }) {
  const { color } = useCategories();
  const byName = useMemo(() => new Map(tags.map((t) => [t.name, t])), [tags]);
  const principal = usePills<Chip>((a, b) => a.name === b.name);
  const names = usePills<Chip>((a, b) => a.name === b.name);
  const { resolve, dialog } = useTagResolver();
  const [merge, setMerge] = useState(false);
  const [busy, setBusy] = useState(false);
  const chief = principal.list[0];
  const typed = names.list.map((n) => n.name);
  const { data: preview } = useQuery({
    queryKey: ["group-preview", chief?.name, typed],
    queryFn: () => rulesApi.groupPreview(chief.name, typed),
    enabled: !!chief,
  });
  // Un seul tag principal : la dernière pastille posée remplace l'autre.
  const last = useRef<Chip | undefined>(undefined);
  useEffect(() => {
    if (principal.list.length < 2) {
      last.current = principal.list[0];
      return;
    }
    const old = principal.list.findIndex((c) => c.name === last.current?.name);
    principal.edit((doc, sel) => removePill(doc, sel, old >= 0 ? old : 0));
  }, [principal.list]); // `edit` ne change que l'état du champ
  // Interrupteur : allumé d'office quand le groupe du principal est entièrement fusionné (D2.2, D8.1).
  const fully = preview?.fullyMerged ?? false;
  useEffect(() => setMerge(fully), [chief?.name, fully]);

  const chip = (tag: { name: string; id: number | null }) => ({ name: tag.name, id: tag.id });
  const pill = (c: Chip, remove: () => void, what: string) => (
    <TagPill color={c.id !== null ? color(tagOf(c.id)?.categoryId ?? 0) : MERGED_GREY} onRemove={remove} removeLabel={`Retirer « ${displayTag(c.name)} » ${what}`}>
      {displayTag(c.name)}
    </TagPill>
  );
  const ready = !!chief && chief.id !== null && names.list.length > 0 && !principal.hasText && !names.hasText && !busy;
  const submit = async () => {
    if (!ready || chief.id === null) return;
    setBusy(true);
    const done = await createGroup({ id: chief.id, name: chief.name }, typed, merge, preview).finally(() => setBusy(false));
    if (done) {
      principal.clear();
      names.clear();
    }
  };
  return (
    <div data-zone="regles.synonymes.ajout">
      <div className="flex items-start gap-1.5">
        <PillField
          zone="regles.synonymes.ajout.principal"
          dropdown="bottom"
          className={FIELD}
          pills={principal}
          pillKey={(c) => c.name}
          resolve={async (raw) => {
            const tag = await resolve(raw);
            return tag ? { name: tag.name, id: tag.id } : null;
          }}
          toItem={(tag) => chip({ name: tag.name, id: tag.id })}
          toClip={(c) => ({ name: c.name, categoryId: (c.id !== null ? tagOf(c.id)?.categoryId : undefined) ?? 0 })}
          fromClip={(c) => chip({ name: c.name, id: byName.get(c.name)?.id ?? null })}
          onSubmit={() => void submit()}
          placeholder="Tag principal…"
          renderPill={(c, remove) => pill(c, remove, "du tag principal")}
        />
        <PillField
          zone="regles.synonymes.ajout.noms"
          dropdown="bottom"
          className={FIELD}
          pills={names}
          pillKey={(c) => c.name}
          resolve={(raw) => {
            const name = normalizeTag(raw);
            return name ? { name, id: byName.get(name)?.id ?? null } : null;
          }}
          toItem={(tag) => chip({ name: tag.alias ?? tag.name, id: tag.alias ? null : tag.id })}
          toClip={(c) => ({ name: c.name, categoryId: (c.id !== null ? tagOf(c.id)?.categoryId : undefined) ?? 0 })}
          fromClip={(c) => chip({ name: c.name, id: byName.get(c.name)?.id ?? null })}
          taken={(tag) => (tag.name === chief?.name ? "C'est le tag principal" : null)}
          onSubmit={() => void submit()}
          placeholder="Synonymes…"
          renderPill={(c, remove) => pill(c, remove, "des synonymes")}
        />
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
          <Switch on={merge} onToggle={() => setMerge(!merge)} zone="regles.synonymes.ajout.fusion" label="Fusionner" title="Allumé : les médias des noms ajoutés passent au tag principal (toujours réversible)." />
          Fusionner
        </label>
        <Button
          data-zone="regles.synonymes.ajout.creer"
          size="sm"
          disabled={!ready}
          onClick={() => void submit()}
          className="ml-auto h-8 bg-[#d9a94e] text-xs text-[#1a1408] hover:bg-[#e3b75f] disabled:hover:bg-[#d9a94e]"
        >
          Créer
        </Button>
      </div>
      {preview && <Preview preview={preview} merge={merge} />}
      {dialog}
    </div>
  );
}
