// Barre du bas de la sélection multiple (SEL-07), apparence v8 : « N sélectionnés · Ajouter des tags… ·
// Retirer des tags… · Appliquer ». Chaque champ garde ses tags en pastilles jusqu'à « Appliquer », qui
// fait tout en une opération sur toute la sélection (D-005). « Ajouter » : un tag qui n'existe pas
// encore passe par la pop-in de création (choix de la catégorie, VIEW-22) ; « Retirer » ne propose
// que les tags portés par la sélection. Collée en bas de l'écran pendant le défilement.
// Clavier (SEL-07.2, SEL-07.3) : champ vide, Retour arrière efface la dernière pastille (Ctrl + Z la
// remet, Ctrl + Y l'efface de nouveau) et Entrée applique.

import { useState, type KeyboardEvent } from "react";
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

/** Pastilles effacées au clavier ou par leur croix : de quoi les remettre (Ctrl + Z) puis les effacer
 *  de nouveau (Ctrl + Y), comme du texte. */
type Undo<T> = { undo: { item: T; index: number }[]; redo: { item: T; index: number }[] };
const EMPTY_UNDO = { undo: [], redo: [] };

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
  const [addUndo, setAddUndo] = useState<Undo<Chip>>(EMPTY_UNDO);
  const [removeUndo, setRemoveUndo] = useState<Undo<TagInfo>>(EMPTY_UNDO);
  // Tags de la sélection, lus quand on se sert du champ « Retirer ».
  const { data: present = [] } = useQuery({
    queryKey: ["selection-tags", version],
    queryFn: () => api.selectionTags(selectedIds()),
    enabled: active && removing && count > 0,
  });
  if (!active) return null;

  const addChip = (chip: Chip) => setToAdd((list) => (list.some((c) => c.name === chip.name) ? list : [...list, chip]));
  const removeChip = (tag: TagInfo) => setToRemove((list) => (list.some((t) => t.id === tag.id) ? list : [...list, tag]));
  const dropAdd = (index: number) => {
    setAddUndo((h) => ({ undo: [...h.undo, { item: toAdd[index], index }], redo: [] }));
    setToAdd((list) => list.filter((_, i) => i !== index));
  };
  const dropRemove = (index: number) => {
    setRemoveUndo((h) => ({ undo: [...h.undo, { item: toRemove[index], index }], redo: [] }));
    setToRemove((list) => list.filter((_, i) => i !== index));
  };

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
      setAddUndo(EMPTY_UNDO);
      setRemoveUndo(EMPTY_UNDO);
      await refreshLibrary();
      void queryClient.invalidateQueries({ queryKey: ["media-detail"] });
      void queryClient.invalidateQueries({ queryKey: ["selection-tags"] });
    } catch (error) {
      useViewer.getState().setError({ action: "Modifier les tags de la sélection", code: null, message: String(error) });
    } finally {
      setBusy(false);
    }
  };

  const canApply = !busy && count > 0 && (toAdd.length > 0 || toRemove.length > 0);
  /** Touches d'un champ vide de la barre (celles d'un champ qui contient du texte lui appartiennent). */
  function fieldKeys<T>(e: KeyboardEvent, text: string, list: T[], drop: (index: number) => void, history: Undo<T>, setHistory: (h: Undo<T>) => void, setList: (fn: (l: T[]) => T[]) => void) {
    if (text !== "" || e.altKey) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (e.key === "Enter" && !ctrl && !e.shiftKey) {
      if (canApply) void apply();
    } else if (e.key === "Backspace" && !ctrl && list.length > 0) {
      e.preventDefault();
      drop(list.length - 1);
    } else if (ctrl && !e.shiftKey && key === "z" && history.undo.length > 0) {
      e.preventDefault();
      const last = history.undo[history.undo.length - 1];
      setList((l) => [...l.slice(0, last.index), last.item, ...l.slice(last.index)]);
      setHistory({ undo: history.undo.slice(0, -1), redo: [...history.redo, last] });
    } else if (ctrl && (key === "y" || (e.shiftKey && key === "z")) && history.redo.length > 0) {
      e.preventDefault();
      const last = history.redo[history.redo.length - 1];
      setList((l) => l.filter((_, i) => i !== last.index));
      setHistory({ undo: [...history.undo, last], redo: history.redo.slice(0, -1) });
    }
  }

  return (
    <div data-zone="selection.barre" className="sticky bottom-4 z-30 mt-4 flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 shadow-xl">
      <span data-zone="selection.barre.compteur" className="shrink-0 select-text text-sm font-semibold text-foreground tabular-nums">
        {formatNumber(count)} {plural(count, "sélectionné")}
      </span>
      <div
        data-zone="selection.barre.ajouter"
        className={FIELD}
        onKeyDown={(e) => fieldKeys(e, addText, toAdd, dropAdd, addUndo, setAddUndo, setToAdd)}
      >
        {toAdd.map((chip, i) => (
          <TagPill
            key={chip.name}
            color={color(chip.categoryId)}
            onRemove={() => dropAdd(i)}
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
      <div
        data-zone="selection.barre.retirer"
        className={FIELD}
        onFocus={() => setRemoving(true)}
        onBlur={() => setRemoving(false)}
        onKeyDown={(e) => fieldKeys(e, removeText, toRemove, dropRemove, removeUndo, setRemoveUndo, setToRemove)}
      >
        {toRemove.map((tag, i) => (
          <TagPill
            key={tag.id}
            color={color(tag.categoryId)}
            onRemove={() => dropRemove(i)}
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
          inputRef={(el) => {
            removerInput = el;
          }}
        />
      </div>
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
          if (toCreate) addChip({ name: toCreate, categoryId });
          setToCreate(null);
        }}
      />
    </div>
  );
}
