// Barre d'actions de l'import (apparence v8) : état, bouton Importer, boutons de l'import en cours (pause,
// « Terminer ici », « Annuler l'import » : ImportControls.tsx, IMP-42, IMP-43), progression intégrée (IMP-40). Le bouton Importer reste bloqué après un
// import terminé, jusqu'au choix d'un nouveau dossier (IMP-44). Elle reste collée sous l'en-tête quand la page
// défile (IMP-56). Avant de démarrer, les pop-ins des paires, de « Compresser aussi » et de la suppression des
// originaux peuvent s'ouvrir (useImportStart.tsx : IMP-64, IMP-60, IMP-28).

import { Eye, Loader2, Pause, Play, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useStats } from "@/hooks/useLibraryData";
import type { ImportSnapshot } from "@/lib/api";
import { formatNumber, plural } from "@/lib/format";
import { useImport } from "@/stores/import";
import { goHome } from "@/stores/search";
import { ImportControls } from "./ImportControls";
import { ImportProgress } from "./ImportProgress";
import { useImportStart } from "./useImportStart";

function StatusText({ snapshot }: { snapshot: ImportSnapshot | null }) {
  const scan = snapshot?.scan;
  switch (snapshot?.phase) {
    case "scanning":
      return <span>Analyse du dossier…</span>;
    case "ready":
      return scan && scan.total > 0 ? (
        <span>
          Prêt à importer <span className="font-semibold text-foreground tabular-nums">{formatNumber(scan.total)}</span>{" "}
          {plural(scan.total, "fichier")}
        </span>
      ) : (
        <span>Aucun fichier à importer dans cette sélection</span>
      );
    case "importing":
      if (snapshot.paused) {
        return (
          <span className="inline-flex items-center gap-2 text-amber-300">
            <Pause className="h-4 w-4" />
            Import en pause
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-2 text-[#d9a94e]">
          <Play className="h-4 w-4" />
          Import en cours…
        </span>
      );
    case "finished":
      return <span>Import terminé. Choisissez des fichiers ou un dossier pour importer à nouveau.</span>;
    default:
      return <span>Aucun fichier sélectionné</span>;
  }
}

/** Miniatures encore à créer en arrière-plan (LIB-06). */
function ThumbsPending() {
  const { data: stats } = useStats(true);
  const pending = stats?.thumbsPending ?? 0;
  if (pending === 0) return null;
  return (
    <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin text-[#d9a94e]" />
      Miniatures en cours de création : {formatNumber(pending)} {plural(pending, "restante")}
    </p>
  );
}

export function ImportActionBar() {
  const snapshot = useImport((s) => s.snapshot);
  const phase = snapshot?.phase ?? "idle";
  const total = snapshot?.scan?.total ?? 0;
  const canImport = phase === "ready" && total > 0;
  const { start, checking, dialog } = useImportStart();

  return (
    <div
      data-zone="import.action"
      className="sticky top-[57px] z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-[color-mix(in_srgb,var(--card)_40%,var(--background))] px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <StatusText snapshot={snapshot} />
      </div>

      <div className="flex items-center gap-2">
        {phase === "importing" && snapshot && <ImportControls snapshot={snapshot} />}
        {phase === "finished" && (
          // Retour complet à l'accueil, comme le logo (IMP-58, NAV-08).
          <Button size="sm" onClick={goHome} className="gap-1.5 bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]">
            <Eye className="h-4 w-4" />
            Voir la bibliothèque
          </Button>
        )}
        <Button
          data-zone="import.importer"
          disabled={!canImport || checking}
          onClick={() => void start()}
          className="bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f] focus-visible:ring-[#d9a94e]/40 disabled:hover:bg-[#d9a94e]"
        >
          <Upload className="h-4 w-4" />
          {phase === "importing" ? "Import en cours…" : `Importer${canImport ? ` (${formatNumber(total)})` : ""}`}
        </Button>
      </div>

      {snapshot?.progress && (phase === "importing" || phase === "finished") && (
        <ImportProgress progress={snapshot.progress} result={snapshot.result} paused={snapshot.paused} />
      )}
      <ThumbsPending />
      {dialog}
    </div>
  );
}
