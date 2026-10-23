// Case « Garder les anciens noms comme synonymes » des pop-ins de fusion (TAGM-17), cochée par défaut :
// taper un ancien nom donnera le tag gardé, et décocher son synonyme (gestionnaire de tags, onglet
// « Synonymes et parents ») défera la fusion (GEN-21).

import { Checkbox } from "@/components/ui/checkbox";

export function KeepAliasesBox({ checked, onChange }: { checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label
      data-zone="fusion.synonymes"
      title="Taper un ancien nom donnera le tag gardé. Décocher son synonyme (Gestionnaire de tags › Synonymes et parents) défera la fusion."
      className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
    >
      {/* Case principale de la pop-in : Espace la coche (GEN-20.2). */}
      <Checkbox data-principale checked={checked} onCheckedChange={(c) => onChange(c === true)} />
      Garder les anciens noms comme synonymes
    </label>
  );
}
