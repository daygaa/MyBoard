// Création d'une règle de parent : deux champs à pastilles, « Enfant » → « Parent », une seule pastille chacun
// (retour T3, point TAGM-16.6 : une fois le tag choisi, on ne peut plus qu'effacer sa pastille), Entrée ou
// « Créer » (point TAGM-16.5). Un tag tapé qui n'existe pas encore passe par la pop-in « Créer un nouveau tag »
// (choix de la catégorie) ; un tag fusionné tapé reste affiché (en gris) et la règle va sur son principal (Q.4).
// Le refus éventuel (nom pris, boucle…) s'affiche sous les champs. `useTagResolver` sert aussi ailleurs.

import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";

import { CreateTagDialog } from "@/components/tags/CreateTagDialog";
import { PillField } from "@/components/tags/PillField";
import { TagPill } from "@/components/tags/TagPill";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/useCategories";
import { usePills, type Pills } from "@/hooks/usePills";
import { api, type ManagedTag } from "@/lib/api";
import type { PillDoc } from "@/lib/pillText";
import { rulesApi } from "@/lib/rulesApi";
import { runTagAction } from "@/lib/tagManager";
import { displayTag, normalizeTag } from "@/lib/tags";

/** `alias` : le nom fusionné tapé, quand le texte a donné son tag principal. */
export type Named = { id: number; name: string; alias?: string };

/** Tag désigné par un texte tapé : existant (ou tag principal d'un synonyme), sinon créé après la
 *  pop-in « Créer un nouveau tag » ; `null` si l'utilisateur annule. */
export function useTagResolver() {
  const [pending, setPending] = useState<{ name: string; done: (tag: Named | null) => void } | null>(null);
  const resolve = async (text: string): Promise<Named | null> => {
    const name = normalizeTag(text);
    if (!name) return null;
    const found = await api.findTag(name).catch(() => null);
    if (found) return { id: found.id, name: found.name, alias: found.alias ?? undefined };
    return new Promise((done) => setPending({ name, done }));
  };
  const dialog = (
    <CreateTagDialog
      name={pending?.name ?? null}
      onCancel={() => {
        pending?.done(null);
        setPending(null);
      }}
      onCreate={(categoryId) => {
        if (!pending) return;
        setPending(null);
        void runTagAction("Créer le tag", () => rulesApi.createTag(pending.name, categoryId)).then((id) => pending.done(id === undefined ? null : { id, name: pending.name }));
      }}
    />
  );
  return { resolve, dialog };
}

/** Cadre des champs, comme ceux du formulaire des synonymes (même hauteur, pastille centrée). */
const FIELD = "flex min-h-9 min-w-0 flex-1 items-center rounded-lg border border-border bg-background px-1.5 py-0.5 focus-within:border-[#d9a94e]";
/** Tag fusionné tapé par son nom : gris. */
const MERGED_GREY = "#8b8d96";

export type RuleDocs = [PillDoc<Named> | null, PillDoc<Named> | null];

type Props = {
  zone: string;
  placeholders: [string, string];
  /** Les deux tags choisis ; renvoie le refus à afficher, `null` (champs vidés) ou `false` (annulé : les
   *  champs gardent leurs pastilles, retour T3, point TAGM-16.2). */
  onAdd: (left: Named, right: Named) => Promise<string | null | false>;
  tags: ManagedTag[];
  tagOf: (id: number) => ManagedTag | undefined;
  className?: string;
  /** Champs retrouvés au retour sur l'onglet, et chaque changement à garder (point TAGM-15.20). */
  saved?: RuleDocs;
  onDocs?: (docs: RuleDocs) => void;
};

const same = (a: Named, b: Named) => a.id === b.id && a.alias === b.alias;

/** Deux champs « gauche → droite » et « Créer ». */
export function RuleForm({ zone, placeholders, onAdd, tags, tagOf, className, saved, onDocs }: Props) {
  const { color } = useCategories();
  const byName = useMemo(() => new Map(tags.map((t) => [t.name, t])), [tags]);
  const left = usePills<Named>(same, saved?.[0]);
  const right = usePills<Named>(same, saved?.[1]);
  useEffect(() => onDocs?.([left.doc, right.doc]), [left.doc, right.doc]); // `onDocs` : écriture dans un état extérieur
  const { resolve, dialog } = useTagResolver();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const from = left.list[0];
  const to = right.list[0];
  useEffect(() => setError(null), [from, to]);
  const ready = !!from && !!to && !left.hasText && !right.hasText && !busy;
  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    const refused = await onAdd(from, to).finally(() => setBusy(false));
    setError(refused || null);
    if (refused === null) {
      left.clear();
      right.clear();
    }
  };
  // Chaque champ grise le tag déjà choisi dans l'autre (SRCH-29).
  const field = (pills: Pills<Named>, part: string, placeholder: string, other: Named | undefined) => (
    <PillField
      zone={`${zone}.${part}`}
      single
      dropdown="bottom"
      className={FIELD}
      pills={pills}
      pillKey={(t) => `${t.id}:${t.alias ?? ""}`}
      resolve={resolve}
      toItem={(tag) => ({ id: tag.id, name: tag.name, alias: tag.alias ?? undefined })}
      toClip={(t) => ({ name: t.alias ?? t.name, categoryId: tagOf(t.id)?.categoryId ?? 0 })}
      fromClip={(c) => {
        const t = byName.get(c.name);
        return t ? { id: t.id, name: t.name } : null;
      }}
      taken={(tag) => (other && tag.id === other.id ? "Ce tag est déjà dans l'autre champ" : null)}
      onSubmit={() => void submit()}
      placeholder={placeholder}
      renderPill={(t, remove) => (
        <TagPill color={t.alias ? MERGED_GREY : color(tagOf(t.id)?.categoryId ?? 0)} onRemove={remove} removeLabel={`Retirer « ${displayTag(t.alias ?? t.name)} »`} fullTitleIfCut>
          {displayTag(t.alias ?? t.name)}
        </TagPill>
      )}
    />
  );
  return (
    <div data-zone={zone} className={className}>
      <div className="flex items-center gap-1.5">
        {field(left, "gauche", placeholders[0], to)}
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {field(right, "droite", placeholders[1], from)}
        <Button
          data-zone={`${zone}.ajouter`}
          size="sm"
          disabled={!ready}
          onClick={() => void submit()}
          className="h-9 bg-[#d9a94e] text-xs text-[#1a1408] hover:bg-[#e3b75f] disabled:hover:bg-[#d9a94e]"
        >
          Créer
        </Button>
      </div>
      {/* Ligne toujours réservée, de la hauteur de l'aperçu des synonymes : les barres « Filtrer par nom »
          des deux tableaux restent alignées, refus ou pas (retouches de R3). */}
      <p data-zone={`${zone}.refus`} title={error ?? undefined} className="mt-1.5 h-5 truncate text-xs leading-5 text-rose-300">
        {error}
      </p>
      {dialog}
    </div>
  );
}
