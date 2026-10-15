// Vignette de la grille (GRID-08), apparence v8 : carrée, survol = nom, poids, dimensions ;
// badge durée pour les vidéos, badge GIF. L'étoile favori et la case de sélection
// arrivent en phase 3, dans le calque réduit `tile-overlay` (GRID-10, remplace la réduction
// de SEL-05). Vignettes de moins de ~2,2 cm : nom seul, agrandi (GRID-11, index.css).
// Clic = visionneuse plein écran (VIEW-01) ; clic droit = menu de la vignette (CTX-05).
//
// Taille de l'image selon la densité : 128 px pour les grilles denses (LIB-12), 320 px sinon,
// et grand aperçu 640 px par-dessus pour 4–6 colonnes (LIB-09).
// Performance (D-008) : composant mémorisé, il ne se redessine que si SA miniature
// change ; aucun flou ni animation permanente.

import { memo, useRef, useState } from "react";
import { File, FileSpreadsheet, FileText, Film, Image as ImageIcon, Music, Play } from "lucide-react";

import { usePreview } from "@/hooks/usePreview";
import { THUMB, thumbUrl, type MediaItem } from "@/lib/api";
import { openContextMenu } from "@/lib/contextMenu";
import { formatBytes, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useThumbs } from "@/stores/thumbs";
import { useViewer } from "@/stores/viewer";
import { tileMenu } from "./tileMenu";

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

/** Taille normale du nom (classe `text-xs`) et taille maximale en mode « nom seul » (GRID-11) :
 *  la hauteur libérée par la ligne poids / dimensions (≈ 35 px dans le calque des infos). */
const NAME_PX = 12;
const NAME_MAX_PX = 28;
let ruler: CanvasRenderingContext2D | null = null;

/** Mode « nom seul » (GRID-11) : taille du nom pour qu'il tienne en entier sur une ligne dans
 *  toute la largeur, jamais plus petit que la taille normale (au-delà, « … »). Calculée au
 *  survol, pour la seule vignette survolée (D-008). */
function fitName(name: HTMLElement) {
  const info = name.closest<HTMLElement>(".tile-info");
  ruler ??= document.createElement("canvas").getContext("2d");
  if (!info || !ruler) return;
  const style = getComputedStyle(name);
  ruler.font = `${style.fontWeight} ${NAME_PX}px ${style.fontFamily}`;
  const textWidth = ruler.measureText(name.textContent ?? "").width;
  const box = getComputedStyle(info);
  const room = info.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight);
  // 2 % de marge : un arrondi ne doit pas faire apparaître « … » sur un nom qui tient.
  const size = Math.min(NAME_MAX_PX, Math.max(NAME_PX, (NAME_PX * room * 0.98) / textWidth));
  name.style.setProperty("--name-size", `${size.toFixed(2)}px`);
}

/** Badge durée (vidéo) ou GIF (masqué en mode « nom seul », GRID-11). */
function Badge({ video, duration, className }: { video: boolean; duration: number | null; className?: string }) {
  return (
    <span
      className={cn(
        "tile-chip flex shrink-0 items-center gap-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-white shadow",
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
  /** Position du média dans tous les résultats (pour la visionneuse, VIEW-04). */
  index: number;
  pageSize: number;
  compact: boolean;
  /** Miniatures 128 px (grilles denses, LIB-12). */
  small: boolean;
  /** Grand aperçu 640 px (4–6 colonnes, LIB-09). */
  preview: boolean;
};

export const MediaTile = memo(function MediaTile({ item, index, pageSize, compact, small, preview }: TileProps) {
  const ref = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLParagraphElement>(null);
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
      onClick={() => useViewer.getState().openAt(index, item, pageSize)}
      onContextMenu={(e) => openContextMenu(e, () => tileMenu(item, index, pageSize))}
      onMouseEnter={() => nameRef.current && fitName(nameRef.current)}
      className="group relative block aspect-square w-full cursor-pointer overflow-hidden rounded-lg bg-[#0d0e12] ring-1 ring-border transition-all duration-200 hover:ring-[#d9a94e]/60"
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

      {/* Dégradé du survol, sur toute la vignette. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

      {/* Badges et infos réduits avec la vignette quand elle est étroite (GRID-10). */}
      <div className="tile-overlay">
        {/* Badge en bas à droite ; au survol, il remonte sur la ligne du nom (GRID-09). */}
        {hasBadge && (
          <Badge
            video={isVideo}
            duration={duration}
            className="absolute right-1.5 bottom-1.5 z-10 transition-opacity duration-200 group-hover:opacity-0"
          />
        )}

        {/* Survol : nom, poids, dimensions. Hors survol, ni affichés ni dessinés (`invisible`) :
            changer de densité est ~20 % plus rapide à 30 colonnes (mesuré le 13/10, D-008). */}
        <div className="tile-info pointer-events-none invisible absolute inset-x-0 bottom-0 space-y-1 px-2 pb-1.5 opacity-0 transition-[opacity,visibility] duration-200 group-hover:visible group-hover:opacity-100">
          <div className="flex items-center gap-2">
            <p ref={nameRef} className="tile-name line-clamp-1 min-w-0 flex-1 text-xs font-medium text-white drop-shadow">
              {item.fileName}
            </p>
            {hasBadge && <Badge video={isVideo} duration={duration} />}
          </div>
          <div className="tile-meta flex items-center justify-between font-mono text-[10px] text-zinc-300">
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
