// Interrupteur marche / arrêt (refonte : règles de parents, D10 ; groupes de synonymes, D2.1 ; retour T3,
// point TAGM-15.4) : rail et pastille dorés quand il est allumé, gris quand il est éteint ; « à moitié »
// (`"mixed"`, comme une case à moitié cochée) : pastille au milieu, un trait dedans, doré pâle. Bouton natif :
// Espace et Entrée l'actionnent au clavier.

import { cn } from "@/lib/utils";

type Props = {
  on: boolean | "mixed";
  onToggle: () => void;
  /** Nom lu par les lecteurs d'écran. */
  label: string;
  title?: string;
  zone?: string;
  disabled?: boolean;
};

export function Switch({ on, onToggle, label, title, zone, disabled }: Props) {
  const mixed = on === "mixed";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={mixed ? "mixed" : on}
      aria-label={label}
      title={title}
      data-zone={zone}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative h-4 w-7 shrink-0 rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50",
        mixed ? "border-[#d9a94e]/60 bg-[#d9a94e]/10" : on ? "border-[#d9a94e] bg-[#d9a94e]/30" : "border-[#70737d] bg-transparent",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 grid h-2.5 w-2.5 place-items-center rounded-full transition-all",
          mixed ? "left-2 bg-[#d9a94e]/70" : on ? "left-3.5 bg-[#d9a94e]" : "left-0.5 bg-[#70737d]",
        )}
      >
        {mixed && <span className="h-px w-1.5 bg-[#1a1408]" />}
      </span>
    </button>
  );
}
