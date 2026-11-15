// Ligne d'un fichier dans la liste avant l'import (IMP-10, apparence v8) : aperçu, nom, poids · format, et une croix au
// bout de la ligne pour retirer le fichier (CTX-14). Clic droit : Retirer de la liste ‖ Afficher dans l'explorateur de
// fichiers (CTX-14). Fichier choisi seul, ou dans un dossier déplié (IMP-88).

import { X } from "lucide-react";

import { api, type ScanEntry } from "@/lib/api";
import { openContextMenu, type MenuEntry } from "@/lib/contextMenu";
import { formatBytes } from "@/lib/format";
import { ListThumb } from "./ListThumb";

function rowMenu(entry: ScanEntry, locked: boolean): MenuEntry[] {
  return [
    { label: "Retirer de la liste", disabled: locked, run: () => void api.removeScanFile(entry.path) },
    "separator",
    { label: "Afficher dans l'explorateur de fichiers", run: () => void api.revealScanFile(entry.path) },
  ];
}

export function FileRow({ entry, locked }: { entry: ScanEntry; locked: boolean }) {
  return (
    <li
      data-zone="import.liste.fichier"
      onContextMenu={(e) => openContextMenu(e, () => rowMenu(entry, locked))}
      className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-2.5 py-2"
    >
      <ListThumb entry={entry} />
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
