// Tags par défaut de l'import (IMP-30, IMP-31), apparence v8 : [champ] → [catégorie à droite]
// → Entrée ou « Ajouter » → badge coloré sous le champ. Les espaces deviennent des « _ » ;
// un tag existant (choisi dans les suggestions ou tapé en entier) garde sa catégorie.
// Ces tags sont ajoutés à TOUS les fichiers de l'import, y compris ceux déjà dans la
// bibliothèque (D-016). En phase 2, la carte est placée sous l'encadré de dépôt.

import { useState } from "react";
import { Plus, Tag } from "lucide-react";

import { CategorySelect, useDefaultCategory } from "@/components/tags/CategorySelect";
import { TagInput } from "@/components/tags/TagInput";
import { TagPill } from "@/components/tags/TagPill";
import { useCategories } from "@/hooks/useCategories";
import { api } from "@/lib/api";
import { displayTag, normalizeTag } from "@/lib/tags";
import { useImport } from "@/stores/import";

export function DefaultTagsEditor() {
  const tags = useImport((s) => s.defaultTags);
  const addDefaultTag = useImport((s) => s.addDefaultTag);
  const removeDefaultTag = useImport((s) => s.removeDefaultTag);
  const busy = useImport((s) => s.snapshot?.phase === "importing");
  const { color } = useCategories();
  const fallback = useDefaultCategory();
  const [chosen, setChosen] = useState<number | null>(null);
  const [text, setText] = useState("");
  const category = chosen ?? fallback;

  /** Texte tapé : un tag qui existe déjà garde sa catégorie, sinon celle du menu. */
  const submit = async (raw: string) => {
    const name = normalizeTag(raw);
    if (!name || category === null) return;
    setText("");
    const existing = await api.findTag(name);
    addDefaultTag({ name, categoryId: existing?.categoryId ?? category });
  };

  return (
    <section data-zone="import.tags-defaut" className="rounded-xl border border-border bg-card/60 p-6">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
        <Tag className="h-4 w-4 text-[#d9a94e]" />
        Tags par défaut
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        <TagInput
          zone="import.tags-defaut.champ"
          value={text}
          onChange={setText}
          onSubmit={(raw) => void submit(raw)}
          onPick={(tag) => {
            setText("");
            addDefaultTag({ name: tag.name, categoryId: tag.categoryId });
          }}
          placeholder="ex. red_hair, vacances, demo…"
          className="h-[38px] min-w-60 flex-1"
        />
        <CategorySelect zone="import.tags-defaut.categorie" value={category} onChange={setChosen} className="w-40" />
        <button
          type="button"
          data-zone="import.tags-defaut.ajouter"
          disabled={!text.trim() || busy}
          onClick={() => void submit(text)}
          className="flex h-[38px] items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-[#d9a94e] transition hover:bg-[#d9a94e]/10 disabled:cursor-not-allowed disabled:text-muted-foreground/60 disabled:hover:bg-transparent"
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Les espaces sont normalisés en _. Si un tag existe déjà en base, sa catégorie d'origine est conservée. Ces tags sont
        ajoutés à tous les fichiers de l'import, y compris ceux déjà présents dans la bibliothèque.
      </p>
      {tags.length > 0 && (
        <div data-zone="import.tags-defaut.badges" className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <TagPill
              key={t.name}
              color={color(t.categoryId ?? -1)}
              onRemove={busy ? undefined : () => removeDefaultTag(t.name)}
              removeLabel={`Retirer « ${displayTag(t.name)} »`}
            >
              {displayTag(t.name)}
            </TagPill>
          ))}
        </div>
      )}
    </section>
  );
}
