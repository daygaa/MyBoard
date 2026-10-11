// Vignette de la grille (GRID-08), apparence v8 : carrée, survol = nom, poids, dimensions ;
// badge durée pour les vidéos, badge GIF. L'étoile favori et la case de sélection
// arrivent en phase 3, l'ouverture dans la visionneuse en phase 2.
//
// Taille de l'image selon la densité : 128 px pour les grilles denses (LIB-12), 320 px sinon,
// et grand aperçu 640 px par-dessus pour 4–6 colonnes (LIB-09).
// Performance (D-008) : composant mémorisé, il ne se redessine que si SA miniature
// change ; aucun flou ni animation permanente.

import { memo, useRef, useState } from "react";
import { File, FileSpreadsheet, FileText, Film, Image as ImageIcon, Music, Play } from "lucide-react";

import { usePreview } from "@/hooks/usePreview";
import { THUMB, thumbUrl, type MediaItem } from "@/lib/api";
import { formatBytes, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useThumbs } from "@/stores/thumbs";

const SHEETS = ["xls", "xlsx", "xlsm", "ods", "csv", "gsheet"];
const WORD = ["doc", "docx", "odt"];

/** Icône à la place de l'image : audio, documents, miniature pas encore prête ou en échec. */
function Placeholder({ item, status, compact }: { item: MediaItem; status: number; compact: boolean }) {
  let Icon = File;
  let color = "text-zinc-400";
  if (item.kind === "audio") {
    Icon = Music;
    color = "text-amber-300/80";
  } else if (item.kind === "document") {
    if (item.ext === "pdf") [Icon, color] = [FileText, "text-rose-300"];
    else if (SHEETS.includes(item.ext)) [Icon, color] = [FileSpreadsheet, "text-emerald-300"];
    else if (WORD.includes(item.ext)) color = "text-sky-300";
  } else if (status === THUMB.todo) {
    // Miniature en cours de création : icône discrète, sans animation.
    Icon = item.kind === "video" ? Film : ImageIcon;
    color = "text-zinc-700";
  } else {
    Icon = item.kind === "video" ? Film : ImageIcon;
  }
  return (
    <div className={cn("flex h-full w-full flex-col items-center justify-center gap-2", color)}>
      <Icon className="h-[34%] max-h-10 w-[34%] max-w-10 opacity-80" />
      {!compact && status !== THUMB.todo && (
        <span className="text-xs font-bold tracking-wider uppercase">{item.ext}</span>
      )}
    </div>
  );
}

/** Badge durée (vidéo) ou GIF. */
function Badge({ video, duration, className }: { video: boolean; duration: number | null; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-white shadow",
        video ? "font-semibold" : "font-bold uppercase",
        className,
      )}
    >
      {video ? (
        <>
          <Play className="h-2.5 w-2.5 fill-white" />
          {formatDuration(duration) || "VID"}
        </>
      ) : (
        "GIF"
      )}
    </span>
  );
}

type TileProps = {
  item: MediaItem;
  compact: boolean;
  /** Miniatures 128 px (grilles denses, LIB-12). */
  small: boolean;
  /** Grand aperçu 640 px (4–6 colonnes, LIB-09). */
  preview: boolean;
};

export const MediaTile = memo(function MediaTile({ item, compact, small, preview }: TileProps) {
  const ref = useRef<HTMLDivElement>(null);
  const update = useThumbs((s) => s.updates[item.id]);
  const [failed, setFailed] = useState(false);
  const [smallFailed, setSmallFailed] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const status = update?.status ?? item.thumbStatus;
  const ready = status === THUMB.ready && !failed;
  const previewReady = usePreview(ref, item.id, preview && ready && !previewFailed);
  const width = update?.width ?? item.width;
  const height = update?.height ?? item.height;
  const duration = update?.durationMs ?? item.durationMs;
  const isVideo = item.kind === "video";
  const hasBadge = isVideo || item.ext === "gif";

  return (
    <div
      ref={ref}
      data-zone="grille.vignette"
      title={item.fileName}
      className="group relative block aspect-square w-full overflow-hidden rounded-lg bg-[#0d0e12] ring-1 ring-border transition-all duration-200 hover:ring-[#d9a94e]/60"
    >
      {ready ? (
        <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-105">
          <img
            src={thumbUrl(item.hash, small && !smallFailed ? "small" : "normal")}
            alt=""
            decoding="async"
            draggable={false}
            // Miniature 128 px pas encore créée (ancienne bibliothèque) : on prend la 320 px.
            onError={() => (small && !smallFailed ? setSmallFailed(true) : setFailed(true))}
            className="h-full w-full object-cover"
          />
          {preview && previewReady && !previewFailed && (
            <img
              src={thumbUrl(item.hash, "preview")}
              alt=""
              decoding="async"
              draggable={false}
              // Apparaît une fois chargé, par-dessus la miniature : pas de case vide entre les deux.
              onLoad={(e) => (e.currentTarget.dataset.loaded = "")}
              onError={() => setPreviewFailed(true)}
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-200 data-loaded:opacity-100"
            />
          )}
        </div>
      ) : (
        <Placeholder item={item} status={failed ? THUMB.error : status} compact={compact} />
      )}

      {/* Badge en bas à droite ; au survol, il remonte sur la ligne du nom (GRID-09). */}
      {hasBadge && (
        <Badge
          video={isVideo}
          duration={duration}
          className="absolute right-1.5 bottom-1.5 z-10 transition-opacity duration-200 group-hover:opacity-0"
        />
      )}

      {/* Survol : nom, poids, dimensions. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end gap-1 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <div className="space-y-1 px-2 pb-1.5">
          <div className="flex items-center gap-2">
            <p className="line-clamp-1 min-w-0 flex-1 text-xs font-medium text-white drop-shadow">{item.fileName}</p>
            {hasBadge && <Badge video={isVideo} duration={duration} />}
          </div>
          <div className="flex items-center justify-between font-mono text-[10px] text-zinc-300">
            <span>{formatBytes(item.size)}</span>
            {width && height && (
              <span>
                {width}×{height}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
