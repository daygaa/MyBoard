// Formulaire de création d'un groupe de synonymes (refonte, décisions D2.2, D3, D4, D4.1, D14 ; retour T3,
// points TAGM-15.5 et TAGM-15.6 ; proposition 5 du lot R3) : « Tag principal » (une seule pastille),
// « Synonymes » (des pastilles), interrupteur « Fusionner » (éteint ; allumé d'office si le groupe du principal
// est entièrement fusionné) et « Créer », sur une ligne ; dessous, une ligne d'aperçu de hauteur fixe (le groupe
// obtenu ; ce qui va se passer, dans la bulle de l'icône « i »).
// Les champs ne se vident qu'une fois le groupe créé (pop-in annulée : ils gardent tout).

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, Star } from "lucide-react";

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
import { titleIfCut } from "@/lib/utils";
import { useTagResolver } from "./RuleForm";

/** Pastille : un tag (`id`), ou un nom qui n'en est pas un (`id` vide : il deviendra un nom fusionné). */
type Chip = { name: string; id: number | null };

/** Cadre des champs, comme ceux de la barre de la sélection. */
const FIELD = "flex min-h-9 min-w-0 flex-1 items-center rounded-lg border border-border bg-background px-1.5 py-0.5 focus-within:border-[#d9a94e]";
/** Nom qui n'est pas un tag (il deviendra un nom fusionné) : gris. */
const MERGED_GREY = "#8b8d96";
const list = (names: string[]) => names.map((n) => `« ${displayTag(n)} »`).join(", ");

/** Ce qui va se passer, en phrases (bulle de l'icône « i »). */
function notes(preview: GroupPreview, principal: string): string[] {
  const p = `« ${displayTag(principal)} »`;
  const { joined, pure } = preview;
  return [
    preview.newPrincipal && `${p} n'existe pas encore : il sera créé.`,
    preview.principalFrom && `${p} fait partie du groupe de « ${displayTag(preview.principalFrom)} » : il en deviendra le tag principal.`,
    !preview.principalFrom && preview.existing.length > 0 && `${p} a déjà des synonymes : les nouveaux noms y seront ajoutés.`,
    joined.length > 0 && (joined.length > 1 ? `Les groupes de ${list(joined)} seront réunis à celui-ci.` : `Le groupe de ${list(joined)} sera réuni à celui-ci.`),
    pure.length > 0 && `${list(pure)} ${pure.length > 1 ? "ne sont pas des tags : ils seront des noms fusionnés" : "n'est pas un tag : ce sera un nom fusionné"} dans ${p}, sans média.`,
  ].filter((n): n is string => !!n);
}

/** Ligne d'aperçu, de hauteur fixe pour que les barres « Filtrer par nom » des deux tableaux restent alignées
 *  (retour T3, point TAGM-15.5) : « Résultat : ★ X = Y = Z » (coupé s'il est trop long, entier dans sa bulle) et
 *  l'icône « i » des explications, ou le refus en rouge. Vide tant qu'un des deux champs n'a pas de pastille. */
function Preview({ preview, merge, why }: { preview: GroupPreview | undefined; merge: boolean; why: string | null }) {
  const principal = preview?.principal;
  const names = preview
    ? [
        ...preview.existing.map((n) => ({ name: n.name, merged: n.merged })),
        ...preview.added.map((n) => ({ name: n.name, merged: merge })),
        ...preview.pure.map((name) => ({ name, merged: true })),
      ]
    : [];
  const info = preview && principal ? notes(preview, principal) : [];
  return (
    <div data-zone="regles.synonymes.ajout.apercu" className="mt-1.5 flex h-5 min-w-0 items-center gap-1.5 text-xs text-muted-foreground select-text">
      {principal && why && <span className="truncate text-rose-300">{why}</span>}
      {principal && !why && (
        <>
          <span onMouseEnter={(e) => titleIfCut(e.currentTarget)} className="min-w-0 truncate">
            Résultat : <Star className="inline h-3 w-3 -translate-y-px fill-[#d9a94e] text-[#d9a94e]" />{" "}
            <span className="font-mono text-foreground">{displayTag(principal)}</span>
            {names.map((n) => (
              <span key={n.name} className="font-mono">
                {" = "}
                <span className={n.merged ? undefined : "text-foreground"}>{displayTag(n.name)}</span>
              </span>
            ))}
          </span>
          {info.length > 0 && (
            <span data-zone="regles.synonymes.ajout.apercu.infos" title={info.join("\n")} className="grid shrink-0 cursor-default place-items-center hover:text-foreground">
              <Info className="h-3.5 w-3.5" />
            </span>
          )}
        </>
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
  // « Créer » grisé, avec la raison sous les champs : le principal tapé aussi en synonyme (sinon « X = X »
  // était accepté puis ignoré), ou des noms qui sont tous déjà dans le groupe (retouches de R3).
  const self = !!chief && typed.includes(chief.name);
  const nothing = !!preview && typed.length > 0 && preview.added.length + preview.pure.length === 0;
  const already = typed.length > 1 ? `Ces tags sont déjà des synonymes de « ${displayTag(chief?.name ?? "")} ».` : `Ce tag est déjà un synonyme de « ${displayTag(chief?.name ?? "")} ».`;
  const why = self ? `« ${displayTag(chief.name)} » est déjà le tag principal : retirez-le des synonymes.` : nothing ? already : null;
  // Aperçu seulement quand chaque champ a au moins une pastille (réponse du 29/10).
  const shown = principal.list.length > 0 && names.list.length > 0;
  const ready = !!chief && chief.id !== null && names.list.length > 0 && !why && !!preview && !principal.hasText && !names.hasText && !busy;
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
      {/* Une seule ligne, comme le formulaire des parents (retour T3, point TAGM-15.5). */}
      <div className="flex items-center gap-1.5">
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
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 pl-1 text-xs text-muted-foreground">
          <Switch on={merge} onToggle={() => setMerge(!merge)} zone="regles.synonymes.ajout.fusion" label="Fusionner" title="Activé : les médias des noms ajoutés passent au tag principal (toujours réversible)." />
          Fusionner
        </label>
        <Button
          data-zone="regles.synonymes.ajout.creer"
          size="sm"
          disabled={!ready}
          onClick={() => void submit()}
          className="h-9 bg-[#d9a94e] text-xs text-[#1a1408] hover:bg-[#e3b75f] disabled:hover:bg-[#d9a94e]"
        >
          Créer
        </Button>
      </div>
      <Preview preview={shown ? preview : undefined} merge={merge} why={why} />
      {dialog}
    </div>
  );
}
