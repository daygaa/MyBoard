// Emplacements inaccessibles (LIB-14, réponse Q6 A du 11/11) : bandeau discret sous l'en-tête, une ligne par disque,
// clé ou dossier réseau débranché : « E:\ inaccessible : 12 médias ne peuvent pas être ouverts ». Il disparaît de
// lui-même quand l'emplacement revient (revérifié toutes les 5 s, réponse Q11 A) ; la croix le ferme pour la séance.

import { Unplug, X } from "lucide-react";

import { formatNumber, plural } from "@/lib/format";
import { useLibraryCheck } from "@/stores/libraryCheck";

export function OfflineBanner() {
  const offline = useLibraryCheck((s) => s.check.offline);
  const closed = useLibraryCheck((s) => s.closedRoots);
  const shown = offline.filter((o) => !closed.has(o.root));
  if (shown.length === 0) return null;
  return (
    <div data-zone="bandeau-inaccessible" className="flex items-start gap-3 border-b border-border bg-amber-500/5 px-4 py-2 text-xs text-amber-200/90 lg:px-6">
      <Unplug className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
      <div className="min-w-0 flex-1 select-text space-y-0.5">
        {shown.map((o) => (
          <p key={o.root}>
            <span className="font-medium">{o.root}</span> inaccessible : {formatNumber(o.count)}{" "}
            {plural(o.count, "média ne peut pas être ouvert", "médias ne peuvent pas être ouverts")}
          </p>
        ))}
      </div>
      <button
        type="button"
        data-zone="bandeau-inaccessible.fermer"
        aria-label="Fermer"
        onClick={() => useLibraryCheck.getState().closeBanner()}
        className="grid h-5 w-5 shrink-0 place-items-center rounded text-amber-200/70 hover:bg-amber-500/10 hover:text-amber-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
