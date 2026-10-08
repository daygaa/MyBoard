"use client";

// MyBoard — Affichage de la progression d'import.
// - Barre de progression globale (% fichiers traités / total)
// - Fichier en cours d'affichage
// - Liste des fichiers avec statut : pending / processing / imported / duplicate / error
// - Logs en temps réel (console-like, scrollable max-h-64)
// - Boutons contextuels : Annuler (running) / Fermer (done) / Voir les médias (lien /?tags=defaultTags)

import Link from "next/link";
import {
  Check,
  X,
  AlertTriangle,
  Loader2,
  Eye,
  ArrowRight,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type {
  DefaultTag,
  ImportFileResult,
} from "@/lib/import-processing";
import { formatBytes, searchHref } from "@/lib/shared";

type Status = "idle" | "running" | "done";

type Props = {
  status: Status;
  total: number;
  /** Nombre de fichiers déjà traités (résolus, pas juste entamés). */
  processed: number;
  /** Index (0-based) du fichier en cours de traitement, ou null si aucun. */
  currentIdx: number | null;
  results: ImportFileResult[];
  logs: string[];
  /** Tags par défaut à attacher (tableau d'objets {name, category}). */
  defaultTags: DefaultTag[];
  onCancel: () => void;
  onClose: () => void;
};

export function ImportProgress({
  status,
  total,
  processed,
  currentIdx,
  results,
  logs,
  defaultTags,
  onCancel,
  onClose,
}: Props) {
  if (status === "idle") return null;

  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  const imported = results.filter((r) => r.status === "imported").length;
  const duplicates = results.filter((r) => r.status === "duplicate").length;
  const errors = results.filter((r) => r.status === "error").length;

  // Index → map vers un résultat si déjà traité, sinon "processing" ou "pending"
  // (les fichiers ne sont PAS connus individuellement côté UI — on utilise l'index)
  // NOTE: results.length correspond à `processed`, donc les fichiers d'index >= processed sont pending/processing.
  const rows = Array.from({ length: total }, (_, i) => {
    if (i < results.length) {
      return { idx: i, result: results[i], state: results[i].status as State };
    }
    if (i === currentIdx && status === "running") {
      return { idx: i, result: null, state: "processing" as const };
    }
    return { idx: i, result: null, state: "pending" as const };
  });

  // Lien vers les médias (par tags par défaut) : on join les noms normalisés
  const tagsQuery = defaultTags
    .map((t) => t.name)
    .filter(Boolean)
    .join(" ")
    .trim()
    .replace(/\s+/g, " ");
  const browseHref = tagsQuery ? searchHref(tagsQuery) : "/";

  return (
    <Card className="border-border bg-card/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {status === "running" ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#d9a94e]" />
          ) : (
            <Check className="h-4 w-4 text-emerald-400" />
          )}
          Progression
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Stats globales */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
          <StatBadge label="Importés" value={imported} variant="emerald" />
          <StatBadge label="Doublons" value={duplicates} variant="amber" />
          <StatBadge label="Erreurs" value={errors} variant="rose" />
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {processed} / {total} · {pct}%
          </span>
        </div>

        {/* Barre de progression */}
        <div>
          <Progress
            value={pct}
            className="h-2.5 bg-secondary [&_[data-slot=progress-indicator]]:bg-[#d9a94e]"
          />
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {status === "running"
              ? currentIdx !== null && rows[currentIdx]
                ? `Traitement en cours… (fichier ${currentIdx + 1}/${total})`
                : "Traitement en cours…"
              : status === "done"
                ? `Terminé — ${imported} importé${imported > 1 ? "s" : ""}${
                    duplicates > 0 ? `, ${duplicates} doublon${duplicates > 1 ? "s" : ""} ignoré${duplicates > 1 ? "s" : ""}` : ""
                  }${errors > 0 ? `, ${errors} erreur${errors > 1 ? "s" : ""}` : ""}`
                : ""}
          </p>
        </div>

        {/* Liste des fichiers */}
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Fichiers
          </p>
          <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {rows.map((row) => (
              <FileRow key={row.idx} row={row} total={total} />
            ))}
          </ul>
        </div>

        {/* Console logs */}
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Logs
          </p>
          <div className="h-44 overflow-y-auto rounded-md border border-border bg-black/40 p-2.5 font-mono text-[11px] leading-relaxed">
            {logs.length === 0 ? (
              <span className="text-muted-foreground/60">
                En attente de logs…
              </span>
            ) : (
              logs.map((log, i) => (
                <LogLine key={i} text={log} />
              ))
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {status === "running" && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
            >
              <X className="h-4 w-4" />
              Annuler
            </Button>
          )}
          {status === "done" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="border-border text-muted-foreground hover:text-foreground"
              >
                Fermer
              </Button>
              <Button
                asChild
                size="sm"
                className="bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]"
              >
                <Link href={browseHref} className="gap-1.5">
                  {tagsQuery ? (
                    <>
                      <Eye className="h-4 w-4" />
                      Voir les médias
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      Voir la bibliothèque
                    </>
                  )}
                </Link>
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

type State = "pending" | "processing" | "imported" | "duplicate" | "error";

function StatBadge({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "emerald" | "amber" | "rose";
}) {
  const color =
    variant === "emerald"
      ? "text-emerald-400"
      : variant === "amber"
        ? "text-amber-400"
        : "text-rose-400";
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`font-semibold tabular-nums ${color}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  );
}

type Row = {
  idx: number;
  result: ImportFileResult | null;
  state: State;
};

function FileRow({ row }: { row: Row; total: number }) {
  const { state, result } = row;

  const icon = (() => {
    switch (state) {
      case "imported":
        return <Check className="h-4 w-4 text-emerald-400" />;
      case "duplicate":
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      case "error":
        return <X className="h-4 w-4 text-rose-400" />;
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin text-[#d9a94e]" />;
      case "pending":
        return <Circle className="h-3 w-3 text-muted-foreground/40" />;
    }
  })();

  const label = (() => {
    switch (state) {
      case "imported":
        return "Importé";
      case "duplicate":
        return "Doublon";
      case "error":
        return "Erreur";
      case "processing":
        return "Traitement…";
      case "pending":
        return "En attente";
    }
  })();

  const labelColor = (() => {
    switch (state) {
      case "imported":
        return "text-emerald-400";
      case "duplicate":
        return "text-amber-400";
      case "error":
        return "text-rose-400";
      case "processing":
        return "text-[#d9a94e]";
      case "pending":
        return "text-muted-foreground/60";
    }
  })();

  // Si pending et qu'on n'a pas encore de nom de fichier, on affiche un placeholder
  const displayName =
    result?.file ?? (state === "processing" ? "Fichier en cours…" : `Fichier ${row.idx + 1}`);

  return (
    <li className="flex items-center gap-2.5 rounded-md border border-border bg-background/40 px-2.5 py-1.5">
      <span className="grid h-5 w-5 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={displayName}>
        {displayName}
      </span>
      {result?.size !== undefined &&
        result.originalSize !== undefined &&
        result.size !== result.originalSize && (
          <span className="text-[11px] text-emerald-300 tabular-nums">
            {formatBytes(result.originalSize)} →{" "}
            <span className="font-medium">{formatBytes(result.size)}</span>
          </span>
        )}
      {result?.warning && (
        <span className="text-[11px] text-amber-300/80" title={result.warning}>
          ⚠
        </span>
      )}
      <span className={`text-[11px] font-medium ${labelColor}`}>{label}</span>
      {result?.error && (
        <span className="max-w-[40%] truncate text-[11px] text-rose-300/80" title={result.error}>
          {result.error}
        </span>
      )}
    </li>
  );
}

function LogLine({ text }: { text: string }) {
  // Coloration légère par préfixe
  let cls = "text-zinc-300";
  if (/^\[\d+\/\d+\]/.test(text)) cls = "text-[#d9a94e]";
  else if (text.startsWith("  ✓")) cls = "text-emerald-400";
  else if (text.startsWith("  ⊘")) cls = "text-amber-400";
  else if (text.startsWith("  ✗") || text.startsWith("  ✗")) cls = "text-rose-400";
  else if (text.startsWith("  ⚠")) cls = "text-amber-300";
  else if (text.startsWith("---")) cls = "text-muted-foreground font-semibold";
  else if (text.startsWith("[ANNULÉ]")) cls = "text-rose-400 font-semibold";
  return <div className={cls}>{text}</div>;
}
