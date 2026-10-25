// Onglets du gestionnaire de tags (TAGM-04.1, TAGM-15.2) : sur toute la largeur de la fenêtre, juste sous
// l'en-tête ; l'actif en doré souligné.

import { openTagTab, useTagTab } from "@/lib/router";
import { cn } from "@/lib/utils";

/** Onglets du gestionnaire (« Synonymes et parents » : TAGM-15, TAGM-16) : chacun la même part de la
 *  largeur (moitié, puis tiers avec un 3e onglet), comme ceux d'un moteur de recherche. */
const TABS = [
  { key: "tags", label: "Tags", zone: "tags" },
  { key: "rules", label: "Synonymes et parents", zone: "regles" },
] as const;

export function Tabs() {
  const tab = useTagTab();
  return (
    <div data-zone="gestionnaire-tags.onglets" role="tablist" className="flex border-b border-border bg-card/40">
      {TABS.map(({ key, label, zone }) => (
        <button
          key={key}
          type="button"
          role="tab"
          data-zone={`gestionnaire-tags.onglet-${zone}`}
          aria-selected={tab === key}
          onClick={() => openTagTab(key)}
          className={cn(
            "-mb-px h-10 flex-1 border-b-2 text-sm font-medium transition",
            tab === key ? "border-[#d9a94e] text-[#d9a94e]" : "border-transparent text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
