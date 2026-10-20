// Ajout d'un synonyme ou d'une règle de parent : un ou deux champs à suggestions (« synonyme → tag »,
// « enfant → parent »), Entrée ou « Ajouter ». Un tag tapé qui n'existe pas encore passe par la pop-in
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

export type Named = { id: number; name: string };

/** Tag désigné par un texte tapé : existant (ou tag principal d'un synonyme), sinon créé après la
 *  pop-in « Créer un nouveau tag » ; `null` si l'utilisateur annule. */
export function useTagResolver() {
  const [pending, setPending] = useState<{ name: string; done: (tag: Named | null) => void } | null>(null);
  const resolve = async (text: string): Promise<Named | null> => {
    const name = normalizeTag(text);
    if (!name) return null;
    const found = await api.findTag(name).catch(() => null);
    if (found) return { id: found.id, name: found.name };
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

const FIELD = "h-8 min-w-0 flex-1";
const INPUT = "font-mono text-xs";

type Props = {
  zone: string;
  placeholders: [string, string];
  /** Les deux textes tapés ; renvoie le refus à afficher, ou `null` (champs vidés). */
  onAdd: (left: string, right: string) => Promise<string | null>;
  className?: string;
};

/** Deux champs « gauche → droite » et « Ajouter ». */
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
    setError(refused);
    if (refused === null) {
      setLeft("");
      setRight("");
    }
  };
  const field = (value: string, set: (v: string) => void, placeholder: string, part: string) => (
    <TagInput
      zone={`${zone}.${part}`}
      value={value}
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
        {field(left, setLeft, placeholders[0], "gauche")}
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        {field(right, setRight, placeholders[1], "droite")}
        <Button
          data-zone={`${zone}.ajouter`}
          size="sm"
          disabled={!ready || busy}
          onClick={() => void submit()}
          className={cn("h-8 bg-[#d9a94e] text-xs text-[#1a1408] hover:bg-[#e3b75f] disabled:hover:bg-[#d9a94e]")}
        >
          Ajouter
        </Button>
      </div>
      {error && <p data-zone={`${zone}.refus`} className="mt-1.5 text-xs text-rose-300">{error}</p>}
    </div>
  );
}
