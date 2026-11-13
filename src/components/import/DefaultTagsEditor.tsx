// Tags par défaut de l'import (IMP-30, IMP-31) : une barre complète, sans choix de catégorie, qui cherche parmi les tags
// existants (IMP-79) → Entrée ou « Ajouter » → badge coloré sous le champ. Les espaces deviennent des « _ ». Un tag qui
// n'existe pas encore ouvre la pop-in de création (choix de sa catégorie), comme dans la visionneuse ; une fois créé,
// il rejoint aussitôt les tags par défaut (réponse Q3 A du 13/11). Il est écrit dans la base au départ de l'import,
// comme avant : l'annuler ne laisse aucun tag vide.
// Ces tags sont ajoutés à TOUS les fichiers de l'import, y compris ceux déjà dans la
// bibliothèque (D-016). En phase 2, la carte est placée sous l'encadré de dépôt.
// Clic droit sur une pastille : « Copier le tag », « Retirer » (CTX-15).

import { useState } from "react";
import { Plus, Tag } from "lucide-react";

import { CreateTagDialog } from "@/components/tags/CreateTagDialog";
import { TagInput } from "@/components/tags/TagInput";
import { TagPill } from "@/components/tags/TagPill";
import { useCategories } from "@/hooks/useCategories";
import { api } from "@/lib/api";
import { openContextMenu } from "@/lib/contextMenu";
import { displayTag, normalizeTag } from "@/lib/tags";
import { useImport } from "@/stores/import";

export function DefaultTagsEditor() {
  const tags = useImport((s) => s.defaultTags);
  const addDefaultTag = useImport((s) => s.addDefaultTag);
  const removeDefaultTag = useImport((s) => s.removeDefaultTag);
  const busy = useImport((s) => s.snapshot?.phase === "importing");
  const { color } = useCategories();
  const [text, setText] = useState("");
  const [toCreate, setToCreate] = useState<string | null>(null);

  /** Texte tapé : un tag qui existe est ajouté avec sa catégorie, sinon la pop-in de création s'ouvre. Un tag déjà dans
   *  la liste (créé plus tôt par la pop-in, pas encore dans la base) n'est pas redemandé. */
  const submit = async (raw: string) => {
    const name = normalizeTag(raw);
    if (!name) return;
    setText("");
    if (tags.some((t) => t.name === name)) return;
    const existing = await api.findTag(name);
    if (existing) addDefaultTag({ name, categoryId: existing.categoryId });
    else setToCreate(name);
  };

  /** Tag restauré de la corbeille par la pop-in (TAGM-19) : il garde sa catégorie d'origine. */
  const addRestored = async (name: string) => {
    const restored = await api.findTag(name);
    addDefaultTag({ name, categoryId: restored?.categoryId ?? null });
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
          dropdown="top"
          value={text}
          onChange={setText}
          onSubmit={(raw) => void submit(raw)}
          onPick={(tag) => {
            setText("");
            addDefaultTag({ name: tag.name, categoryId: tag.categoryId });
          }}
          taken={(tag) => (tags.some((t) => t.name === tag.name) ? "Ce tag est déjà dans les tags par défaut" : null)}
          placeholder="ex. red_hair, vacances, demo…"
          className="h-[38px] min-w-60 flex-1"
        />
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
        Les espaces sont normalisés en _. Un tag qui n'existe pas encore ouvre la fenêtre de création, pour choisir sa
        catégorie. Ces tags sont ajoutés à tous les fichiers de l'import, y compris ceux déjà présents dans la bibliothèque.
      </p>
      {tags.length > 0 && (
        <div data-zone="import.tags-defaut.badges" className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <TagPill
              key={t.name}
              color={color(t.categoryId ?? -1)}
              onRemove={busy ? undefined : () => removeDefaultTag(t.name)}
              removeLabel={`Retirer « ${displayTag(t.name)} »`}
              // Clic droit (CTX-15, choix du 09/11) : ces tags ne sont pas encore posés sur des médias.
              onContextMenu={(e) =>
                openContextMenu(e, () => [
                  { label: "Copier le tag", run: () => void api.writeClipboardText(t.name) },
                  { label: "Retirer", disabled: busy, run: () => removeDefaultTag(t.name) },
                ])
              }
            >
              {displayTag(t.name)}
            </TagPill>
          ))}
        </div>
      )}
      <CreateTagDialog
        name={toCreate}
        onCancel={() => setToCreate(null)}
        onCreate={(categoryId, name) => {
          setToCreate(null);
          addDefaultTag({ name, categoryId });
        }}
        onRestored={(name) => {
          setToCreate(null);
          void addRestored(name);
        }}
      />
    </section>
  );
}
