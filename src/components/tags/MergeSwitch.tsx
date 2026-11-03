// Interrupteur « Fusionner » des pop-ins « Créer un synonyme » du gestionnaire (tags cochés, renommage vers un tag
// existant ; refonte, décisions D7, D8, D8.1, lot R6-1) : éteint d'office, allumé si les tags rejoignent un groupe
// entièrement fusionné (D2.2). Il remplace la case « Garder les anciens noms » (TAGM-17) : une fusion se défait
// toujours (onglet « Synonymes et parents »).

import { Switch } from "@/components/ui/switch";

export function MergeSwitch({ on, onChange, zone }: { on: boolean; onChange: (on: boolean) => void; zone: string }) {
  // Mêmes bulles que l'interrupteur du formulaire des synonymes (retouches de R3).
  const title = on ? "Les tags ajoutés seront fusionnés dans le tag principal" : "Les tags ajoutés seront seulement reliés au tag principal";
  return (
    <label data-zone={zone} title={title} className="flex w-fit cursor-pointer items-center gap-2 text-sm text-foreground">
      <Switch on={on} onToggle={() => onChange(!on)} zone={`${zone}.interrupteur`} label="Fusionner" />
      Fusionner
    </label>
  );
}
