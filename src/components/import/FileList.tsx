// Liste des fichiers choisis, sous la barre d'actions (IMP-10, apparence v8) : aperçu, nom, poids · format, et une
// croix au bout de la ligne pour retirer le fichier (CTX-14). 100 lignes, puis « et X supplémentaires » et
// « Voir plus » (+100 par clic, IMP-11) ; les lignes sont lues par pages dans le cœur Rust : la page reste fluide
// avec 100 000 fichiers choisis (IMP-12). « Tout vider » (IMP-51) remet la page à son état de départ.
// Clic droit sur une ligne : Retirer de la liste ‖ Afficher dans l'explorateur de fichiers (CTX-14).
// Pendant l'import, la liste reste affichée, sans croix ni « Tout vider » ; elle disparaît à la fin (IMP-50).

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown, File, FileText, Film, Image as ImageIcon, ListChecks, Music, Trash2, X } from "lucide-react";

import { api, scanPreviewUrl, type ScanEntry } from "@/lib/api";
import { openContextMenu, type MenuEntry } from "@/lib/contextMenu";
import { formatBytes, formatNumber, plural } from "@/lib/format";
import { useImport } from "@/stores/import";

const STEP = 100;

/** Fichiers qui ont un aperçu (les autres : une icône, comme dans la grille). */
const hasPreview = (e: ScanEntry) => e.kind === "image" || e.kind === "video" || e.ext === "pdf";

function KindIcon({ entry }: { entry: ScanEntry }) {
  const Icon = entry.kind === "audio" ? Music : entry.kind === "video" ? Film : entry.kind === "image" ? ImageIcon : entry.ext === "pdf" ? FileText : File;
  return <Icon className="h-5 w-5 text-zinc-500" />;
}

function rowMenu(entry: ScanEntry, locked: boolean): MenuEntry[] {
  return [
    { label: "Retirer de la liste", disabled: locked, run: () => void api.removeScanFile(entry.path) },
    "separator",
    { label: "Afficher dans l'explorateur de fichiers", run: () => void api.revealScanFile(entry.path) },
  ];
}

function Row({ entry, locked }: { entry: ScanEntry; locked: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <li
      data-zone="import.liste.fichier"
      onContextMenu={(e) => openContextMenu(e, () => rowMenu(entry, locked))}
      className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-2.5 py-2"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-md bg-[#0d0e12]">
        {hasPreview(entry) && !failed ? (
          <img
            src={scanPreviewUrl(entry.path)}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <KindIcon entry={entry} />
        )}
      </span>
      <span className="min-w-0 flex-1 select-text">
        <span className="block truncate text-sm text-foreground" title={entry.path}>
          {entry.name}
        </span>
        <span className="block text-[11px] text-muted-foreground">
          {formatBytes(entry.size)} · {entry.ext.toUpperCase()}
        </span>
      </span>
      {!locked && (
        <button
          type="button"
          data-zone="import.liste.retirer"
          title="Retirer de la liste"
          onClick={() => void api.removeScanFile(entry.path)}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

export function FileList() {
  const snapshot = useImport((s) => s.snapshot);
  const phase = snapshot?.phase ?? "idle";
  const visible = phase === "ready" || phase === "importing";
  const locked = phase === "importing";
  const total = snapshot?.scan?.total ?? 0;
  const bytes = snapshot?.scan?.bytes ?? 0;
  const sourcesKey = snapshot?.sources.join("|") ?? "";
  const [shown, setShown] = useState(STEP);
  // Nouveau choix de fichiers : on repart des 100 premières lignes.
  useEffect(() => setShown(STEP), [sourcesKey]);
  const { data } = useQuery({
    queryKey: ["scan-files", sourcesKey, total, shown, phase],
    queryFn: () => api.scanFiles(0, shown),
    enabled: visible && total > 0,
    placeholderData: keepPreviousData,
  });
  if (!visible || total === 0 || !data) return null;
  const rest = total - data.entries.length;

  return (
    <section data-zone="import.liste" className="rounded-xl border border-border bg-card/60 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
          <ListChecks className="h-4 w-4 text-[#d9a94e]" />
          Fichiers sélectionnés
          <span className="rounded bg-[#d9a94e]/15 px-1.5 py-0.5 text-xs text-[#d9a94e] tabular-nums select-text">{formatNumber(total)}</span>
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums select-text">{formatBytes(bytes)}</span>
          {!locked && (
            <button
              type="button"
              data-zone="import.liste.vider"
              onClick={() => void api.clearScan()}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <Trash2 className="h-4 w-4" />
              Tout vider
            </button>
          )}
        </div>
      </div>
      <ul className="space-y-1.5">
        {data.entries.map((entry) => (
          <Row key={entry.path} entry={entry} locked={locked} />
        ))}
      </ul>
      {rest > 0 && (
        <div className="mt-3 flex flex-col items-center gap-1.5">
          <span className="text-xs text-muted-foreground select-text">
            et {formatNumber(rest)} {plural(rest, "fichier supplémentaire", "fichiers supplémentaires")}
          </span>
          <button
            type="button"
            data-zone="import.liste.voir-plus"
            onClick={() => setShown((n) => n + STEP)}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-[#d9a94e] transition hover:bg-[#d9a94e]/10"
          >
            <ChevronDown className="h-4 w-4" />
            Voir plus
          </button>
        </div>
      )}
    </section>
  );
}
