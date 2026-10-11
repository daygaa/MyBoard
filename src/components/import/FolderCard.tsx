// Choix du dossier à importer (IMP-02) avec la fenêtre Windows, option sous-dossiers
// (IMP-04) et résumé du contenu trouvé (IMP-05 : fichiers ignorés comptés).

import { open } from "@tauri-apps/plugin-dialog";
import { FileWarning, FolderOpen, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { api, type ScanSummary } from "@/lib/api";
import { formatBytes, formatNumber, plural } from "@/lib/format";
import { useImport } from "@/stores/import";

function ScanLine({ scan, scanning }: { scan: ScanSummary; scanning: boolean }) {
  const parts = [
    [scan.images, "image"],
    [scan.videos, "vidéo"],
    [scan.audio, "audio"],
    [scan.documents, "document"],
  ] as const;
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p className="flex items-center gap-2 text-sm text-foreground">
        {scanning && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d9a94e]" />}
        <span>
          <span className="font-semibold tabular-nums">{formatNumber(scan.total)}</span> {plural(scan.total, "fichier")}{" "}
          {scanning ? "trouvés pour l'instant…" : `à importer · ${formatBytes(scan.bytes)}`}
        </span>
      </p>
      <p>
        {parts
          .filter(([n]) => n > 0)
          .map(([n, word]) => `${formatNumber(n)} ${word === "audio" ? word : plural(n, word)}`)
          .join(" · ") || "Aucun fichier pris en charge"}
      </p>
      {scan.ignored > 0 && (
        <p>
          {formatNumber(scan.ignored)} {plural(scan.ignored, "fichier ignoré", "fichiers ignorés")} (format non pris en charge)
        </p>
      )}
      {scan.inaccessible > 0 && (
        <p className="text-amber-300/90">
          {formatNumber(scan.inaccessible)} {plural(scan.inaccessible, "élément illisible", "éléments illisibles")} (droits
          d'accès)
        </p>
      )}
    </div>
  );
}

export function FolderCard() {
  const snapshot = useImport((s) => s.snapshot);
  const recursive = useImport((s) => s.recursive);
  const setRecursive = useImport((s) => s.setRecursive);
  const importing = snapshot?.phase === "importing";
  const folder = snapshot?.folder ?? null;

  async function chooseFolder() {
    const path = await open({ directory: true, multiple: false, title: "Choisir le dossier à importer" });
    if (typeof path === "string") await api.scanFolder(path, recursive);
  }

  function toggleRecursive(value: boolean) {
    setRecursive(value);
    // Dossier déjà choisi : on le reparcourt avec la nouvelle option.
    if (folder && !importing) void api.scanFolder(folder, value);
  }

  return (
    <section data-zone="import.dossier" className="rounded-xl border border-border bg-card/60 p-6">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
        <FolderOpen className="h-4 w-4 text-[#d9a94e]" />
        Dossier
      </h2>

      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border px-6 py-8 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#d9a94e]/15 ring-1 ring-[#d9a94e]/30">
          <FolderOpen className="h-6 w-6 text-[#d9a94e]" />
        </span>
        {folder ? (
          <p className="max-w-full font-mono text-sm break-all text-foreground">{folder}</p>
        ) : (
          <p className="text-sm font-medium text-foreground">Choisissez le dossier à importer</p>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={importing}
          onClick={() => void chooseFolder()}
          className="border-[#d9a94e]/40 text-[#d9a94e] hover:bg-[#d9a94e]/10 hover:text-[#e3b75f]"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          {folder ? "Choisir un autre dossier" : "Importer un dossier"}
        </Button>
        <label className="mt-1 flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <Checkbox checked={recursive} disabled={importing} onCheckedChange={(c) => toggleRecursive(c === true)} />
          Importer le contenu des sous-dossiers
        </label>
        {snapshot?.scan && folder && <ScanLine scan={snapshot.scan} scanning={snapshot.phase === "scanning"} />}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <FileWarning className="h-3.5 w-3.5 text-[#d9a94e]" />
        Les fichiers restent à leur place : MyBoard les référence sans les copier, les déplacer ni les modifier.
      </p>
    </section>
  );
}
