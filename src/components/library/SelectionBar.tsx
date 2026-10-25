// Barre du bas de la sélection multiple (SEL-07), apparence v8 : « N sélectionnés · Ajouter des tags… ·
// Retirer des tags… · Appliquer ». Chaque champ garde ses tags en pastilles jusqu'à « Appliquer », qui
// fait tout en une opération sur toute la sélection (D-005). « Ajouter » : un tag qui n'existe pas
// encore passe par la pop-in de création (choix de la catégorie, VIEW-22) ; « Retirer » ne propose
// que les tags portés par la sélection. Collée en bas de l'écran pendant le défilement.
// Clavier et souris des champs (SEL-07.2, SEL-07.3, SEL-12) : components/tags/PillField.tsx ; Entrée
// sans aucun texte tapé applique. Fin du mode sélection (Échap, « Terminer ») : les champs se vident.

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { CreateTagDialog } from "@/components/tags/CreateTagDialog";
import { PillField } from "@/components/tags/PillField";
import { TagPill } from "@/components/tags/TagPill";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/useCategories";
import { usePills } from "@/hooks/usePills";
import { api, type TagInfo } from "@/lib/api";
import { formatNumber, plural } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import { displayTag, normalizeTag } from "@/lib/tags";
import { refreshLibrary } from "@/stores/deletion";
import { selectedIds, useSelection } from "@/stores/selection";
import { useViewer } from "@/stores/viewer";

/** Champs de la barre : les entrées « Ajouter des tags à la sélection » et « Retirer des tags de la
 *  sélection » du menu ⋮ y placent le curseur (SEL-03, SEL-03.1). */
let adderInput: HTMLElement | null = null;
let removerInput: HTMLElement | null = null;

/** Durée du signal autour du champ qui reçoit le curseur depuis le menu (SEL-03.2). */
const SIGNAL_MS = 1400;

function focusAndSignal(input: HTMLElement | null) {
  if (!input) return;
  input.focus();
  // Le champ s'entoure d'un halo doré qui pulse deux fois : on voit où le curseur est arrivé.
  const box = input.closest<HTMLElement>('[data-zone="selection.barre.ajouter"], [data-zone="selection.barre.retirer"]');
  if (!box) return;
  box.classList.remove("champ-signale");
  void box.offsetWidth; // relance l'animation si elle était en cours
  box.classList.add("champ-signale");
  window.setTimeout(() => box.classList.remove("champ-signale"), SIGNAL_MS);
}

export const focusTagAdder = () => focusAndSignal(adderInput);
export const focusTagRemover = () => focusAndSignal(removerInput);

/** Tag à ajouter ; catégorie inconnue (`null`) pour un tag collé depuis la recherche : il garde la sienne. */
type Chip = { name: string; categoryId: number | null };

const FIELD = "flex min-h-9 min-w-0 flex-1 items-center rounded-lg border border-border bg-background px-1.5 py-1 focus-within:border-[#d9a94e]";

