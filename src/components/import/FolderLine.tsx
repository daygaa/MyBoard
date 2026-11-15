// Ligne d'un dossier dans la liste avant l'import (IMP-88, réponse Q20 B du 14/11) : flèche pour le déplier, nom (bulle :
// son chemin), nombre de fichiers et poids, petite case « Sous-dossiers » (le dossier est alors parcouru de nouveau), croix
// pour le retirer en entier. Déplié : ses fichiers, chacun avec sa croix (Q40 A), 100 par 100 (« Voir plus », IMP-11).
// Clic droit sur la ligne : Retirer de la liste ‖ Afficher dans l'explorateur de fichiers (comme CTX-14).

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Folder, Loader2, X } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { api, type ScanLine } from "@/lib/api";
import { openContextMenu, type MenuEntry } from "@/lib/contextMenu";
import { formatBytes, formatNumber, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FileRow } from "./FileRow";

const STEP = 100;

function folderMenu(line: ScanLine, locked: boolean): MenuEntry[] {
  return [
    { label: "Retirer de la liste", disabled: locked, run: () => void api.removeScanSource(line.id) },
    "separator",
    { label: "Afficher dans l'explorateur de fichiers", run: () => void api.revealScanFile(line.path) },
  ];
}

/** Fichiers d'un dossier déplié. */
function FolderFiles({ line, locked, version }: { line: ScanLine; locked: boolean; version: number }) {
  const [shown, setShown] = useState(STEP);
  const { data } = useQuery({
    queryKey: ["scan-folder", line.id, version, shown],
    queryFn: () => api.scanFiles(0, shown, line.id),
    placeholderData: keepPreviousData,
  });
  if (!data || data.entries.length === 0) return null;
  const rest = data.total - data.entries.length;
  return (
    <div className="mt-1.5 space-y-1.5 pl-6">
      <ul className="space-y-1.5">
        {data.entries.map((entry) => (
          <FileRow key={entry.path} entry={entry} locked={locked} />
        ))}
      </ul>
      {rest > 0 && (
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-xs text-muted-foreground select-text">
            et {formatNumber(rest)} {plural(rest, "fichier supplémentaire", "fichiers supplémentaires")}
          </span>
          <button
            type="button"
            data-zone="import.liste.dossier.voir-plus"
            onClick={() => setShown((n) => n + STEP)}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-[#d9a94e] transition hover:bg-[#d9a94e]/10"
          >
            <ChevronDown className="h-4 w-4" />
            Voir plus
          </button>
        </div>
      )}
    </div>
  );
}

export function FolderLine({ line, locked, version }: { line: ScanLine; locked: boolean; version: number }) {
  const [open, setOpen] = useState(false);
  const name = line.path.split(/[\\/]/).filter(Boolean).pop() ?? line.path;
  const Arrow = open ? ChevronDown : ChevronRight;
  return (
    <li data-zone="import.liste.dossier">
      <div
        onContextMenu={(e) => openContextMenu(e, () => folderMenu(line, locked))}
        className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-2.5 py-2"
      >
        <button
          type="button"
          data-zone="import.liste.dossier.deplier"
          title={open ? "Replier" : "Déplier"}
          disabled={line.files === 0}
          onClick={() => setOpen((o) => !o)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#0d0e12] text-muted-foreground transition hover:text-foreground disabled:opacity-60"
        >
          <span className="flex items-center">
            <Arrow className="h-3.5 w-3.5" />
            <Folder className="h-5 w-5 text-[#d9a94e]" />
          </span>
        </button>
        <span className="min-w-0 flex-1 select-text">
          <span className="block truncate text-sm text-foreground" title={line.path}>
            {name}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
            {line.scanning && <Loader2 className="h-3 w-3 animate-spin text-[#d9a94e]" />}
            {line.scanning
              ? "Parcours du dossier…"
              : `${formatNumber(line.files)} ${plural(line.files, "fichier")} · ${formatBytes(line.bytes)}`}
          </span>
        </span>
        <label
          data-zone="import.liste.dossier.sous-dossiers"
          className={cn("flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground", locked ? "cursor-not-allowed" : "cursor-pointer")}
        >
          <Checkbox checked={line.recursive} disabled={locked} onCheckedChange={(c) => void api.setSourceRecursive(line.id, c === true)} />
          Sous-dossiers
        </label>
        {!locked && (
          <button
            type="button"
            data-zone="import.liste.dossier.retirer"
            title="Retirer le dossier de la liste"
            onClick={() => void api.removeScanSource(line.id)}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && line.files > 0 && <FolderFiles line={line} locked={locked} version={version} />}
    </li>
  );
}
