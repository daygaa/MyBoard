"use client";

// MyBoard — Orchestrateur client de la page import (Phase 2 refonte).
//
// Layout DOM (imp-8, imp-12) :
//   1. grid grid-cols-1 lg:grid-cols-3 : ImportDropzone (2/3) + ImportOptions (1/3)
//   2. DefaultTagsEditor (pleine largeur, sous la grille, au-dessus de la barre d'actions)
//   3. Barre d'actions principale (sticky)
//   4. ImportFileList (sous la barre d'actions — imp-12)
//   5. ImportProgress
//
// Stratégie de progression : un POST /api/import par fichier (séquentiel) pour
// avoir un retour par fichier + barre de progression incrémentale, sans avoir
// à gérer du polling / jobId côté serveur.

import { useCallback, useRef, useState } from "react";
import { Upload, Play, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImportDropzone } from "./ImportDropzone";
import { ImportFileList } from "./ImportFileList";
import { ImportOptions } from "./ImportOptions";
import { DefaultTagsEditor } from "./DefaultTagsEditor";
import { ImportProgress } from "./ImportProgress";
import type {
  DefaultTag,
  ImportFileResult,
  ImportOptions as Options,
} from "@/lib/import-processing";
import { formatBytes } from "@/lib/shared";

const DEFAULT_OPTIONS: Options = {
  compressImages: false,
  jpegQuality: 85,
  convertImageFormat: null,
  transcodeVideo: false,
  videoFormat: "mp4-h264",
  videoQuality: 2,
  defaultTags: [],
};

type RunStatus = "idle" | "running" | "done";