export function SelectionBar() {
  const active = useSelection((s) => s.active);
  const count = useSelection((s) => s.count);
  const version = useSelection((s) => s.version);
  const { color } = useCategories();
  const adder = usePills<Chip>((a, b) => a.name === b.name);
  const remover = usePills<TagInfo>((a, b) => a.id === b.id);
  const [toCreate, setToCreate] = useState<string | null>(null);
  /** Réponse attendue de la pop-in de création (la pastille, ou rien si elle est annulée). */
  const created = useRef<(chip: Chip | null) => void>(() => {});
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  // Tags de la sélection, lus quand on se sert du champ « Retirer ».
  const { data: present = [] } = useQuery({
    queryKey: ["selection-tags", version],
    queryFn: () => api.selectionTags(selectedIds()),
    enabled: active && removing && count > 0,
  });
  // Tags déjà sur tous les médias cochés : « Ajouter » ne les propose pas (SRCH-29, choix du 25/10).
  const { data: common = [] } = useQuery({
    queryKey: ["selection-common-tags", version],
    queryFn: () => api.selectionCommonTags(selectedIds()),
    enabled: active && adding && count > 0,
  });
  // Fin du mode sélection : pastilles et textes tapés s'en vont (retour du 25/10).
  const { clear: clearAdder } = adder;
  const { clear: clearRemover } = remover;
  useEffect(() => {
    if (active) return;
    clearAdder();
    clearRemover();
  }, [active]); // `clear` ne fait que vider l'état : seul `active` compte
  if (!active) return null;

  /** Tag tapé dans « Ajouter » : existant, sinon créé par la pop-in (annulée : le texte reste). */
  const resolveAdd = async (raw: string): Promise<Chip | null> => {
    const name = normalizeTag(raw);
    if (!name) return null;
    const existing = await api.findTag(name);
    if (existing) return { name, categoryId: existing.categoryId };
    return new Promise((done) => {
      created.current = done;
      setToCreate(name);
    });
  };

  const apply = async () => {
    setBusy(true);
    try {
      await api.editSelectionTags(selectedIds(), adder.list, remover.list.map((t) => t.id));
      adder.clear();
      remover.clear();
      await refreshLibrary();
      void queryClient.invalidateQueries({ queryKey: ["media-detail"] });
      void queryClient.invalidateQueries({ queryKey: ["selection-tags"] });
    } catch (error) {
      useViewer.getState().setError({ action: "Modifier les tags de la sélection", code: null, message: String(error) });
    } finally {
      setBusy(false);
    }
  };

  // Du texte tapé pas encore validé dans un des champs : on ne peut pas appliquer (choix du 24/10), une
  // bulle le dit (25/10).
  const typed = adder.hasText || remover.hasText;
  const canApply = !busy && count > 0 && (adder.list.length > 0 || remover.list.length > 0) && !typed;
  const applyIfReady = () => {
    if (canApply) void apply();
  };

  return (
    <div data-zone="selection.barre" className="sticky bottom-4 z-30 mt-4 flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 shadow-xl">
      <span data-zone="selection.barre.compteur" className="shrink-0 select-text text-sm font-semibold text-foreground tabular-nums">
        {formatNumber(count)} {plural(count, "sélectionné")}
      </span>
      <PillField
        zone="selection.barre.ajouter"
        className={FIELD}
        pills={adder}
        pillKey={(chip) => chip.name}
        resolve={resolveAdd}
        toItem={(tag) => ({ name: tag.name, categoryId: tag.categoryId })}
        toClip={(chip) => chip}
        // Une exclusion ou un joker de la recherche n'est pas un tag à poser.
        fromClip={(c) => (c.exclude || c.prefix ? null : { name: c.name, categoryId: c.categoryId })}
        hidden={common}
        placeholder="Ajouter des tags…"
        onSubmit={applyIfReady}
        onFocus={() => setAdding(true)}
        onBlur={() => setAdding(false)}
        editorRef={(el) => {
          adderInput = el;
        }}
        renderPill={(chip, remove) => (
          <TagPill color={color(chip.categoryId ?? -1)} onRemove={remove} removeLabel={`Ne pas ajouter « ${displayTag(chip.name)} »`}>
            {displayTag(chip.name)}
          </TagPill>
        )}
      />
      <PillField
        zone="selection.barre.retirer"
        className={FIELD}
        pills={remover}
        pillKey={(tag) => tag.id}
        resolve={(raw) => present.find((t) => t.name === normalizeTag(raw)) ?? null}
        toItem={(tag) => tag}
        toClip={(tag) => ({ name: tag.name, categoryId: tag.categoryId })}
        // Seuls les tags portés par la sélection peuvent être retirés.
        fromClip={(c) => (c.exclude || c.prefix ? null : (present.find((t) => t.name === c.name) ?? null))}
        source={present}
        placeholder="Retirer des tags…"
        onSubmit={applyIfReady}
        onFocus={() => setRemoving(true)}
        onBlur={() => setRemoving(false)}
        editorRef={(el) => {
          removerInput = el;
        }}
        renderPill={(tag, remove) => (
          <TagPill color={color(tag.categoryId)} onRemove={remove} removeLabel={`Ne pas retirer « ${displayTag(tag.name)} »`}>
            {displayTag(tag.name)}
          </TagPill>
        )}
      />
      <span title={typed ? "Valide ou efface d'abord le texte tapé" : undefined} className="shrink-0">
        <Button
          data-zone="selection.barre.appliquer"
          disabled={!canApply}
          onClick={() => void apply()}
          className="bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f] disabled:hover:bg-[#d9a94e]"
        >
          Appliquer
        </Button>
      </span>
      <CreateTagDialog
        name={toCreate}
        onCancel={() => {
          created.current(null);
          setToCreate(null);
        }}
        onCreate={(categoryId) => {
          if (toCreate) created.current({ name: toCreate, categoryId });
          setToCreate(null);
        }}
      />
    </div>
  );
}
