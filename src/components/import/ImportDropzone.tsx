"use client";

// MyBoard — Dropzone pour l'import (Phase 2 refonte).
// - Card avec min-h pour bien remplir la colonne (imp-10)
// - Drag-drop de fichiers + de dossiers complets (imp-11)
//   * <input webkitdirectory> caché + bouton "Parcourir un dossier"
//   * DataTransferItem.webkitGetAsEntry() + récursion pour le drag-drop de dossiers
// - Filtrage des extensions (imp-14) : images/vidéos/audio + PDF/PPT/XLS uniquement
// - La liste des fichiers sélectionnés n'est plus dans cette carte (imp-12) :
//   elle est rendue par ImportFileList dans ImportFlow, sous la barre d'actions.

import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  Upload,
  FolderOpen,
  FileWarning,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// NOTE: webkitdirectory et directory ne sont pas des propriétés React standard.
// On les pose via setAttribute dans un callback ref pour garantir qu'ils
// arrivent jusqu'au DOM (sinon React les ignore / les retire sur re-render).

// ---------------------------------------------------------------------------
// Extensions acceptées (imp-14)
// On accepte : images / vidéos / audio + PDF/PPT/PPTX/XLS/XLSX
// On rejette silencieusement tout le reste.
// ---------------------------------------------------------------------------

const ACCEPTED_EXTENSIONS = new Set<string>([
  // Images
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp",
  ".tif", ".tiff", ".heic", ".heif", ".avif",
  // Vidéos
  ".mp4", ".webm", ".mkv", ".mov", ".m4v", ".avi",
  ".ts", ".m2ts", ".wmv",
  // Audio
  ".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac",
  // Documents (PDF + Office tableur/présentation uniquement)
  ".pdf", ".ppt", ".pptx", ".xls", ".xlsx",
]);

/** Extrait l'extension (avec le point, en minuscules) à partir d'un nom de fichier. */
function extOf(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx < 0) return "";
  return name.slice(idx).toLowerCase();
}

/** Filtre les fichiers supportés. Renvoie {accepted, rejectedCount}. */
function filterSupported(files: File[]): { accepted: File[]; rejected: number } {
  const accepted: File[] = [];
  let rejected = 0;
  for (const f of files) {
    if (ACCEPTED_EXTENSIONS.has(extOf(f.name))) {
      accepted.push(f);
    } else {
      rejected++;
    }
  }
  return { accepted, rejected };
}

// ---------------------------------------------------------------------------
// FileSystem API — pour le drag-drop de dossiers (imp-11)
// ---------------------------------------------------------------------------

type FsEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file: (cb: (f: File) => void) => void;
  createReader: () => {
    readEntries: (cb: (entries: FsEntry[]) => void) => void;
  };
};

/** Lit toutes les entrées d'un dossier (par batches de 100, jusqu'à épuisement). */
function readAllDirEntries(dir: FsEntry): Promise<FsEntry[]> {
  return new Promise((resolve) => {
    const reader = dir.createReader();
    const all: FsEntry[] = [];
    const readBatch = () => {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          resolve(all);
        } else {
          all.push(...entries);
          readBatch();
        }
      });
    };
    readBatch();
  });
}

/** Récupère récursivement tous les fichiers d'une FileSystemEntry (fichier ou dossier). */
async function collectFilesFromEntry(entry: FsEntry | null): Promise<File[]> {
  if (!entry) return [];
  if (entry.isFile) {
    return new Promise<File[]>((resolve) => {
      entry.file((f) => resolve([f]));
    });
  }
  if (entry.isDirectory) {
    const children = await readAllDirEntries(entry);
    const nested = await Promise.all(
      children.map((c) => collectFilesFromEntry(c))
    );
    return nested.flat();
  }
  return [];
}

