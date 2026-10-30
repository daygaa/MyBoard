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
import { displayTag } from "@/lib/tags";
import { cn } from "@/lib/utils";
import { FitLine } from "./FitLine";
import { useTagResolver } from "./RuleForm";
import { useRulesStore, type Chip } from "./rulesTabState";


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
    // Textes demandés le 29/10 (retouches de R3).
    preview.member && `« ${displayTag(preview.member)} » a pour synonyme principal ${p}, ces tags seront simplement ajoutés à son groupe`,
    !preview.member && preview.existing.length > 0 && `${p} a déjà des synonymes, ces tags seront simplement ajoutés à son groupe`,
    joined.length > 0 && (joined.length > 1 ? `Les groupes de ${list(joined)} seront réunis à celui-ci.` : `Le groupe de ${list(joined)} sera réuni à celui-ci.`),
    pure.length > 0 && `${list(pure)} ${pure.length > 1 ? "ne sont pas des tags : ils seront des noms fusionnés" : "n'est pas un tag : ce sera un nom fusionné"} dans ${p}, sans média.`,
  ].filter((n): n is string => !!n);
}

/** Ligne d'aperçu, de hauteur fixe (retour T3, point TAGM-15.5) : « Résultat : ★ X — » (principal en doré, comme
 *  la ligne d'un groupe), d'abord les noms ajoutés, soulignés en doré, puis ceux déjà dans le groupe, entiers
 *  tant qu'ils tiennent, puis « … » ; gris s'ils sont fusionnés (suit l'interrupteur et la liste, en direct).
 *  L'icône « i » donne les explications ; un refus remplace la ligne, en rouge. Vide tant qu'un des deux champs
 *  n'a pas de pastille. */
