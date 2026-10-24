// Barre du bas de la sélection multiple (SEL-07), apparence v8 : « N sélectionnés · Ajouter des tags… ·
// Retirer des tags… · Appliquer ». Chaque champ garde ses tags en pastilles jusqu'à « Appliquer », qui
// fait tout en une opération sur toute la sélection (D-005). « Ajouter » : un tag qui n'existe pas
// encore passe par la pop-in de création (choix de la catégorie, VIEW-22) ; « Retirer » ne propose
// que les tags portés par la sélection. Collée en bas de l'écran pendant le défilement.
// Clavier et souris des champs (SEL-07.2, SEL-07.3, SEL-12) : components/tags/PillField.tsx ; Entrée
// dans un champ vide applique.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { CreateTagDialog } from "@/components/tags/CreateTagDialog";
import { PillField } from "@/components/tags/PillField";
import { TagInput } from "@/components/tags/TagInput";
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
let adderInput: HTMLInputElement | null = null;
let removerInput: HTMLInputElement | null = null;

/** Durée du signal autour du champ qui reçoit le curseur depuis le menu (SEL-03.2). */
const SIGNAL_MS = 1400;

function focusAndSignal(input: HTMLInputElement | null) {
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

type Chip = { name: string; categoryId: number };

const FIELD = "flex min-h-9 min-w-0 flex-1 flex-wrap items-center gap-1 rounded-lg border border-border bg-background px-1.5 py-1 focus-within:border-[#d9a94e]";

export function SelectionBar() {
  const active = useSelection((s) => s.active);
  const count = useSelection((s) => s.count);
  const version = useSelection((s) => s.version);
  const { color } = useCategories();
  const adder = usePills<Chip>((a, b) => a.name === b.name);
  const remover = usePills<TagInfo>((a, b) => a.id === b.id);
  const [toCreate, setToCreate] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  // Tags de la sélection, lus quand on se sert du champ « Retirer ».
  const { data: present = [] } = useQuery({
    queryKey: ["selection-tags", version],
    queryFn: () => api.selectionTags(selectedIds()),
    enabled: active && removing && count > 0,
  });
  if (!active) return null;

  const submitAdd = async (raw: string) => {
    const name = normalizeTag(raw);
    if (!name) return;
    adder.setText("");
    const existing = await api.findTag(name);
    if (existing) adder.add({ name, categoryId: existing.categoryId });
    else setToCreate(name);
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

  // Du texte tapé pas encore validé dans un des champs : on ne peut pas appliquer (choix du 24/10).
  const canApply = !busy && count > 0 && (adder.list.length > 0 || remover.list.length > 0) && adder.text === "" && remover.text === "";
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
        onEnterEmpty={applyIfReady}
        renderPill={(chip, remove) => (
          <TagPill color={color(chip.categoryId)} onRemove={remove} removeLabel={`Ne pas ajouter « ${displayTag(chip.name)} »`}>
            {displayTag(chip.name)}
          </TagPill>
        )}
      >
        {(box) => (
          <TagInput
            zone="selection.barre.ajouter.champ"
            value={adder.text}
            onChange={adder.setText}
            onSubmit={(raw) => void submitAdd(raw)}
            onPick={(tag) => {
              adder.setText("");
              adder.add({ name: tag.name, categoryId: tag.categoryId });
            }}
            dropdown="top"
            placeholder={box.placeholder ? "Ajouter des tags…" : ""}
            suggest={box.suggest}
            className={box.className}
            inputClassName={box.inputClassName}
            inputRef={(el) => {
              box.inputRef(el);
              adderInput = el;
            }}
          />
        )}
      </PillField>
      <PillField
        zone="selection.barre.retirer"
        className={FIELD}
        pills={remover}
        pillKey={(tag) => tag.id}
        onEnterEmpty={applyIfReady}
        onFocus={() => setRemoving(true)}
        onBlur={() => setRemoving(false)}
        renderPill={(tag, remove) => (
          <TagPill color={color(tag.categoryId)} onRemove={remove} removeLabel={`Ne pas retirer « ${displayTag(tag.name)} »`}>
            {displayTag(tag.name)}
          </TagPill>
        )}
      >
        {(box) => (
          <TagInput
            zone="selection.barre.retirer.champ"
            value={remover.text}
            onChange={remover.setText}
            source={present}
            onSubmit={(raw) => {
              const tag = present.find((t) => t.name === normalizeTag(raw));
              if (!tag) return;
              remover.setText("");
              remover.add(tag);
            }}
            onPick={(tag) => {
              remover.setText("");
              remover.add(tag);
            }}
            dropdown="top"
            placeholder={box.placeholder ? "Retirer des tags…" : ""}
            suggest={box.suggest}
            className={box.className}
            inputClassName={box.inputClassName}
            inputRef={(el) => {
              box.inputRef(el);
              removerInput = el;
            }}
          />
        )}
      </PillField>
      <Button
        data-zone="selection.barre.appliquer"
        disabled={!canApply}
        onClick={() => void apply()}
        className="shrink-0 bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f] disabled:hover:bg-[#d9a94e]"
      >
        Appliquer
      </Button>
      <CreateTagDialog
        name={toCreate}
        onCancel={() => setToCreate(null)}
        onCreate={(categoryId) => {
          if (toCreate) adder.add({ name: toCreate, categoryId });
          setToCreate(null);
        }}
      />
    </div>
  );
}
