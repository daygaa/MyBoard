// Vignette de la grille (GRID-08), apparence v8 : carrée, survol = nom, poids, dimensions ;
// badge durée pour les vidéos, badge GIF. L'étoile favori et la case de sélection
// arrivent en phase 3, l'ouverture dans la visionneuse en phase 2.
//
// Performance (D-008) : composant mémorisé, il ne se redessine que si SA miniature
// change ; aucun flou ni animation permanente.

import { memo, useState } from "react";
import { File, FileSpreadsheet, FileText, Film, Image as ImageIcon, Music, Play } from "lucide-react";

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

export const MediaTile = memo(function MediaTile({ item, compact }: { item: MediaItem; compact: boolean }) {
  const update = useThumbs((s) => s.updates[item.id]);
  const [failed, setFailed] = useState(false);
  const status = update?.status ?? item.thumbStatus;
  const width = update?.width ?? item.width;
  const height = update?.height ?? item.height;
  const duration = update?.durationMs ?? item.durationMs;
  const isVideo = item.kind === "video";
  const isGif = item.ext === "gif";

  return (
    <div
      data-zone="grille.vignette"
      title={item.fileName}
      className="group relative block aspect-square w-full overflow-hidden rounded-lg bg-[#0d0e12] ring-1 ring-border transition-all duration-200 hover:ring-[#d9a94e]/60"
    >
      {status === THUMB.ready && !failed ? (
        <img
          src={thumbUrl(item.hash)}
          alt=""
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <Placeholder item={item} status={failed ? THUMB.error : status} compact={compact} />
      )}

      {isVideo && (
        <span className="absolute right-1.5 bottom-1.5 z-10 flex items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
          <Play className="h-2.5 w-2.5 fill-white" />
          {formatDuration(duration) || "VID"}
        </span>
      )}
      {isGif && (
        <span className="absolute right-1.5 bottom-1.5 z-10 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase shadow">
          GIF
        </span>
      )}

      {/* Survol : nom, poids, dimensions. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end gap-1 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <div className="space-y-1 px-2 pb-1.5">
          <p className="line-clamp-1 text-xs font-medium text-white drop-shadow">{item.fileName}</p>
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
