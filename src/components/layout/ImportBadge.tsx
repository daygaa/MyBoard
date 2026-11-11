// Résumé de l'import en cours dans l'en-tête (IMP-76, réponse Q1 A du 11/11), entre le logo et le compteur de médias,
// quand on a quitté la page Importer : icône qui tourne, « Import 120 / 500 » et une mini barre ; « En pause » pendant
// une pause. Un clic ouvre la page Importer ; il disparaît à la fin de l'import (le bilan s'ouvre, IMP-45).

import { Loader2, Pause } from "lucide-react";

import { formatNumber } from "@/lib/format";
import { navigate, useRoute } from "@/lib/router";
import { useImport } from "@/stores/import";

export function ImportBadge() {
  const route = useRoute();
  const snapshot = useImport((s) => s.snapshot);
  const progress = snapshot?.progress;
  if (route === "import" || snapshot?.phase !== "importing" || !progress) return null;
  const paused = snapshot.paused !== null;
  const pct = progress.total > 0 ? (progress.processed / progress.total) * 100 : 0;
  return (
    <button
      type="button"
      data-zone="entete.import"
      onClick={() => navigate("import")}
      title="Ouvrir la page Importer"
      className="mr-auto flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {paused ? <Pause className="h-3.5 w-3.5 text-amber-300" /> : <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d9a94e]" />}
      <span className="tabular-nums whitespace-nowrap">
        {paused ? "En pause" : "Import"} {formatNumber(progress.processed)} / {formatNumber(progress.total)}
      </span>
      <span className="hidden h-1 w-14 overflow-hidden rounded-full bg-secondary sm:block">
        <span className={`block h-full ${paused ? "bg-amber-300" : "bg-[#d9a94e]"}`} style={{ width: `${pct}%` }} />
      </span>
    </button>
  );
}
