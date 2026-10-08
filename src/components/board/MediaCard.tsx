"use client";

// MyBoard — Carte média (grille).
// Aspect carré, hover : overlay gradient sombre du bas + zoom doux + meta (nom/taille/dims).
// Badge durée vidéo (bottom-right), badge GIF (bottom-right).
// Favori (étoile, top-right) — met à jour l'état local pour feedback immédiat.
// Clic = ouvre la visionneuse ; shift+clic en mode batch = plage.

import { useState } from "react";
import {
  Play,
  FileText,
  FileSpreadsheet,
  File,
  Music,
  Archive,
  Star,
  Check,
} from "lucide-react";
import {
  formatBytes,
  formatDuration,
} from "@/lib/shared";
import type { MediaListItem } from "@/lib/types";
import { useBoardUI } from "./store";

type Props = {
  item: MediaListItem;
  index: number;
  onOpen: () => void;
};

/** Placeholder visuel pour les médias sans thumbnail (audio/docs/archives/autre). */
function Placeholder({ kind, ext }: { kind: string; ext: string }) {
  if (kind === "audio") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-amber-300/80">
        <Music className="h-10 w-10 opacity-80" />
        <span className="text-xs font-bold uppercase tracking-wider">{ext}</span>
      </div>
    );
  }
  if (kind === "archive") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-400">
        <Archive className="h-10 w-10 opacity-80" />
        <span className="text-xs font-bold uppercase tracking-wider">{ext}</span>
      </div>
    );
  }
  if (kind === "document") {
    const Icon =
      ext === "pdf"
        ? FileText
        : ["xls", "xlsx", "csv", "ods"].includes(ext)
          ? FileSpreadsheet
          : File;
    const color =
      ext === "pdf"
        ? "text-rose-300"
        : ["xls", "xlsx", "csv", "ods"].includes(ext)
          ? "text-emerald-300"
          : ["doc", "docx", "odt"].includes(ext)
            ? "text-sky-300"
            : "text-zinc-400";
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-2 ${color}`}
      >
        <Icon className="h-10 w-10 opacity-80" />
        <span className="text-xs font-bold uppercase tracking-wider">{ext}</span>
      </div>
    );
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-400">
      <File className="h-10 w-10 opacity-80" />
      <span className="text-xs font-bold uppercase tracking-wider">{ext}</span>
    </div>
  );
}

export function MediaCard({ item, index, onOpen }: Props) {
  const [errored, setErrored] = useState(false);
  // État local du favori pour feedback immédiat (sans attendre le router.refresh)
  const [isFav, setIsFav] = useState(item.favorite);
  const batchMode = useBoardUI((s) => s.batchMode);
  const selected = useBoardUI((s) => s.selected);
  const toggleSelect = useBoardUI((s) => s.toggleSelect);
  const selectRange = useBoardUI((s) => s.selectRange);
  const lastIdx = useBoardUI((s) => s.lastSelectedIdx);
  const setLastSelectedIdx = useBoardUI((s) => s.setLastSelectedIdx);

  const isSel = selected.has(item.id);
  const isVideo = item.kind === "video";
  const isGif = item.ext === "gif";

  const hasThumb = !!item.thumbUrl && !errored;

  function onClick(e: React.MouseEvent) {
    if (batchMode) {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey && lastIdx !== null && lastIdx !== index) {
        const a = Math.min(lastIdx, index);
        const b = Math.max(lastIdx, index);
        const ids = gridIdsRef.current?.slice(a, b + 1) ?? [item.id];
        selectRange(ids);
      } else {
        toggleSelect(item.id);
      }
      setLastSelectedIdx(index);
    } else {
      onOpen();
    }
  }

  async function toggleFavorite(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    // Optimistic UI : on inverse immédiatement l'étoile
    const next = !isFav;
    setIsFav(next);
    try {
      const res = await fetch(`/api/media/${item.id}/favorite`, { method: "POST" });
      if (!res.ok) {
        // Rollback si échec
        setIsFav(!next);
        return;
      }
      const data = await res.json();
      setIsFav(!!data.favorite);
      // Notifie les autres composants (visionneuse, etc.)
      window.dispatchEvent(
        new CustomEvent("mb-favorite-toggled", { detail: { id: item.id, favorite: data.favorite } })
      );
    } catch {
      setIsFav(!next);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative block aspect-square w-full overflow-hidden rounded-lg bg-[#0d0e12] ring-1 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9a94e] ${
        isSel
          ? "ring-2 ring-[#d9a94e]"
          : "ring-border hover:ring-[#d9a94e]/60"
      }`}
      aria-label={`Média ${item.originalName}`}
      title={item.originalName}
    >
      {/* Contenu image/placeholder */}
      {hasThumb ? (
        <img
          src={item.thumbUrl!}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setErrored(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <Placeholder kind={item.kind} ext={item.ext} />
      )}

      {/* Badge durée vidéo (bottom-right) */}
      {isVideo && (
        <span className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm shadow">
          <Play className="h-2.5 w-2.5 fill-white" />
          {formatDuration(item.duration) || "VID"}
        </span>
      )}

      {/* Badge GIF */}
      {isGif && !isVideo && (
        <span className="absolute bottom-1.5 right-1.5 z-10 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white backdrop-blur-sm shadow">
          GIF
        </span>
      )}

      {/* Favori (top-right) */}
      <span
        role="button"
        tabIndex={-1}
        aria-label={isFav ? "Retirer des favoris" : "Ajouter aux favoris"}
        onClick={toggleFavorite}
        className={`absolute right-1.5 top-1.5 z-10 grid h-6 w-6 place-items-center rounded bg-black/55 backdrop-blur-sm transition hover:bg-black/75 ${
          isFav ? "text-[#d9a94e]" : "text-zinc-300"
        }`}
      >
        <Star
          className={`h-3.5 w-3.5 ${isFav ? "fill-[#d9a94e]" : ""}`}
        />
      </span>

      {/* Checkbox batch si mode batch */}
      {batchMode && (
        <span
          className={`absolute left-1.5 top-9 z-10 grid h-5 w-5 place-items-center rounded-md border backdrop-blur-sm transition ${
            isSel
              ? "border-[#d9a94e] bg-[#d9a94e] text-[#1a1408]"
              : "border-white/40 bg-black/50 text-transparent"
          }`}
        >
          {isSel && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
      )}

      {/* Overlay hover : meta (nom + poids + dimensions) */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end gap-1 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <div className="space-y-1 px-2 pb-1.5">
          <p className="line-clamp-1 text-xs font-medium text-white drop-shadow">
            {item.originalName}
          </p>
          <div className="flex items-center justify-between font-mono text-[10px] text-zinc-300">
            <span>{formatBytes(item.size)}</span>
            {item.width && item.height && (
              <span>
                {item.width}×{item.height}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Singleton léger pour partager la liste ordonnée des ids de la grille
// (pour le shift+clic plage en mode batch).
// Le MediaGrid met à jour cette ref à chaque rendu.
// ---------------------------------------------------------------------------
export const gridIdsRef: { current: number[] | null } = { current: null };
