// Ajout d'un synonyme ou d'une règle de parent : un ou deux champs à suggestions (« synonyme → tag »,
// « enfant → parent »), Entrée ou « Créer » (retour T3, point TAGM-16.5). Un tag tapé qui n'existe pas encore passe par la pop-in
// « Créer un nouveau tag » (choix de la catégorie) ; un synonyme tapé donne son tag principal. Le refus
// éventuel (nom pris, boucle…) s'affiche sous les champs.

import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { CreateTagDialog } from "@/components/tags/CreateTagDialog";
import { TagInput } from "@/components/tags/TagInput";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { rulesApi } from "@/lib/rulesApi";
import { runTagAction } from "@/lib/tagManager";
import { normalizeTag } from "@/lib/tags";
import { cn } from "@/lib/utils";

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

// Même hauteur que les champs à pastilles du formulaire des synonymes, à côté (retour T3, point TAGM-15.5).
const FIELD = "h-9 min-w-0 flex-1";
const INPUT = "font-mono text-xs";

type Props = {
  zone: string;
  placeholders: [string, string];
  /** Les deux textes tapés ; renvoie le refus à afficher, `null` (champs vidés) ou `false` (annulé : les
   *  champs gardent leur texte, retour T3, point TAGM-16.2). */
  onAdd: (left: string, right: string) => Promise<string | null | false>;
  className?: string;
};

/** Deux champs « gauche → droite » et « Créer ». */
export function RuleForm({ zone, placeholders, onAdd, className }: Props) {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = normalizeTag(left) !== "" && normalizeTag(right) !== "";
  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    const refused = await onAdd(left, right).finally(() => setBusy(false));
    setError(refused || null);
    if (refused === null) {
      setLeft("");
      setRight("");
    }
  };
  // Chaque champ grise le tag déjà tapé dans l'autre (SRCH-29).
  const field = (value: string, set: (v: string) => void, placeholder: string, part: string, other: string) => (
    <TagInput
      zone={`${zone}.${part}`}
      value={value}
      taken={(tag) => (tag.name === normalizeTag(other) ? "Ce tag est déjà dans l'autre champ" : null)}
      onChange={(v) => {
        set(v);
        setError(null);
      }}
      onSubmit={() => void submit()}
      onPick={(tag) => set(tag.name)}
      placeholder={placeholder}
      className={FIELD}
      inputClassName={INPUT}
    />
  );
  return (
    <div data-zone={zone} className={className}>
      <div className="flex items-center gap-1.5">
        {field(left, setLeft, placeholders[0], "gauche", right)}
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {field(right, setRight, placeholders[1], "droite", left)}
        <Button
          data-zone={`${zone}.ajouter`}
          size="sm"
          disabled={!ready || busy}
          onClick={() => void submit()}
          className={cn("h-9 bg-[#d9a94e] text-xs text-[#1a1408] hover:bg-[#e3b75f] disabled:hover:bg-[#d9a94e]")}
        >
          Créer
        </Button>
      </div>
      {error && <p data-zone={`${zone}.refus`} className="mt-1.5 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
