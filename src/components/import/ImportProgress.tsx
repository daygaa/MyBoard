// Progression et résumé de l'import, affichés DANS la barre d'actions (IMP-40, IMP-41) ; résultat de la compression et
// de la conversion des images et des vidéos (IMP-20, IMP-69), en attendant la pop-in de bilan (IMP-45). Pendant le
// traitement d'une vidéo : sa miniature, son nom et sa propre barre (IMP-41). En pause : « En pause », et pour un
// emplacement devenu inaccessible, le message pour le rebrancher (IMP-42, IMP-54) ; fichiers disparus listés à part.

import { Check, Loader2, Pause, Square, Undo2 } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { api, scanPreviewUrl, type ImportProgress as ProgressData, type ImportResult, type ImportSnapshot } from "@/lib/api";
import { openContextMenu, type MenuEntry } from "@/lib/contextMenu";
import { formatNumber, plural } from "@/lib/format";
import { keepQuoted } from "@/lib/keepWords";

/** Clic droit sur un fichier en erreur (CTX-14). */
function errorMenu(f: { path: string; message: string }): MenuEntry[] {
  return [
    { label: "Copier le message", run: () => void api.writeClipboardText(`${f.path}\n${f.message}`) },
    "separator",
    { label: "Afficher dans l'explorateur de fichiers", run: () => void api.revealScanFile(f.path) },
  ];
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`font-semibold tabular-nums ${color}`}>{formatNumber(value)}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </span>
  );
}

function resultLine(p: ProgressData, r: ImportResult): string {
  if (r.undone) return `Import annulé — ${undoneText(r.undone)}`;
  const start = r.fatal ? "Interrompu par une erreur" : r.cancelled ? "Terminé avant la fin de la liste" : "Terminé";
  const parts = [`${formatNumber(p.imported)} ${plural(p.imported, "importé")}`];
  if (p.updated > 0) parts.push(`${formatNumber(p.updated)} ${plural(p.updated, "modifié")}`);
  if (p.alreadyPresent > 0) parts.push(`${formatNumber(p.alreadyPresent)} déjà ${plural(p.alreadyPresent, "présent")}`);
  if (p.duplicates > 0) parts.push(`${formatNumber(p.duplicates)} ${plural(p.duplicates, "doublon")} ${plural(p.duplicates, "ignoré")}`);
  if (p.relocated > 0) parts.push(`${formatNumber(p.relocated)} ${plural(p.relocated, "retrouvé")} à un autre endroit`);
  if (p.vanished > 0) parts.push(`${formatNumber(p.vanished)} ${plural(p.vanished, "fichier disparu", "fichiers disparus")}`);
  if (p.errors > 0) parts.push(`${formatNumber(p.errors)} ${plural(p.errors, "erreur")}`);
  const duration = r.elapsedMs < 1000 ? "moins d'une seconde" : `${formatNumber(Math.round(r.elapsedMs / 1000))} s`;
  return `${start} — ${parts.join(", ")} (${duration})`;
}

/** Ce qu'« Annuler l'import » a défait (IMP-43) : aussi dans le bilan. */
export function undoneText(u: NonNullable<ImportResult["undone"]>): string {
  const parts = [`${formatNumber(u.removed)} ${plural(u.removed, "média retiré", "médias retirés")} de la bibliothèque`];
  if (u.restored > 0) parts.push(`${formatNumber(u.restored)} ${plural(u.restored, "média remis dans son état d'avant", "médias remis dans leur état d'avant")}`);
  parts.push(`${formatNumber(u.erased)} ${plural(u.erased, "fichier écrit par MyBoard effacé", "fichiers écrits par MyBoard effacés")}`);
  return parts.join(", ");
}

/** « 12 images compressées · 4 converties · 3 gardées telles quelles (moins de 5 % de gain) · 2 originaux supprimés… ». */
export function compressionLine(p: ProgressData): string {
  const parts = [];
  if (p.compressed > 0) parts.push(`${formatNumber(p.compressed)} ${plural(p.compressed, "image compressée", "images compressées")}`);
  if (p.converted > 0) parts.push(`${formatNumber(p.converted)} ${plural(p.converted, "image convertie", "images converties")}`);
  if (p.notSmaller > 0)
    parts.push(`${formatNumber(p.notSmaller)} ${plural(p.notSmaller, "gardée telle quelle", "gardées telles quelles")} (moins de 5 % de gain)`);
  if (p.compressFailed > 0)
    parts.push(
      `${formatNumber(p.compressFailed)} ${plural(p.compressFailed, "compression impossible", "compressions impossibles")} (${plural(p.compressFailed, "importée", "importées")} sans compression)`,
    );
  if (p.videosCompressed > 0) parts.push(`${formatNumber(p.videosCompressed)} ${plural(p.videosCompressed, "vidéo compressée", "vidéos compressées")}`);
  if (p.videosConverted > 0) parts.push(`${formatNumber(p.videosConverted)} ${plural(p.videosConverted, "vidéo convertie", "vidéos converties")}`);
  if (p.videosUnsupported > 0)
    parts.push(
      `${formatNumber(p.videosUnsupported)} ${plural(p.videosUnsupported, "vidéo dans un ancien format, non compressée", "vidéos dans un ancien format, non compressées")}`,
    );
  if (p.videosSubtitlesLost > 0)
    parts.push(
      `${formatNumber(p.videosSubtitlesLost)} ${plural(p.videosSubtitlesLost, "vidéo convertie sans ses sous-titres en images", "vidéos converties sans leurs sous-titres en images")} (non acceptés par le format choisi)`,
    );
  if (p.setAside > 0) parts.push(`${formatNumber(p.setAside)} ${plural(p.setAside, "fichier écarté", "fichiers écartés")} (paires)`);
  if (p.deleted > 0) parts.push(`${formatNumber(p.deleted)} ${plural(p.deleted, "fichier supprimé", "fichiers supprimés")} du disque`);
  if (p.deleteFailed > 0)
    parts.push(`${formatNumber(p.deleteFailed)} ${plural(p.deleteFailed, "suppression impossible", "suppressions impossibles")}`);
  return parts.join(" · ");
}

