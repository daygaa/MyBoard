// Petit « ⓘ » : au survol, la bulle de MyBoard montre le texte explicatif d'une option. Les textes explicatifs des
// options d'import y sont rangés, ceux des prochaines options aussi (IMP-30, demande du 10/11). Pas cliquable : flèche.

import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";

import { HoverCard } from "./hover-card";

export function InfoTip({ zone, children }: { zone: string; children: ReactNode }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  return (
    <span
      data-zone={zone}
      aria-label="Plus d'informations"
      onMouseEnter={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setAnchor(null)}
      className="inline-grid h-5 w-5 shrink-0 cursor-default place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
    >
      <Info className="h-3.5 w-3.5" />
      {anchor && (
        <HoverCard anchor={anchor} place="side" zone={`${zone}.bulle`}>
          <span className="block space-y-1.5 leading-relaxed">{children}</span>
        </HoverCard>
      )}
    </span>
  );
}