function Preview({ preview, merge, why }: { preview: GroupPreview | undefined; merge: boolean; why: string | null }) {
  const principal = preview?.principal;
  const fresh = preview ? [...preview.added.map((n) => ({ name: n.name, merged: merge })), ...preview.pure.map((name) => ({ name, merged: true }))] : [];
  const old = preview ? preview.existing.map((n) => ({ name: n.name, merged: n.merged })) : [];
  const item = (n: { name: string; merged: boolean }, added: boolean) => ({
    key: `${added ? "+" : ""}${n.name}`,
    node: (
      <span className={cn("font-mono", !n.merged && "text-foreground", added && "underline decoration-[#d9a94e] underline-offset-[3px]")}>{displayTag(n.name)}</span>
    ),
  });
  const info = preview && principal ? notes(preview, principal) : [];
  return (
    <div data-zone="regles.synonymes.ajout.apercu" className="mt-1.5 flex h-5 min-w-0 items-center gap-1.5 text-xs text-muted-foreground select-text">
      {principal && why && <span className="truncate text-rose-300">{why}</span>}
      {principal && !why && (
        <>
          <FitLine
            head={
              <>
                <span className="mr-1 shrink-0">Résultat :</span>
                <Star className="mr-1 h-3 w-3 shrink-0 fill-[#d9a94e] text-[#d9a94e]" />
                <span className="min-w-0 truncate font-mono text-[#d9a94e]">{displayTag(principal)}</span>
                <span className="px-2">—</span>
              </>
            }
            items={[...fresh.map((n) => item(n, true)), ...old.map((n) => item(n, false))]}
            more={() => "…"}
            title={[...fresh, ...old].map((n) => displayTag(n.name)).join(" · ")}
          />
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
  // Retour arrière / avant : les champs et l'interrupteur sont retrouvés tels quels (point TAGM-15.20).
  const store = useRulesStore();
  const [saved] = useState(() => store.getState());
  const principal = usePills<Chip>((a, b) => a.name === b.name, saved.principal);
  const names = usePills<Chip>((a, b) => a.name === b.name, saved.names);
  useEffect(() => store.setState({ principal: principal.doc, names: names.doc }), [store, principal.doc, names.doc]);
  const { resolve, dialog } = useTagResolver();
  const [merge, setMergeState] = useState(saved.merge.on);
  const setMerge = (on: boolean, auto?: string) => {
    setMergeState(on);
    store.setState((s) => ({ merge: { on, auto: auto ?? s.merge.auto } }));
  };
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
  // Interrupteur : allumé d'office quand le groupe du principal est entièrement fusionné (D2.2, D8.1), une
  // fois par principal (pas à nouveau au retour sur l'onglet, où il garde l'état choisi).
  const auto = !chief ? "" : preview ? `${chief.name}|${preview.fullyMerged}` : null;
  useEffect(() => {
    if (auto === null || auto === store.getState().merge.auto) return;
    setMerge(!!preview?.fullyMerged && !!chief, auto);
  }, [auto]); // le reste suit `auto`

  const chip = (tag: { name: string; id: number | null }) => ({ name: tag.name, id: tag.id });
  const pill = (c: Chip, remove: () => void, what: string) => (
    <TagPill color={c.id !== null ? color(tagOf(c.id)?.categoryId ?? 0) : MERGED_GREY} onRemove={remove} removeLabel={`Retirer « ${displayTag(c.name)} » ${what}`} fullTitleIfCut>
      {displayTag(c.name)}
    </TagPill>
  );
  // « Créer » grisé, avec la raison sous les champs : le principal tapé aussi en synonyme (sinon « X = X »
  // était accepté puis ignoré), ou des noms qui sont tous déjà dans le groupe (retouches de R3).
  const self = !!chief && typed.includes(chief.name);
  const nothing = !!preview && typed.length > 0 && preview.added.length + preview.pure.length === 0;
  // Principal du groupe : celui tapé, ou celui de son groupe s'il en est un nom relié (il le reste).
  const head = preview?.principal ?? chief?.name ?? "";
  const already = typed.length > 1 ? `Ces tags sont déjà des synonymes de « ${displayTag(head)} ».` : `Ce tag est déjà un synonyme de « ${displayTag(head)} ».`;
  const why = self ? `« ${displayTag(chief.name)} » est déjà le tag principal : retirez-le des synonymes.` : nothing ? already : null;
  // Aperçu seulement quand chaque champ a au moins une pastille (réponse du 29/10).
  const shown = principal.list.length > 0 && names.list.length > 0;
  const ready = !!chief && chief.id !== null && names.list.length > 0 && !why && !!preview && !principal.hasText && !names.hasText && !busy;
  const submit = async () => {
    if (!ready || chief.id === null) return;
    setBusy(true);
    const done = await createGroup({ id: chief.id, name: head }, typed, merge, preview).finally(() => setBusy(false));
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
          // Un nom qui n'est pas un tag ouvre « Créer un nouveau tag », comme le tag principal (retouches de R3,
          // 30/10 : D4.1 abandonnée ici) ; un nom fusionné ailleurs reste ce nom (son groupe sera réuni, D14).
          resolve={async (raw) => {
            const tag = await resolve(raw);
            return tag ? { name: tag.alias ?? tag.name, id: tag.alias ? null : tag.id } : null;
          }}
          toItem={(tag) => chip({ name: tag.alias ?? tag.name, id: tag.alias ? null : tag.id })}
          toClip={(c) => ({ name: c.name, categoryId: (c.id !== null ? tagOf(c.id)?.categoryId : undefined) ?? 0 })}
          fromClip={(c) => chip({ name: c.name, id: byName.get(c.name)?.id ?? null })}
          taken={(tag) => {
            // Le principal tapé et les noms déjà dans son groupe sont grisés dans les suggestions (retouches de R3).
            const n = tag.alias ?? tag.name;
            if (n === chief?.name) return "C'est le tag principal";
            if (n === preview?.principal) return "C'est le tag principal de ce groupe";
            return preview?.existing.some((e) => e.name === n) ? `Déjà synonyme de « ${displayTag(head)} »` : null;
          }}
          onSubmit={() => void submit()}
          placeholder="Synonymes…"
          // 3 lignes de pastilles au plus, puis « +N » (retouches de R3, 29/10).
          maxLines={3}
          renderPill={(c, remove) => pill(c, remove, "des synonymes")}
        />
        {/* « Fusionner » et son interrupteur centré dessous, dans la hauteur du bouton « Créer ». */}
        <label className="flex h-9 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 px-0.5 text-xs leading-none text-muted-foreground">
          Fusionner
          <Switch
            on={merge}
            onToggle={() => setMerge(!merge)}
            zone="regles.synonymes.ajout.fusion"
            label="Fusionner"
            title={merge ? "Les tags ajoutés seront fusionnés dans le tag principal" : "Les tags ajoutés seront seulement reliés au tag principal"}
          />
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
