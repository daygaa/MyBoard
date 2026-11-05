// Bouton « Créer un tag » du gestionnaire (retour T3, point TAGM-04.8), le premier de l'en-tête de la page :
// pop-in « Créer un nouveau tag » où l'on tape le nom et choisit la catégorie. Un nom déjà pris (tag, ou
// synonyme actif : il désigne déjà un tag) est refusé ; une fois créé, le tag est montré par le filtre.

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { CreateTagDialog } from "@/components/tags/CreateTagDialog";
import { Button } from "@/components/ui/button";
import type { RulesIndex } from "@/hooks/useTagRules";
import type { ManagedTag } from "@/lib/api";
import { rulesApi } from "@/lib/rulesApi";
import { runTagAction } from "@/lib/tagManager";
import { displayTag } from "@/lib/tags";
import type { TagOf } from "./RuleLines";

type Props = { tags: ManagedTag[]; rules: RulesIndex; tagOf: TagOf; onCreated: (name: string, restored?: boolean) => void };

export function NewTagButton({ tags, rules, tagOf, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const names = useMemo(() => new Set(tags.map((t) => t.name)), [tags]);
  const refusal = (name: string) => {
    if (names.has(name)) return "Ce tag existe déjà";
    // Nom fusionné dans un groupe (ce n'est plus un tag) : refusé (détail validé le 27/10).
    const group = rules.mergedNames.get(name);
    const target = group && tagOf(group.principalId);
    return target ? `« ${displayTag(name)} » est fusionné dans « ${displayTag(target.name)} »` : null;
  };
  return (
    <>
      <Button
        data-zone="gestionnaire-tags.creer"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-1.5 bg-[#d9a94e] text-xs text-[#1a1408] hover:bg-[#e3b75f]"
      >
        <Plus className="h-3.5 w-3.5" />
        Créer un tag
      </Button>
      <CreateTagDialog
        name={open ? "" : null}
        refusal={refusal}
        onCancel={() => setOpen(false)}
        onCreate={(categoryId, name) => {
          setOpen(false);
          void runTagAction("Créer le tag", () => rulesApi.createTag(name, categoryId)).then((id) => id !== undefined && onCreated(name));
        }}
        // Nom restauré depuis la corbeille (TAGM-19) : montré par le filtre, comme un tag créé (badge « restauré »).
        onRestored={(name) => {
          setOpen(false);
          onCreated(name, true);
        }}
      />
    </>
  );
}