export function ImportFlow() {
  const [files, setFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [results, setResults] = useState<ImportFileResult[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number | null>(null);
  const [rejectedCount, setRejectedCount] = useState(0);

  // Ref pour la cancellation : le state ne marche pas dans la closure du loop
  const cancelRef = useRef(false);

  const addFiles = useCallback((newFiles: File[]) => {
    setFiles((prev) => {
      // Déduplication simple par nom+taille+date pour éviter les ajouts en double
      const seen = new Set(
        prev.map((f) => `${f.name}|${f.size}|${f.lastModified}`)
      );
      const filtered = newFiles.filter(
        (f) => !seen.has(`${f.name}|${f.size}|${f.lastModified}`)
      );
      return [...prev, ...filtered];
    });
  }, []);

  const removeFile = useCallback((idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const clearFiles = useCallback(() => setFiles([]), []);

  const handleRejected = useCallback((count: number) => {
    setRejectedCount((c) => c + count);
  }, []);

  const setDefaultTags = useCallback((next: DefaultTag[]) => {
    setOptions((o) => ({ ...o, defaultTags: next }));
  }, []);

  const runImport = useCallback(async () => {
    if (files.length === 0 || status === "running") return;

    setStatus("running");
    setResults([]);
    setLogs([]);
    setCurrentIdx(0);
    cancelRef.current = false;

    const opts = options;
    const allResults: ImportFileResult[] = [];
    const allLogs: string[] = [];
    const total = files.length;

    allLogs.push(
      `--- Début de l'import : ${total} fichier${total > 1 ? "s" : ""} · ${formatBytes(
        files.reduce((s, f) => s + f.size, 0)
      )} ---`
    );
    setLogs([...allLogs]);

    for (let i = 0; i < total; i++) {
      if (cancelRef.current) {
        allLogs.push("[ANNULÉ] Arrêt demandé par l'utilisateur");
        setLogs([...allLogs]);
        break;
      }
      const file = files[i];
      setCurrentIdx(i);
      allLogs.push(`[${i + 1}/${total}] ${file.name} (${formatBytes(file.size)})`);
      setLogs([...allLogs]);

      try {
        const fd = new FormData();
        fd.append("files", file, file.name);
        fd.append("options", JSON.stringify(opts));

        const res = await fetch("/api/import", { method: "POST", body: fd });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data) {
          const err = data?.error ?? `HTTP ${res.status}`;
          allLogs.push(`  ✗ Erreur : ${err}`);
          allResults.push({
            file: file.name,
            status: "error",
            error: err,
            originalSize: file.size,
          });
        } else {
          const r: ImportFileResult | undefined = data.results?.[0];
          if (!r) {
            allLogs.push(`  ✗ Réponse vide du serveur`);
            allResults.push({
              file: file.name,
              status: "error",
              error: "Réponse vide",
              originalSize: file.size,
            });
          } else {
            allResults.push(r);
            if (r.status === "imported") {
              allLogs.push(`  ✓ Importé · sha ${r.sha?.slice(0, 10)}…`);
              if (r.transformed && r.transformKind && r.size && r.originalSize) {
                const tag =
                  r.transformKind === "webp"
                    ? "WebP"
                    : r.transformKind === "compressed"
                      ? "compressé/converti"
                      : r.transformKind === "video"
                        ? "transcodé"
                        : "transformé";
                allLogs.push(
                  `  → ${tag} : ${formatBytes(r.originalSize)} → ${formatBytes(r.size)}`
                );
              }
              if (r.warning) allLogs.push(`  ⚠ ${r.warning}`);
            } else if (r.status === "duplicate") {
              allLogs.push(`  ⊘ Doublon ignoré · sha ${r.sha?.slice(0, 10)}…`);
            } else {
              allLogs.push(`  ✗ ${r.error ?? "Erreur inconnue"}`);
            }
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        allLogs.push(`  ✗ Exception : ${msg}`);
        allResults.push({
          file: file.name,
          status: "error",
          error: msg,
          originalSize: file.size,
        });
      }

      setResults([...allResults]);
      setLogs([...allLogs]);
      setCurrentIdx(null);
    }

    allLogs.push(
      `--- Terminé : ${
        allResults.filter((r) => r.status === "imported").length
      } importé(s), ${
        allResults.filter((r) => r.status === "duplicate").length
      } doublon(s), ${
        allResults.filter((r) => r.status === "error").length
      } erreur(s) ---`
    );
    setLogs([...allLogs]);
    setStatus("done");
    setCurrentIdx(null);
  }, [files, options, status]);

  const cancelImport = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const closeProgress = useCallback(() => {
    setStatus("idle");
    setResults([]);
    setLogs([]);
    setCurrentIdx(null);
    // On garde les files et options en place : l'utilisateur peut relancer
  }, []);

  const importedCount = results.filter((r) => r.status === "imported").length;
  const dupCount = results.filter((r) => r.status === "duplicate").length;
  const errCount = results.filter((r) => r.status === "error").length;

  return (
    <div className="space-y-5">
      {/* 1. Grid : Dropzone (2/3) + Options (1/3) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ImportDropzone
            files={files}
            onAdd={addFiles}
            disabled={status === "running"}
            onRejected={handleRejected}
          />
        </div>
        <div className="lg:col-span-1">
          <ImportOptions
            options={options}
            onChange={setOptions}
            disabled={status === "running"}
          />
        </div>
      </div>

      {/* 2. Tags par défaut (imp-8 : sous la grille, au-dessus de la barre d'actions) */}
      <DefaultTagsEditor
        defaultTags={options.defaultTags}
        onChange={setDefaultTags}
        disabled={status === "running"}
      />

      {/* 3. Barre d'action principale — contient désormais aussi la progression (P4 4.4) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/40 px-4 py-3">
        {/* Ligne d'actions (toujours visible) */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {status === "running" ? (
            <span className="inline-flex items-center gap-2 text-[#d9a94e]">
              <Play className="h-4 w-4" />
              Import en cours…
            </span>
          ) : status === "done" ? (
            <span>
              <span className="font-semibold text-emerald-400 tabular-nums">
                {importedCount}
              </span>{" "}
              importé{importedCount > 1 ? "s" : ""} ·{" "}
              <span className="font-semibold text-amber-400 tabular-nums">
                {dupCount}
              </span>{" "}
              doublon{dupCount > 1 ? "s" : ""} ·{" "}
              <span className="font-semibold text-rose-400 tabular-nums">
                {errCount}
              </span>{" "}
              erreur{errCount > 1 ? "s" : ""}
            </span>
          ) : files.length > 0 ? (
            <span>
              Prêt à importer{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {files.length}
              </span>{" "}
              fichier{files.length > 1 ? "s" : ""}
            </span>
          ) : (
            <span>Aucun fichier sélectionné</span>
          )}
        </div>

        <Button
          onClick={runImport}
          disabled={files.length === 0 || status === "running"}
          className="bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f] focus-visible:ring-[#d9a94e]/40"
        >
          <Upload className="h-4 w-4" />
          {status === "running"
            ? "Import en cours…"
            : `Importer${files.length > 0 ? ` (${files.length})` : ""}`}
        </Button>

        {/* Progression — intégrée à la barre d'actions (P4 4.4)
            Cachée au repos, s'affiche pendant l'import, placée au-dessus de la
            liste des fichiers sélectionnés. Ne remplace PAS la zone d'options. */}
        {status !== "idle" && (
          <ImportProgress
            status={status}
            total={files.length}
            processed={results.length}
            currentIdx={currentIdx}
            results={results}
            logs={logs}
            defaultTags={options.defaultTags}
            onCancel={cancelImport}
            onClose={closeProgress}
          />
        )}
      </div>

      {/* Notification : fichiers rejetés (extensions non supportées) */}
      {rejectedCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {rejectedCount} fichier{rejectedCount > 1 ? "s" : ""} non supporté
            {rejectedCount > 1 ? "s" : ""} ignoré
            {rejectedCount > 1 ? "s" : ""} (extension non reconnue)
          </span>
          <button
            type="button"
            onClick={() => setRejectedCount(0)}
            aria-label="Fermer l'avertissement"
            className="rounded p-1 transition hover:bg-amber-500/20"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 4. Liste des fichiers sélectionnés (imp-12 : sous la barre d'actions) */}
      <ImportFileList
        files={files}
        onRemove={removeFile}
        onClear={clearFiles}
        disabled={status === "running"}
      />
    </div>
  );
}
