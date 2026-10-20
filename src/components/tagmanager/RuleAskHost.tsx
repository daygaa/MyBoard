// Pop-in de confirmation des actions sur les synonymes et les règles de parents (lib/tagRules.ts),
// avec sa case à cocher éventuelle (ajout proposé aux médias qui ont reçu l'enfant entre-temps,
// TAGM-16), cochée à chaque ouverture.

import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useRuleAsk, type RuleAsk } from "@/lib/tagRules";

function Ask({ ask }: { ask: RuleAsk }) {
  const [option, setOption] = useState(true);
  const close = () => useRuleAsk.setState({ ask: null });
  return (
    <ConfirmDialog
      zone="regle-confirmation"
      title={ask.title}
      message={ask.message}
      danger={ask.danger}
      confirmLabel={ask.confirmLabel}
      onCancel={close}
      onConfirm={() => {
        close();
        void ask.run(option);
      }}
    >
      {ask.option && (
        <label data-zone="regle-confirmation.option" className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <Checkbox checked={option} onCheckedChange={(c) => setOption(c === true)} />
          {ask.option}
        </label>
      )}
    </ConfirmDialog>
  );
}

export function RuleAskHost() {
  const ask = useRuleAsk((s) => s.ask);
  return ask ? <Ask ask={ask} /> : null;
}
