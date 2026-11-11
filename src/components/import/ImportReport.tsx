// Bilan de fin d'import (IMP-45 ; choix du 09/11 : à la fin de chaque import, puis la restauration DEL-05 s'il y a
// lieu) : « X importés sur Y », erreurs avec le nom des fichiers, fichiers disparus (IMP-54) ; avec une compression ou
// une conversion : taux moyen, place gagnée, poids avant / après, détail images / vidéos au survol. Après « Terminer
// ici » : ce qui n'a pas été traité ; après « Annuler l'import » : ce qui a été défait (réponse Q12 A du 11/11). Monté
// dans App : il s'ouvre même si l'on a quitté la page Importer.

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { HoverCard } from "@/components/ui/hover-card";
import { Modal } from "@/components/ui/modal";
import { api, type ImportProgress, type ImportResult } from "@/lib/api";
import { formatBytes, formatNumber, plural } from "@/lib/format";
import { useImport } from "@/stores/import";
import { compressionLine, undoneText } from "./ImportProgress";

function Line({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  return (
    <div className="flex justify-between gap-6">
      <span>{label}</span>
      <span className="font-medium text-foreground tabular-nums">{formatNumber(value)}</span>
    </div>
  );
}

/** « 42 % plus léger, 1,2 Go gagnés » ; une conversion peut aussi alourdir (IMP-70). */
function weights(before: number, after: number): { rate: string; gained: string } {
  const rate = before > 0 ? Math.round(((before - after) / before) * 100) : 0;
  return {
    rate: rate >= 0 ? `${rate} % plus léger` : `${-rate} % plus lourd`,
    gained: before >= after ? formatBytes(before - after) : `aucune (${formatBytes(after - before)} de plus)`,
  };
}

function Compression({ p }: { p: ImportProgress }) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const before = p.imagesBefore + p.videosBefore;
  const after = p.imagesAfter + p.videosAfter;
  const details = compressionLine(p);
  if (before === 0 && details === "") return null;
  const total = weights(before, after);
  const detail = (label: string, b: number, a: number, count: number) =>
    count > 0 && (
      <span className="block">
        {label} ({formatNumber(count)}) : {formatBytes(b)} → {formatBytes(a)}, {weights(b, a).rate}
      </span>
    );
  return (
    <div data-zone="import.bilan.compression" className="mt-4 rounded-lg border border-border p-3">
      <p className="mb-2 text-[10px] font-semibold tracking-wider uppercase">Compression et conversion</p>
      {before > 0 && (
        <div
          className="space-y-1"
          onMouseEnter={(e) => setAnchor(e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => setAnchor(null)}
        >
          <div className="flex justify-between gap-6">
            <span>Taux moyen</span>
            <span className="font-medium text-foreground">{total.rate}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span>Place gagnée</span>
            <span className="font-medium text-foreground">{total.gained}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span>Poids avant → après</span>
            <span className="font-medium text-foreground tabular-nums">
              {formatBytes(before)} → {formatBytes(after)}
            </span>
          </div>
          {anchor && (
            <HoverCard anchor={anchor} place="side" zone="import.bilan.compression.bulle">
              {detail("Images", p.imagesBefore, p.imagesAfter, p.compressed + p.converted)}
              {detail("Vidéos", p.videosBefore, p.videosAfter, p.videosCompressed + p.videosConverted)}
            </HoverCard>
          )}
        </div>
      )}
      {details !== "" && <p className="mt-2 text-xs">{details}</p>}
    </div>
  );
}

function FileList({ title, total, items }: { title: string; total: number; items: { path: string; message?: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="mb-1 text-[10px] font-semibold tracking-wider uppercase">
        {title} ({formatNumber(total)}){total > items.length && ` — les ${formatNumber(items.length)} premiers`}
      </p>
      <ul className="max-h-36 space-y-1 overflow-y-auto overscroll-contain pr-1">
        {items.map((f) => (
          <li key={f.path} className="rounded-md border border-border bg-background/40 px-2 py-1 text-xs" title={f.message ? `${f.path}\n${f.message}` : f.path}>
            <span className="block truncate text-foreground">{f.path.split(/[\\/]/).pop()}</span>
            {f.message && <span className="block truncate text-[10px] text-rose-300/80">{f.message}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function title(r: ImportResult): string {
  if (r.undone) return "Import annulé";
  if (r.fatal) return "Import interrompu par une erreur";
  return r.cancelled ? "Import terminé avant la fin de la liste" : "Import terminé";
}

function Body({ p, r }: { p: ImportProgress; r: ImportResult }) {
  if (r.undone) {
    return <p>{`Tout l'import a été défait : ${undoneText(r.undone)}. Vos fichiers d'origine n'ont pas été touchés.`}</p>;
  }
  return (
    <>
      <p className="text-base text-foreground">
        <span className="font-semibold text-[#d9a94e] tabular-nums">{formatNumber(p.imported)}</span>{" "}
        {plural(p.imported, "importé")} sur <span className="tabular-nums">{formatNumber(p.total)}</span>
      </p>
      <div className="mt-3 space-y-1">
        <Line label="Déjà présents" value={p.alreadyPresent} />
        <Line label="Mis à jour (fichier modifié)" value={p.updated} />
        <Line label="Doublons ignorés" value={p.duplicates} />
        <Line label="Retrouvés à un autre endroit" value={p.relocated} />
        <Line label="Écartés (paires)" value={p.setAside} />
        <Line label="Non traités (Terminer ici)" value={r.cancelled ? p.total - p.processed : 0} />
        <Line label="Supprimés du disque" value={p.deleted} />
        <Line label="Suppressions impossibles" value={p.deleteFailed} />
        <Line label="Erreurs" value={p.errors} />
        <Line label="Fichiers disparus pendant l'import" value={p.vanished} />
      </div>
      <Compression p={p} />
      {r.fatal && <p className="mt-4 text-rose-400">{r.fatal}</p>}
      <FileList title="Fichiers en erreur" total={p.errors} items={r.errorFiles} />
      <FileList title="Fichiers disparus pendant l'import" total={p.vanished} items={r.vanishedFiles.map((path) => ({ path }))} />
    </>
  );
}

export function ImportReport() {
  const snapshot = useImport((s) => s.snapshot);
  const result = snapshot?.result;
  const progress = snapshot?.progress;
  if (snapshot?.phase !== "finished" || !result || !progress || result.reported) return null;
  const close = () => void api.importReportSeen();
  return (
    <Modal
      open
      even
      zone="import.bilan"
      onClose={close}
      onEnter={close}
      title={title(result)}
      footer={
        <Button data-zone="import.bilan.fermer" onClick={close} className="bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]">
          Fermer
        </Button>
      }
    >
      <div className="text-sm text-muted-foreground">
        <Body p={progress} r={result} />
      </div>
    </Modal>
  );
}
