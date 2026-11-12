// Avancement du travail en arrière-plan sur les tags (TAGM-23, réponses Q5 B et Q7 B du 12/11) : un badge en haut au
// centre, comme les autres badges de MyBoard, sur toutes les pages. Il n'apparaît qu'après une demi-seconde (un petit
// travail ne le fait pas clignoter) et se place sous le badge bref quand il y en a un.

import { useEffect, useState } from "react";

import { BADGE, badgeTop } from "@/components/library/GridBadge";
import { formatNumber, plural } from "@/lib/format";
import { useGridBadge } from "@/stores/badge";
import { useTagJobs } from "@/stores/tagJobs";

/** Attente avant d'afficher le badge, et écart sous le badge bref. */
const DELAY_MS = 500;
const BELOW = 44;

export function TagJobBadge() {
  const progress = useTagJobs((s) => s.progress);
  const since = useTagJobs((s) => s.since);
  const brief = useGridBadge((s) => s.text);
  const [, redraw] = useState(0);
  const wait = progress ? since + DELAY_MS - Date.now() : 0;
  const waiting = wait > 0;
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => redraw((n) => n + 1), wait);
    return () => window.clearTimeout(timer);
  }, [waiting, wait]);
  if (!progress || waiting) return null;
  const tags = (n: number) => `${formatNumber(n)} ${plural(n, "tag")}`;
  const text =
    progress.kind === 2
      ? `Suppression définitive de ${tags(progress.total)}…`
      : `${progress.kind === 1 ? "Mise à la corbeille" : "Restauration"} : ${formatNumber(progress.done)} / ${tags(progress.total)}`;
  return (
    <div data-zone="tags-travail.badge" className={BADGE} style={{ top: badgeTop() + (brief ? BELOW : 0) }}>
      {text}
    </div>
  );
}
