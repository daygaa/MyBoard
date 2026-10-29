// Pop-in de confirmation des actions sur les synonymes et les règles de parents (lib/tagRules.ts),
// avec sa case à cocher éventuelle (ajout du parent aux médias qui ont déjà l'enfant, refonte D10.1),
// cochée à chaque ouverture. La réponse (confirmée ou annulée) revient à l'appelant : un formulaire ne se
// vide qu'à la confirmation (retour T3, point TAGM-16.2). Un tag cité n'est jamais coupé en fin de ligne,
// sauf s'il est plus long qu'une ligne (retour T3, point TAGM-16.3).

import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { copyPlain, useRuleAsk, type RuleAsk } from "@/lib/tagRules";

function Ask({ ask }: { ask: RuleAsk }) {
  const [option, setOption] = useState(true);
  const answer = (confirmed: boolean) => {
    useRuleAsk.setState({ ask: null });
    if (confirmed) void ask.run(option);
    ask.done?.(confirmed);
  };
  return (
    <ConfirmDialog
      zone="regle-confirmation"
      title={ask.title}
      // La règle « X → Y » reste en place sous le titre quand le texte défile (pop-in limitée en hauteur).
      subtitle={ask.lead && <p onCopy={copyPlain} className="text-[15px] text-foreground [overflow-wrap:break-word]">{ask.lead}</p>}
      message={
        <p onCopy={copyPlain} className="whitespace-pre-line [overflow-wrap:break-word]">
          {ask.message}
        </p>
      }
      danger={ask.danger}
      confirmLabel={ask.confirmLabel}
      onCancel={() => answer(false)}
      onConfirm={() => answer(true)}
    >
      {ask.option && (
        <label data-zone="regle-confirmation.option" onCopy={copyPlain} className="flex cursor-pointer items-center gap-2 text-sm text-foreground [overflow-wrap:break-word]">
          <Checkbox data-principale checked={option} onCheckedChange={(c) => setOption(c === true)} />
          <span className="min-w-0">{ask.option}</span>
        </label>
      )}
    </ConfirmDialog>
  );
}

export function RuleAskHost() {
  const ask = useRuleAsk((s) => s.ask);
  return ask ? <Ask ask={ask} /> : null;
}