/** Extrait tous les fichiers d'un événement drag-drop, en supportant les dossiers. */
async function extractDroppedFiles(e: DragEvent<HTMLDivElement>): Promise<File[]> {
  const items = e.dataTransfer.items;
  if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === "function") {
    // Lecture async des entrées (dossiers pris en charge)
    const entries: (FsEntry | null)[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file") {
        // webkitGetAsEntry doit être appelé synchronément dans le handler
        entries.push((it.webkitGetAsEntry?.() as unknown as FsEntry) ?? null);
      }
    }
    const all = await Promise.all(entries.map((en) => collectFilesFromEntry(en)));
    return all.flat();
  }
  // Fallback : API files classique
  if (e.dataTransfer.files?.length) {
    return Array.from(e.dataTransfer.files);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

type Props = {
  files: File[];
  onAdd: (newFiles: File[]) => void;
  disabled?: boolean;
  /** Nombre de fichiers rejetés à l'ajout (pour afficher un warning côté parent). */
  onRejected?: (count: number) => void;
};

export function ImportDropzone({
  files: _files,
  onAdd,
  disabled = false,
  onRejected,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Pose les attributs non-standard webkitdirectory / directory sur l'input
  // dédié aux dossiers. Utilisé via useEffect (plus fiable que callback ref
  // qui peut être appelé avec null lors d'un re-render, retirant les attributs).
  useEffect(() => {
    const el = folderInputRef.current;
    if (!el) return;
    el.setAttribute("webkitdirectory", "");
    el.setAttribute("directory", "");
    // Note: mozdirectory n'existe pas officiellement mais certains navigateurs
    // anciens le supportent. On l'ajoute pour compat.
    el.setAttribute("mozdirectory", "");
  }, []);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(0);
    setIsDragging(false);
    if (disabled) return;
    void extractDroppedFiles(e).then((all) => {
      const { accepted, rejected } = filterSupported(all);
      if (accepted.length > 0) onAdd(accepted);
      if (rejected > 0) onRejected?.(rejected);
    });
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((c) => c + 1);
    if (!disabled) setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((c) => {
      const next = c - 1;
      if (next <= 0) setIsDragging(false);
      return next;
    });
  }

  function handleBrowseChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      const all = Array.from(e.target.files);
      const { accepted, rejected } = filterSupported(all);
      if (accepted.length > 0) onAdd(accepted);
      if (rejected > 0) onRejected?.(rejected);
    }
    e.target.value = "";
  }

  return (
    <Card className="flex h-full min-h-[418px] flex-col border-border bg-card/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Upload className="h-4 w-4 text-[#d9a94e]" />
          Fichiers
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {/* Drop zone (remplit l'espace restant de la carte) */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Zone de dépôt de fichiers — glissez-déposez ou cliquez pour parcourir"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !disabled) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={`group relative flex flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
            isDragging
              ? "border-[#d9a94e] bg-[#d9a94e]/5 ring-2 ring-[#d9a94e]/20"
              : "border-border bg-background/40 hover:border-[#d9a94e]/50 hover:bg-[#d9a94e]/[0.03]"
          } ${disabled ? "pointer-events-none opacity-50" : ""}`}
        >
          {/* Input fichier (multiple) */}
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleBrowseChange}
            disabled={disabled}
            aria-hidden="true"
            tabIndex={-1}
          />
          {/* Input dossier (webkitdirectory) — attributs posés via useEffect */}
          <input
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleBrowseChange}
            disabled={disabled}
            aria-hidden="true"
            tabIndex={-1}
          />
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[#d9a94e]/15 ring-1 ring-[#d9a94e]/30 transition-transform group-hover:scale-105">
            <Upload className="h-6 w-6 text-[#d9a94e]" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              {isDragging ? "Déposez vos fichiers ou dossiers ici" : "Glissez-déposez vos fichiers ou dossiers"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">ou</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-[#d9a94e]/40 text-[#d9a94e] hover:bg-[#d9a94e]/10 hover:text-[#e3b75f]"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!disabled) inputRef.current?.click();
                }}
                disabled={disabled}
              >
                <Upload className="h-3.5 w-3.5" />
                Importer un fichier
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!disabled) folderInputRef.current?.click();
                }}
                disabled={disabled}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Importer un dossier
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            JPG · PNG · GIF · WebP · MP4 · MKV · MOV · AVI · PDF · PPT · XLS…
          </p>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <FileWarning className="h-3.5 w-3.5 text-[#d9a94e]" />
          Les fichiers non supportés sont ignorés silencieusement.
        </p>
      </CardContent>
    </Card>
  );
}
