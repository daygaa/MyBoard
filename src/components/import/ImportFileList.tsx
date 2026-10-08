"use client";

// MyBoard — Liste des fichiers sélectionnés pour import (Phase 2 — imp-12 / imp-13).
// Affichée SOUS la barre d'actions (rendu par ImportFlow, pas dans ImportDropzone).
//
// Pour chaque fichier :
// - Aperçu thumbnail si image (via URL.createObjectURL)
// - Première frame si vidéo (via <video muted preload="metadata">)
// - Icône par type sinon (document, audio…)
// Cap à 100 entrées affichées + "et X de plus…" pour éviter un DOM trop lourd.

import { useEffect, useMemo, useRef } from "react";
import {
  X,
  Trash2,
  FileVideo,
  FileAudio,
  FileText,
  File as FileIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  IMAGE_EXTS,
  VIDEO_EXTS,
  formatBytes,
  kindFromExt,
} from "@/lib/shared";

const DISPLAY_CAP = 100;

/** Extrait l'extension (avec le point, en minuscules). */
function extOf(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx < 0) return "";
  return name.slice(idx).toLowerCase();
}

/** Icône Lucide pour les fichiers sans aperçu. */
function iconForKind(kind: string) {
  const cls = "h-5 w-5 shrink-0";
  switch (kind) {
    case "audio":
      return <FileAudio className={`${cls} text-fuchsia-300`} />;
    case "document":
      return <FileText className={`${cls} text-emerald-300`} />;
    case "image":
      return <FileIcon className={`${cls} text-muted-foreground`} />;
    case "video":
      return <FileVideo className={`${cls} text-amber-300`} />;
    default:
      return <FileIcon className={`${cls} text-muted-foreground`} />;
  }
}

/** Hook : crée un object URL pour un File et le révoque au changement/unmount. */
function useObjectUrl(file: File | null): string | null {
  // L'URL est dérivée du file (useMemo) — pas de setState-in-effect.
  // URL.createObjectURL est une API browser synchrone, l'appel pendant le rendu
  // est acceptable (pas de mutation React, juste un enregistrement dans le browser).
  const url = useMemo(() => {
    if (!file) return null;
    try {
      return URL.createObjectURL(file);
    } catch {
      return null;
    }
  }, [file]);

  // Cleanup : révoque l'URL quand elle change ou au unmount.
  useEffect(() => {
    if (!url) return;
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [url]);

  return url;
}

/** Tuile d'aperçu pour un fichier (image → img, vidéo → video frame, sinon icône). */
function FileThumb({ file }: { file: File }) {
  const ext = extOf(file.name);
  const isImage = IMAGE_EXTS.has(ext);
  const isVideo = VIDEO_EXTS.has(ext);
  const url = useObjectUrl(isImage || isVideo ? file : null);
  const kind = kindFromExt(ext);

  if (isImage && url) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        className="h-12 w-12 shrink-0 rounded-md border border-border object-cover"
      />
    );
  }
  if (isVideo && url) {
    return (
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        className="h-12 w-12 shrink-0 rounded-md border border-border object-cover"
      />
    );
  }
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-border bg-background/60">
      {iconForKind(kind)}
    </div>
  );
}

type Props = {
  files: File[];
  onRemove: (idx: number) => void;
  onClear: () => void;
  disabled?: boolean;
};

export function ImportFileList({
  files,
  onRemove,
  onClear,
  disabled = false,
}: Props) {
  const totalSize = useMemo(
    () => files.reduce((sum, f) => sum + f.size, 0),
    [files]
  );
  const listRef = useRef<HTMLUListElement>(null);

  if (files.length === 0) return null;

  const shown = files.slice(0, DISPLAY_CAP);
  const remaining = files.length - shown.length;

  return (
    <Card className="border-border bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Fichiers sélectionnés
            <span className="rounded bg-[#d9a94e]/15 px-1.5 py-0.5 font-mono text-xs font-medium text-[#d9a94e] tabular-nums">
              {files.length}
            </span>
          </CardTitle>
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              <span className="tabular-nums">{formatBytes(totalSize)}</span>
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={disabled}
              className="h-7 gap-1.5 text-muted-foreground hover:text-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Tout vider
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul
          ref={listRef}
          className="max-h-96 space-y-1 overflow-y-auto pr-1"
          style={{ scrollbarWidth: "thin" }}
        >
          {shown.map((f, idx) => {
            const ext = extOf(f.name);
            return (
              <li
                key={`${f.name}-${idx}-${f.size}-${f.lastModified}`}
                className="flex items-center gap-3 rounded-md border border-border bg-background/40 px-2.5 py-2 transition-colors hover:border-[#d9a94e]/30"
              >
                <FileThumb file={f} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground" title={f.name}>
                    {f.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    <span className="tabular-nums">{formatBytes(f.size)}</span>
                    {ext && (
                      <>
                        {" · "}
                        <span className="font-mono uppercase">{ext.slice(1)}</span>
                      </>
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-rose-300"
                  onClick={() => onRemove(idx)}
                  disabled={disabled}
                  aria-label={`Retirer ${f.name}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
          {remaining > 0 && (
            <li className="px-2.5 py-3 text-center text-xs italic text-muted-foreground">
              et {remaining} de plus…
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
