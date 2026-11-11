// Ligne d'une option de la carte « Options d'import » (IMP-30) : case, icône, nom, « ⓘ » (les textes explicatifs de
// chaque option sont dans son « ⓘ », demande du 10/11). Grisée, le nom l'est aussi (demande du 10/11, IMP-28).

import type { ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { InfoTip } from "@/components/ui/info-tip";
import { keepQuoted } from "@/lib/keepWords";
import { cn } from "@/lib/utils";

type Props = { zone: string; checked: boolean; disabled: boolean; onChange: (on: boolean) => void; icon: ReactNode; label: string; info: string[] };

const NEVER_CHANGED = " ; l'original n'est jamais modifié";
/** « ; l'original n'est jamais modifié » retiré quand « Supprimer les originaux » est cochée (IMP-71, 11/11). */
export const withOriginals = (lines: string[], deleteOriginals: boolean) =>
  deleteOriginals ? lines.map((line) => line.replace(NEVER_CHANGED, "")) : lines;

export function OptionRow(props: Props) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex cursor-pointer items-center gap-3 has-disabled:cursor-not-allowed">
        <Checkbox checked={props.checked} disabled={props.disabled} onCheckedChange={(c) => props.onChange(c === true)} />
        <span className={cn("flex items-center gap-2 text-sm font-medium text-foreground", props.disabled && "opacity-50")}>
          {props.icon}
          {props.label}
        </span>
      </label>
      <InfoTip zone={`${props.zone}.info`}>
        {props.info.map((text) => (
          <span key={text} className="block">
            {keepQuoted(text)}
          </span>
        ))}
      </InfoTip>
    </div>
  );
}
