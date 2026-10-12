// Tags dans la visionneuse : champ d'ajout avec autocomplétion ouverte AU-DESSUS (VIEW-21),
// pop-in de création si le tag n'existe pas (VIEW-22), pastilles colorées retirables ; un clic
// sur une pastille lance la recherche de ce tag (VIEW-23).

import { useState } from "react";
import { Plus } from "lucide-react";

import { CreateTagDialog } from "@/components/tags/CreateTagDialog";
import { TagInput } from "@/components/tags/TagInput";
import { TagPill } from "@/components/tags/TagPill";
import { useCategories } from "@/hooks/useCategories";
import { useTagChanges } from "@/hooks/useTagChanges";
import { api, type TagInfo } from "@/lib/api";
import { displayTag, normalizeTag } from "@/lib/tags";

/** Champ d'ajout de tag (VIEW-20 : placé juste à droite des infos du fichier). */
export function TagAdder({ mediaId }: { mediaId: number }) {
  const [text, setText] = useState("");
  const [toCreate, setToCreate] = useState<string | null>(null);
  const { add } = useTagChanges();

  const submit = async (raw: string) => {
    const name = normalizeTag(raw);
    if (!name) return;
    setText("");
    if (await api.findTag(name)) await add(mediaId, { name, categoryId: null });
    else setToCreate(name);
  };

  return (
    <div className="flex items-center gap-1">
      <TagInput
        zone="visionneuse.ajout-tag"
        value={text}
        onChange={setText}
        onSubmit={(raw) => void submit(raw)}
        onPick={(tag) => {
          setText("");
          void add(mediaId, { name: tag.name, categoryId: null });
        }}
        dropdown="top"
        placeholder="Ajouter un tag…"
        className="h-8 w-56"
        inputClassName="rounded-md bg-secondary px-2 text-xs"
      />
      <button
        type="button"
        onClick={() => void submit(text)}
        disabled={!text.trim()}
        aria-label="Ajouter le tag"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-secondary text-muted-foreground transition hover:border-[#d9a94e]/50 hover:text-[#d9a94e] disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
      <CreateTagDialog
        name={toCreate}
        onCancel={() => setToCreate(null)}
        onCreate={(categoryId) => {
          const name = toCreate;
          setToCreate(null);
          if (name) void add(mediaId, { name, categoryId });
        }}
      />
    </div>
  );
}

/** Pastilles des tags du média, dans l'ordre des catégories (TAGM-03). */
export function TagPills({ mediaId, tags, onSearch }: { mediaId: number; tags: TagInfo[]; onSearch: (name: string) => void }) {
  const { list, color } = useCategories();
  const { remove } = useTagChanges();
  const order = new Map(list.map((c) => [c.id, c.sortOrder]));
  const sorted = [...tags].sort((a, b) => (order.get(a.categoryId) ?? 99) - (order.get(b.categoryId) ?? 99));

  if (sorted.length === 0) {
    return <span className="text-xs text-muted-foreground italic">Aucun tag. Utilise le champ ci-dessus pour en ajouter.</span>;
  }
  return (
    <>
      {sorted.map((tag) => (
        <TagPill
          key={tag.id}
          color={color(tag.categoryId)}
          title={`Rechercher « ${displayTag(tag.name)} »`}
          onClick={() => onSearch(tag.name)}
          onRemove={() => void remove(mediaId, tag.id)}
          removeLabel={`Retirer « ${displayTag(tag.name)} »`}
        >
          {displayTag(tag.name)}
        </TagPill>
      ))}
    </>
  );
}
