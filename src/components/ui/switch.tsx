// Interrupteur marche / arrêt (refonte : règles de parents, D10 ; synonymes ensuite, retour T3, point
// TAGM-15.4) : rail et pastille dorés quand il est allumé, gris quand il est éteint. Bouton natif : Espace et
// Entrée l'actionnent au clavier.

import { cn } from "@/lib/utils";

type Props = {
  on: boolean;
  onToggle: () => void;
  /** Nom lu par les lecteurs d'écran. */
  label: string;
  title?: string;
  zone?: string;
  disabled?: boolean;
};

export function Switch({ on, onToggle, label, title, zone, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={title}
      data-zone={zone}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative h-4 w-7 shrink-0 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50",
        on ? "border-[#d9a94e] bg-[#d9a94e]/30" : "border-[#70737d] bg-transparent",
      )}
    >
      <span className={cn("absolute top-0.5 h-2.5 w-2.5 rounded-full transition-all", on ? "left-3.5 bg-[#d9a94e]" : "left-0.5 bg-[#70737d]")} />
    </button>
  );
}
