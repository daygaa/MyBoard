// Progression et résumé de l'import, affichés DANS la barre d'actions (IMP-40, IMP-41).

import { Check, Loader2, Square } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import type { ImportProgress as ProgressData, ImportResult } from "@/lib/api";
import { formatNumber, plural } from "@/lib/format";

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`font-semibold tabular-nums ${color}`}>{formatNumber(value)}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </span>
  );
}

function resultLine(p: ProgressData, r: ImportResult): string {
  const start = r.fatal ? "Interrompu par une erreur" : r.cancelled ? "Arrêté" : "Terminé";
  const parts = [`${formatNumber(p.imported)} ${plural(p.imported, "importé")}`];
  if (p.updated > 0) parts.push(`${formatNumber(p.updated)} ${plural(p.updated, "modifié")}`);
  if (p.alreadyPresent > 0) parts.push(`${formatNumber(p.alreadyPresent)} déjà ${plural(p.alreadyPresent, "présent")}`);
  if (p.duplicates > 0) parts.push(`${formatNumber(p.duplicates)} ${plural(p.duplicates, "doublon")} ${plural(p.duplicates, "ignoré")}`);
  if (p.errors > 0) parts.push(`${formatNumber(p.errors)} ${plural(p.errors, "erreur")}`);
  const duration = r.elapsedMs < 1000 ? "moins d'une seconde" : `${formatNumber(Math.round(r.elapsedMs / 1000))} s`;
  return `${start} — ${parts.join(", ")} (${duration})`;
}

export function ImportProgress({ progress, result }: { progress: ProgressData; result: ImportResult | null }) {
  const pct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
  const running = result === null;

  return (
    <div data-zone="import.progression" className="w-full space-y-3 border-t border-border/70 pt-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d9a94e]" />
          ) : result.cancelled || result.fatal ? (
            <Square className="h-3.5 w-3.5 text-amber-400" />
          ) : (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          )}
          Progression
        </span>
        <Stat label="Importés" value={progress.imported + progress.updated} color="text-emerald-400" />
        <Stat label="Déjà présents" value={progress.alreadyPresent} color="text-muted-foreground" />
        <Stat label="Doublons" value={progress.duplicates} color="text-amber-400" />
        <Stat label="Erreurs" value={progress.errors} color="text-rose-400" />
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
          {formatNumber(progress.processed)} / {formatNumber(progress.total)} · {pct}%
        </span>
      </div>

      <Progress value={pct} className="h-2 bg-secondary [&_[data-slot=progress-indicator]]:bg-[#d9a94e]" />

      <p className="-mt-1.5 truncate text-[11px] text-muted-foreground" title={progress.currentFile ?? undefined}>
        {running
          ? `Traitement en cours… (fichier ${formatNumber(Math.min(progress.processed + 1, progress.total))}/${formatNumber(progress.total)})${progress.currentFile ? ` — ${progress.currentFile}` : ""}`
          : resultLine(progress, result)}
      </p>

      {result?.fatal && <p className="text-xs text-rose-400">{result.fatal}</p>}

      {result && result.errorFiles.length > 0 && (
        <div data-zone="import.erreurs">
          <p className="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Fichiers en erreur
            {progress.errors > result.errorFiles.length && ` (${result.errorFiles.length} premiers sur ${progress.errors})`}
          </p>
          <ul className="max-h-44 space-y-1 overflow-y-auto pr-1">
            {result.errorFiles.map((f) => (
              <li key={f.path} className="rounded-md border border-border bg-background/40 px-2 py-1.5 text-xs">
                <span className="block truncate text-foreground" title={f.path}>
                  {f.path}
                </span>
                <span className="block truncate text-[10px] text-rose-300/80" title={f.message}>
                  {f.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
