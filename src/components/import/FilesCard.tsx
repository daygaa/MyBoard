// Carte « Fichiers » de la page d'import (apparence v8) : glisser-déposer de fichiers et de
// dossiers (IMP-03), bouton « Importer un fichier » (IMP-01), bouton « Importer un dossier »
// (IMP-02), option sous-dossiers (IMP-04), résumé du contenu trouvé (IMP-05).
// Après un import, la carte revient à son état de départ (IMP-50).

import { useQuery } from "@tanstack/react-query";
import { open } from "@tauri-apps/plugin-dialog";
import { FileWarning, FolderOpen, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useFileDrop } from "@/hooks/useFileDrop";
import { api, type ScanSummary } from "@/lib/api";
import { formatBytes, formatNumber, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
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
      <p className="flex items-center justify-center gap-2 text-sm text-foreground">
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

/** Ce qui a été choisi : un chemin, ou le nombre d'éléments et les premiers noms. */
function Sources({ sources }: { sources: string[] }) {
  if (sources.length === 1) return <p className="max-w-full font-mono text-sm break-all text-foreground">{sources[0]}</p>;
  const names = sources.map((s) => s.split(/[\\/]/).pop() ?? s);
  return (
    <p className="max-w-full text-sm text-foreground">
      {formatNumber(sources.length)} éléments choisis :{" "}
      <span className="font-mono text-xs break-all text-muted-foreground">
        {names.slice(0, 3).join(", ")}
        {names.length > 3 && "…"}
      </span>
    </p>
  );
}

export function FilesCard() {
  const snapshot = useImport((s) => s.snapshot);
  const recursive = useImport((s) => s.recursive);
  const setRecursive = useImport((s) => s.setRecursive);
  const phase = snapshot?.phase ?? "idle";
  const importing = phase === "importing";
  // Choix en cours d'examen ou d'import ; après l'import, la carte est remise à zéro.
  const active = phase === "scanning" || phase === "ready" || importing;
  const sources = active ? (snapshot?.sources ?? []) : [];
  const { data: extensions } = useQuery({ queryKey: ["extensions"], queryFn: api.supportedExtensions, staleTime: Infinity });

  const scan = (paths: string[], withSubfolders = recursive) => {
    if (paths.length > 0) void api.scanPaths(paths, withSubfolders);
  };
  const dragging = useFileDrop(!importing, (paths) => scan(paths));

  async function chooseFiles() {
    const picked = await open({
      multiple: true,
      directory: false,
      title: "Choisir les fichiers à importer",
      filters: [
        { name: "Médias et documents", extensions: extensions ?? [] },
        { name: "Tous les fichiers", extensions: ["*"] },
      ],
    });
    if (picked) scan(Array.isArray(picked) ? picked : [picked]);
  }

  async function chooseFolder() {
    const picked = await open({ directory: true, multiple: false, title: "Choisir le dossier à importer" });
    if (typeof picked === "string") scan([picked]);
  }

  function toggleRecursive(value: boolean) {
    setRecursive(value);
    // Choix déjà fait : on le reparcourt avec la nouvelle option.
    if (sources.length > 0 && !importing) scan(sources, value);
  }

  return (
    <section data-zone="import.fichiers" className="rounded-xl border border-border bg-card/60 p-6">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
        <Upload className="h-4 w-4 text-[#d9a94e]" />
        Fichiers
      </h2>

      <div
        data-zone="import.depot"
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragging
            ? "border-[#d9a94e] bg-[#d9a94e]/5 ring-2 ring-[#d9a94e]/20"
            : "border-border bg-background/40 hover:border-[#d9a94e]/50 hover:bg-[#d9a94e]/[0.03]",
          importing && "opacity-60",
        )}
      >
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#d9a94e]/15 ring-1 ring-[#d9a94e]/30">
          <Upload className="h-6 w-6 text-[#d9a94e]" />
        </span>
        {sources.length > 0 ? (
          <Sources sources={sources} />
        ) : (
          <div>
            <p className="text-sm font-medium text-foreground">
              {dragging ? "Déposez vos fichiers ou dossiers ici" : "Glissez-déposez vos fichiers ou dossiers"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">ou</p>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            data-zone="import.bouton-fichiers"
            variant="outline"
            size="sm"
            disabled={importing}
            onClick={() => void chooseFiles()}
            className="border-[#d9a94e]/40 text-[#d9a94e] hover:bg-[#d9a94e]/10 hover:text-[#e3b75f]"
          >
            <Upload className="h-3.5 w-3.5" />
            Importer un fichier
          </Button>
          <Button
            data-zone="import.bouton-dossier"
            variant="outline"
            size="sm"
            disabled={importing}
            onClick={() => void chooseFolder()}
            className="border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Importer un dossier
          </Button>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <Checkbox checked={recursive} disabled={importing} onCheckedChange={(c) => toggleRecursive(c === true)} />
          Importer le contenu des sous-dossiers
        </label>
        {active && snapshot?.scan ? (
          <ScanLine scan={snapshot.scan} scanning={phase === "scanning"} />
        ) : (
          <p className="text-[11px] text-muted-foreground">JPG · PNG · GIF · WebP · MP4 · MKV · MOV · AVI · PDF · PPT · XLS · DOC…</p>
        )}
      </div>

      <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <FileWarning className="h-3.5 w-3.5 text-[#d9a94e]" />
          Les fichiers non pris en charge sont ignorés (et comptés).
        </p>
        <p className="flex items-center gap-1.5">
          <FileWarning className="h-3.5 w-3.5 text-[#d9a94e]" />
          Les fichiers restent à leur place : MyBoard les référence sans les copier, les déplacer ni les modifier.
        </p>
      </div>
    </section>
  );
}