type Props = { progress: ProgressData; result: ImportResult | null; paused: ImportSnapshot["paused"] };

export function ImportProgress({ progress, result, paused }: Props) {
  const pct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
  const running = result === null;

  return (
    <div data-zone="import.progression" className="w-full select-text space-y-3 border-t border-border/70 pt-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {running && paused ? (
            <Pause className="h-3.5 w-3.5 text-amber-300" />
          ) : running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d9a94e]" />
          ) : result.undone ? (
            <Undo2 className="h-3.5 w-3.5 text-amber-400" />
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
        {progress.relocated > 0 && <Stat label="Retrouvés" value={progress.relocated} color="text-emerald-400" />}
        <Stat label="Erreurs" value={progress.errors} color="text-rose-400" />
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
          {formatNumber(progress.processed)} / {formatNumber(progress.total)} · {pct}%
        </span>
      </div>

      <Progress value={pct} className="h-2 bg-secondary [&_[data-slot=progress-indicator]]:bg-[#d9a94e]" />

      <p className="-mt-1.5 truncate text-[11px] text-muted-foreground" title={progress.currentFile ?? undefined}>
        {running && paused
          ? `En pause (fichier ${formatNumber(Math.min(progress.processed + 1, progress.total))}/${formatNumber(progress.total)})`
          : running
          ? `Traitement en cours… (fichier ${formatNumber(Math.min(progress.processed + 1, progress.total))}/${formatNumber(progress.total)})${progress.currentFile ? ` — ${progress.currentFile}` : ""}`
          : resultLine(progress, result)}
      </p>

      {running && paused?.offline && (
        <p data-zone="import.emplacement-inaccessible" className="-mt-1.5 text-xs text-amber-300">
          {keepQuoted(`« ${paused.offline} » est inaccessible : rebranchez-le, puis cliquez sur « Reprendre ».`)}
        </p>
      )}

      {running && progress.fileProgress !== null && progress.currentPath && (
        <div data-zone="import.progression.fichier" className="flex items-center gap-3">
          <img src={scanPreviewUrl(progress.currentPath)} alt="" className="h-10 w-10 shrink-0 rounded-md bg-secondary object-cover" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex justify-between gap-3 text-[11px] text-muted-foreground">
              <span className="truncate">Traitement de la vidéo — {progress.currentFile}</span>
              <span className="tabular-nums">{Math.round(progress.fileProgress * 100)}%</span>
            </div>
            <Progress value={progress.fileProgress * 100} className="h-1.5 bg-secondary [&_[data-slot=progress-indicator]]:bg-emerald-400" />
          </div>
        </div>
      )}

      {compressionLine(progress) !== "" && (
        <p data-zone="import.compression" className="-mt-1.5 text-[11px] text-muted-foreground">
          {compressionLine(progress)}
        </p>
      )}

      {result?.fatal && <p className="text-xs text-rose-400">{result.fatal}</p>}

      {result && result.vanishedFiles.length > 0 && (
        <div data-zone="import.disparus">
          <p className="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Fichiers disparus pendant l'import
            {progress.vanished > result.vanishedFiles.length && ` (${result.vanishedFiles.length} premiers sur ${progress.vanished})`}
          </p>
          <ul className="max-h-32 space-y-1 overflow-y-auto overscroll-contain pr-1">
            {result.vanishedFiles.map((path) => (
              <li key={path} className="truncate rounded-md border border-border bg-background/40 px-2 py-1.5 text-xs text-foreground" title={path}>
                {path}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && result.errorFiles.length > 0 && (
        <div data-zone="import.erreurs">
          <p className="mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Fichiers en erreur
            {progress.errors > result.errorFiles.length && ` (${result.errorFiles.length} premiers sur ${progress.errors})`}
          </p>
          <ul className="max-h-44 space-y-1 overflow-y-auto pr-1">
            {result.errorFiles.map((f) => (
              <li
                key={f.path}
                onContextMenu={(e) => openContextMenu(e, () => errorMenu(f))}
                className="rounded-md border border-border bg-background/40 px-2 py-1.5 text-xs"
              >
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
