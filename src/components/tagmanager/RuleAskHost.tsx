// Pop-in de confirmation des actions sur les synonymes et les règles de parents (lib/tagRules.ts),
// avec sa case à cocher éventuelle (ajout du parent aux médias qui ont déjà l'enfant, refonte D10.1),
// cochée à chaque ouverture. La réponse (confirmée ou annulée) revient à l'appelant : un formulaire ne se
// vide qu'à la confirmation (retour T3, point TAGM-16.2). Un tag cité n'est jamais coupé en fin de ligne,
// sauf s'il est plus long qu'une ligne (retour T3, point TAGM-16.3). Tags cités en couleur (GEN-32, TagText).

import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatNumber } from "@/lib/format";
import { tagNode, tagText, TagText } from "@/components/tags/TagText";
import { copyPlain } from "@/lib/keepWords";
import { rememberChecks } from "@/lib/mergeRules";
import { useRuleAsk, type AskRules, type RuleAsk } from "@/lib/tagRules";

/** Lignes de règles montrées au plus ; les suivantes sont comptées. */
const MAX_RULES = 10;

/** Règles de parents touchées par une fusion (réponse 3 du lot R5), sous un trait comme dans la pop-in de
 *  suppression d'un tag ; sous une ligne, sa case « Appliquer » (D11.3, TAGM-27), cochée à l'ouverture sauf si
 *  l'utilisateur l'a décochée la dernière fois (retenu par la bibliothèque), avec sa bulle Windows (case et texte). */
function RulesBlock({ rules, checked, onCheck }: { rules: AskRules; checked: number[]; onCheck: (id: number, on: boolean) => void }) {
  const more = rules.lines.length - MAX_RULES;
  return (
    <div data-zone="regle-confirmation.regles" onCopy={copyPlain} className="select-text space-y-1 border-t border-border pt-3 text-sm text-muted-foreground [overflow-wrap:break-word]">
      <p>Règles de parents :</p>
      {rules.lines.slice(0, MAX_RULES).map((line) => {
        const on = checked.includes(line.id);
        return (
          <div key={line.id}>
            <p>{tagNode(on && line.option?.text ? line.option.text : line.text)}</p>
            {line.option && (
              <label data-zone="regle-confirmation.etendre" title={line.option.title} className="mt-1 mb-1.5 ml-4 flex cursor-pointer items-center gap-2 text-foreground">
                <Checkbox checked={on} onCheckedChange={(c) => onCheck(line.id, c === true)} />
                <span className="min-w-0">{tagNode(line.option.label)}</span>
              </label>
            )}
          </div>
        );
      })}
      {more > 0 && <p>… et {formatNumber(more)} autres règles.</p>}
      {rules.end && <p className="pt-2">{tagNode(rules.end)}</p>}
    </div>
  );
}

function Ask({ ask }: { ask: RuleAsk }) {
  const [option, setOption] = useState(true);
  const [extend, setExtend] = useState<number[]>(() => ask.rules?.lines.filter((l) => l.option?.checked).map((l) => l.id) ?? []);
  const answer = (confirmed: boolean) => {
    useRuleAsk.setState({ ask: null });
    if (confirmed && ask.rules) void rememberChecks(ask.rules.lines.slice(0, MAX_RULES), extend);
    if (confirmed) void ask.run(option, extend);
    ask.done?.(confirmed);
  };
  return (
    <ConfirmDialog
      zone="regle-confirmation"
      title={ask.title}
      renderText={tagText}
      // La règle « X → Y » reste en place sous le titre quand le texte défile (pop-in limitée en hauteur).
      subtitle={ask.lead && <p onCopy={copyPlain} className="text-[15px] text-foreground [overflow-wrap:break-word]"><TagText text={ask.lead} /></p>}
      message={
        <p onCopy={copyPlain} className="whitespace-pre-line [overflow-wrap:break-word]">
          <TagText text={ask.message} />
        </p>
      }
      danger={ask.danger}
      confirmLabel={ask.confirmLabel}
      cancelLabel={ask.cancelLabel}
      onCancel={() => answer(false)}
      onConfirm={() => answer(true)}
    >
      {ask.rules && ask.rules.lines.length > 0 && (
        <RulesBlock rules={ask.rules} checked={extend} onCheck={(id, on) => setExtend((ids) => (on ? [...ids, id] : ids.filter((i) => i !== id)))} />
      )}
      {ask.option && (
        <label data-zone="regle-confirmation.option" onCopy={copyPlain} className="flex cursor-pointer items-center gap-2 text-sm text-foreground [overflow-wrap:break-word]">
          <Checkbox data-principale checked={option} onCheckedChange={(c) => setOption(c === true)} />
          <span className="min-w-0">{tagNode(ask.option)}</span>
        </label>
      )}
    </ConfirmDialog>
  );
}

export function RuleAskHost() {
  const ask = useRuleAsk((s) => s.ask);
  return ask ? <Ask ask={ask} /> : null;
}
