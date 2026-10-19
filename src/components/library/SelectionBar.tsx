// Barre du bas de la sélection multiple (SEL-07), apparence v8 : « N sélectionnés · Ajouter des tags… ·
// Retirer des tags… · Appliquer ». Chaque champ garde ses tags en pastilles jusqu'à « Appliquer », qui
// fait tout en une opération sur toute la sélection (D-005). « Ajouter » : un tag qui n'existe pas
// encore passe par la pop-in de création (choix de la catégorie, VIEW-22) ; « Retirer » ne propose
// que les tags portés par la sélection. Collée en bas de l'écran pendant le défilement.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { CreateTagDialog } from "@/components/tags/CreateTagDialog";
import { TagInput } from "@/components/tags/TagInput";
import { TagPill } from "@/components/tags/TagPill";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/hooks/useCategories";
import { api, type TagInfo } from "@/lib/api";
import { formatNumber, plural } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import { displayTag, normalizeTag } from "@/lib/tags";
import { refreshLibrary } from "@/stores/deletion";
import { selectedIds, useSelection } from "@/stores/selection";
import { useViewer } from "@/stores/viewer";

/** Champ « Ajouter des tags » : « Ajouter des tags à la sélection » du menu ⋮ y place le curseur. */
let adderInput: HTMLInputElement | null = null;

export function focusTagAdder() {
  adderInput?.focus();
}

type Chip = { name: string; categoryId: number };

const FIELD = "flex min-h-9 min-w-0 flex-1 flex-wrap items-center gap-1 rounded-lg border border-border bg-background px-1.5 py-1 focus-within:border-[#d9a94e]/60";
const INPUT = "h-7 rounded-none border-0 bg-transparent px-1 focus:border-0";

export function SelectionBar() {
  const active = useSelection((s) => s.active);
  const count = useSelection((s) => s.count);
  const version = useSelection((s) => s.version);
  const { color } = useCategories();
  const [addText, setAddText] = useState("");
  const [toAdd, setToAdd] = useState<Chip[]>([]);
  const [toCreate, setToCreate] = useState<string | null>(null);
  const [removeText, setRemoveText] = useState("");
  const [toRemove, setToRemove] = useState<TagInfo[]>([]);
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  // Tags de la sélection, lus quand on se sert du champ « Retirer ».
  const { data: present = [] } = useQuery({
    queryKey: ["selection-tags", version],
    queryFn: () => api.selectionTags(selectedIds()),
    enabled: active && removing && count > 0,
  });
  if (!active) return null;

  const addChip = (chip: Chip) => setToAdd((list) => (list.some((c) => c.name === chip.name) ? list : [...list, chip]));
  const removeChip = (tag: TagInfo) => setToRemove((list) => (list.some((t) => t.id === tag.id) ? list : [...list, tag]));

  const submitAdd = async (raw: string) => {
    const name = normalizeTag(raw);
    if (!name) return;
    setAddText("");
    const existing = await api.findTag(name);
    if (existing) addChip({ name, categoryId: existing.categoryId });
    else setToCreate(name);
  };

  const apply = async () => {
    setBusy(true);
    try {
      await api.editSelectionTags(selectedIds(), toAdd, toRemove.map((t) => t.id));
      setToAdd([]);
      setToRemove([]);
      setAddText("");
      setRemoveText("");
      await refreshLibrary();
      void queryClient.invalidateQueries({ queryKey: ["media-detail"] });
      void queryClient.invalidateQueries({ queryKey: ["selection-tags"] });
    } catch (error) {
      useViewer.getState().setError({ action: "Modifier les tags de la sélection", code: null, message: String(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-zone="selection.barre" className="sticky bottom-4 z-30 mt-4 flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 shadow-xl">
      <span data-zone="selection.barre.compteur" className="shrink-0 text-sm font-semibold text-foreground tabular-nums">
        {formatNumber(count)} {plural(count, "sélectionné")}
      </span>
      <div data-zone="selection.barre.ajouter" className={FIELD}>
        {toAdd.map((chip) => (
          <TagPill
            key={chip.name}
            color={color(chip.categoryId)}
            onRemove={() => setToAdd((list) => list.filter((c) => c.name !== chip.name))}
            removeLabel={`Ne pas ajouter « ${displayTag(chip.name)} »`}
          >
            {displayTag(chip.name)}
          </TagPill>
        ))}
        <TagInput
          zone="selection.barre.ajouter.champ"
          value={addText}
          onChange={setAddText}
          onSubmit={(raw) => void submitAdd(raw)}
          onPick={(tag) => {
            setAddText("");
            addChip({ name: tag.name, categoryId: tag.categoryId });
          }}
          dropdown="top"
          placeholder="Ajouter des tags…"
          className="h-7 min-w-32 flex-1"
          inputClassName={INPUT}
          inputRef={(el) => {
            adderInput = el;
          }}
        />
      </div>
      <div data-zone="selection.barre.retirer" className={FIELD} onFocus={() => setRemoving(true)} onBlur={() => setRemoving(false)}>
        {toRemove.map((tag) => (
          <TagPill
            key={tag.id}
            color={color(tag.categoryId)}
            onRemove={() => setToRemove((list) => list.filter((t) => t.id !== tag.id))}
            removeLabel={`Ne pas retirer « ${displayTag(tag.name)} »`}
          >
            {displayTag(tag.name)}
          </TagPill>
        ))}
        <TagInput
          zone="selection.barre.retirer.champ"
          value={removeText}
          onChange={setRemoveText}
          source={present}
          onSubmit={(raw) => {
            const tag = present.find((t) => t.name === normalizeTag(raw));
            if (!tag) return;
            setRemoveText("");
            removeChip(tag);
          }}
          onPick={(tag) => {
            setRemoveText("");
            removeChip(tag);
          }}
          dropdown="top"
          placeholder="Retirer des tags…"
          className="h-7 min-w-32 flex-1"
          inputClassName={INPUT}
        />
      </div>
      <Button
        data-zone="selection.barre.appliquer"
        disabled={busy || count === 0 || (toAdd.length === 0 && toRemove.length === 0)}
        onClick={() => void apply()}
        className="shrink-0 bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f] disabled:hover:bg-[#d9a94e]"
      >
        Appliquer
      </Button>
      <CreateTagDialog
        name={toCreate}
        onCancel={() => setToCreate(null)}
        onCreate={(categoryId) => {
          if (toCreate) addChip({ name: toCreate, categoryId });
          setToCreate(null);
        }}
      />
    </div>
  );
}
