// Barre d'actions de l'import (apparence v8) : état, bouton Importer, bouton Arrêter
// (IMP-42), progression intégrée (IMP-40). Le bouton Importer reste bloqué après un
// import terminé, jusqu'au choix d'un nouveau dossier (IMP-44).

import { Eye, Loader2, Play, Square, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useStats } from "@/hooks/useLibraryData";
import { api, type ImportSnapshot } from "@/lib/api";
import { formatNumber, plural } from "@/lib/format";
import { navigate } from "@/lib/router";
import { useImport } from "@/stores/import";
import { ImportProgress } from "./ImportProgress";

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
        <span>Aucun fichier à importer dans ce dossier</span>
      );
    case "importing":
      return (
        <span className="inline-flex items-center gap-2 text-[#d9a94e]">
          <Play className="h-4 w-4" />
          Import en cours…
        </span>
      );
    case "finished":
      return <span>Import terminé. Choisissez un dossier pour importer à nouveau.</span>;
    default:
      return <span>Aucun dossier sélectionné</span>;
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

  return (
    <div
      data-zone="import.action"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/40 px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <StatusText snapshot={snapshot} />
      </div>

      <div className="flex items-center gap-2">
        {phase === "importing" && (
          <Button
            data-zone="import.arreter"
            variant="outline"
            size="sm"
            onClick={() => void api.cancelImport()}
            className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
          >
            <Square className="h-4 w-4" />
            Arrêter
          </Button>
        )}
        {phase === "finished" && (
          <Button size="sm" onClick={() => navigate("library")} className="gap-1.5 bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]">
            <Eye className="h-4 w-4" />
            Voir la bibliothèque
          </Button>
        )}
        <Button
          data-zone="import.importer"
          disabled={!canImport}
          onClick={() => void api.startImport()}
          className="bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f] focus-visible:ring-[#d9a94e]/40"
        >
          <Upload className="h-4 w-4" />
          {phase === "importing" ? "Import en cours…" : `Importer${canImport ? ` (${formatNumber(total)})` : ""}`}
        </Button>
      </div>

      {snapshot?.progress && (phase === "importing" || phase === "finished") && (
        <ImportProgress progress={snapshot.progress} result={snapshot.result} />
      )}
      <ThumbsPending />
    </div>
  );
}
