// Tags par défaut de l'import (IMP-30, IMP-31) : une barre complète, sans choix de catégorie, qui cherche parmi les tags
// existants (IMP-79). La frappe suit la recherche de la bibliothèque (retour du 13/11) : plusieurs tags séparés par des
// espaces (« _ » dans un nom), suggestions sur le mot en cours, une suggestion choisie s'écrit à la place du mot ; les
// mots déjà tapés et les tags déjà dans la liste sont grisés dans les suggestions. Entrée ou « Ajouter » : chaque tag
// existant devient une pastille ; un nom fusionné montre son principal, mais part au cœur tel que tapé (la défusion
// rendra ce nom, D-047 ; retour du 13/11) ; chaque tag inexistant ouvre, l'un après l'autre,
// la pop-in de création (choix de sa catégorie) puis rejoint aussitôt la liste (réponse Q3 A du 13/11) ; un nom annulé
// revient dans le champ. Le tag est écrit dans la base au départ de l'import, comme avant : l'annuler ne laisse aucun
// tag vide. « Tout effacer » vide la liste, comme « Tout vider » celle des fichiers ; toujours affiché, grisé sans
// pastille ou pendant l'import (retour du 13/11).
// Ces tags sont ajoutés à TOUS les fichiers de l'import, y compris ceux déjà dans la
// bibliothèque (D-016). En phase 2, la carte est placée sous l'encadré de dépôt.
// Clic droit sur une pastille : « Copier le tag », « Retirer » (CTX-15).

import { useRef, useState } from "react";
import { Plus, Tag, Trash2 } from "lucide-react";

import { CreateTagDialog } from "@/components/tags/CreateTagDialog";
import { TagInput } from "@/components/tags/TagInput";
import { TagPill } from "@/components/tags/TagPill";
import { useCategories } from "@/hooks/useCategories";
import { api } from "@/lib/api";
import { openContextMenu } from "@/lib/contextMenu";
import { displayTag, normalizeTag } from "@/lib/tags";
import { shownName, useImport } from "@/stores/import";

export function DefaultTagsEditor() {
  const tags = useImport((s) => s.defaultTags);
  const addDefaultTag = useImport((s) => s.addDefaultTag);
  const removeDefaultTag = useImport((s) => s.removeDefaultTag);
  const clearDefaultTags = useImport((s) => s.clearDefaultTags);
  const busy = useImport((s) => s.snapshot?.phase === "importing");
  const { color } = useCategories();
  const [text, setText] = useState("");
  /** Noms à créer, l'un après l'autre (le premier est dans la pop-in). */
  const [queue, setQueue] = useState<string[]>([]);
  /** Noms dont la création a été annulée : remis dans le champ à la fin de la file. */
  const cancelled = useRef<string[]>([]);

  /** Texte validé : chaque tag existant est ajouté avec sa catégorie, les autres passent par la pop-in. Un tag déjà dans
   *  la liste (créé plus tôt par la pop-in, pas encore dans la base) n'est pas redemandé. */
  const submit = async (raw: string) => {
    const names = [...new Set(raw.split(/\s+/).map(normalizeTag).filter(Boolean))];
    if (names.length === 0 || queue.length > 0) return;
    setText("");
    const unknown: string[] = [];
    for (const name of names) {
      if (tags.some((t) => t.name === name || shownName(t) === name)) continue;
      const found = await api.findTag(name);
      // Nom fusionné : `found` est son principal ; le nom tapé part au cœur, le principal se montre.
      if (found) addDefaultTag({ name, categoryId: found.categoryId, shown: found.name });
      else unknown.push(name);
    }
    cancelled.current = [];
    setQueue(unknown);
  };

  /** Pop-in suivante ; `skipped` : nom annulé. */
  const next = (skipped: string | null) => {
    if (skipped) cancelled.current.push(skipped);
    const rest = queue.slice(1);
    setQueue(rest);
    if (rest.length === 0 && cancelled.current.length > 0) {
      setText(`${cancelled.current.join(" ")} `);
      cancelled.current = [];
    }
  };

  /** Tag restauré de la corbeille par la pop-in (TAGM-19) : il garde sa catégorie d'origine. */
  const addRestored = async (name: string) => {
    const restored = await api.findTag(name);
    addDefaultTag({ name, categoryId: restored?.categoryId ?? null });
  };

  return (
    <section data-zone="import.tags-defaut" className="rounded-xl border border-border bg-card/60 p-6">
      <div className="mb-4 flex min-h-7 items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
          <Tag className="h-4 w-4 text-[#d9a94e]" />
          Tags par défaut
        </h2>
        <button
          type="button"
          data-zone="import.tags-defaut.vider"
          disabled={tags.length === 0 || busy}
          onClick={clearDefaultTags}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition enabled:hover:bg-secondary enabled:hover:text-foreground disabled:text-muted-foreground/40"
        >
          <Trash2 className="h-4 w-4" />
          Tout effacer
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <TagInput
          zone="import.tags-defaut.champ"
          multi
          dropdown="top"
          value={text}
          onChange={setText}
          onSubmit={(raw) => void submit(raw)}
          taken={(tag) => (tags.some((t) => t.name === tag.name || shownName(t) === tag.name) ? "Ce tag est déjà dans les tags par défaut" : null)}
          placeholder="ex. red_hair vacances demo…"
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
        Un tag qui n'existe pas encore ouvre le menu de création. Les espaces sont des "_". Ces tags sont ajoutés à tous les
        fichiers de l'import, y compris s'ils sont déjà dans la bibliothèque
      </p>
      {tags.length > 0 && (
        <div data-zone="import.tags-defaut.badges" className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <TagPill
              key={t.name}
              color={color(t.categoryId ?? -1)}
              onRemove={busy ? undefined : () => removeDefaultTag(t.name)}
              removeLabel={`Retirer « ${displayTag(shownName(t))} »`}
              // Clic droit (CTX-15, choix du 09/11) : ces tags ne sont pas encore posés sur des médias.
              onContextMenu={(e) =>
                openContextMenu(e, () => [
                  { label: "Copier le tag", run: () => void api.writeClipboardText(shownName(t)) },
                  { label: "Retirer", disabled: busy, run: () => removeDefaultTag(t.name) },
                ])
              }
            >
              {displayTag(shownName(t))}
            </TagPill>
          ))}
        </div>
      )}
      <CreateTagDialog
        name={queue[0] ?? null}
        onCancel={() => next(queue[0] ?? null)}
        onCreate={(categoryId, name) => {
          addDefaultTag({ name, categoryId });
          next(null);
        }}
        onRestored={(name) => {
          void addRestored(name);
          next(null);
        }}
      />
    </section>
  );
}
