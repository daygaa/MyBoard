// Miniature d'une ligne de la liste avant l'import (IMP-10, IMP-13) : aperçu de Windows, sinon une icône. Après 0,5 s
// de survol, un aperçu agrandi de 256 px (taille du cache de l'Explorateur) s'affiche PAR-DESSUS, centré sur elle et
// décalé s'il sortait de la zone visible ; il disparaît quand la souris quitte la miniature (IMP-59).

import { useEffect, useRef, useState } from "react";
import { File, FileText, Film, Image as ImageIcon, Music } from "lucide-react";

import { scanPreviewUrl, type ScanEntry } from "@/lib/api";
import { SCROLLER_ID } from "@/lib/scroller";

const HOVER_DELAY = 500;
const MARGIN = 8;

/** Fichiers qui ont un aperçu (les autres : une icône, comme dans la grille). */
const hasPreview = (e: ScanEntry) => e.kind === "image" || e.kind === "video" || e.ext === "pdf";

function KindIcon({ entry }: { entry: ScanEntry }) {
  const Icon = entry.kind === "audio" ? Music : entry.kind === "video" ? Film : entry.kind === "image" ? ImageIcon : entry.ext === "pdf" ? FileText : File;
  return <Icon className="h-5 w-5 text-zinc-500" />;
}

/** Aperçu agrandi ; caché jusqu'à son chargement, le temps de le placer. */
function LargePreview({ path }: { path: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [shift, setShift] = useState<{ x: number; y: number } | null>(null);
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  // Zone visible : sous l'en-tête, dans la zone qui défile (sans sa barre de défilement).
  const place = () => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const top = (document.querySelector('[data-zone="entete"]')?.getBoundingClientRect().bottom ?? 0) + MARGIN;
    const scroller = document.getElementById(SCROLLER_ID);
    const right = (scroller ? scroller.getBoundingClientRect().left + scroller.clientWidth : window.innerWidth) - MARGIN;
    const bottom = window.innerHeight - MARGIN;
    const x = box.left < MARGIN ? MARGIN - box.left : box.right > right ? right - box.right : 0;
    const y = box.top < top ? top - box.top : box.bottom > bottom ? bottom - box.bottom : 0;
    setShift({ x, y });
  };

  return (
    <img
      ref={ref}
      data-zone="import.liste.apercu-grand"
      src={scanPreviewUrl(path, true)}
      alt=""
      draggable={false}
      onLoad={place}
      onError={() => setFailed(true)}
      style={{
        transform: `translate(calc(-50% + ${shift?.x ?? 0}px), calc(-50% + ${shift?.y ?? 0}px))`,
        visibility: shift ? "visible" : "hidden",
      }}
      className="pointer-events-none absolute top-1/2 left-1/2 z-20 max-w-none rounded-lg border border-border bg-[#0d0e12] shadow-2xl shadow-black/60"
    />
  );
}

export function ListThumb({ entry }: { entry: ScanEntry }) {
  const [failed, setFailed] = useState(false);
  const [large, setLarge] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const preview = hasPreview(entry) && !failed;

  return (
    <span
      className="relative shrink-0"
      onMouseEnter={() => {
        if (preview) timer.current = window.setTimeout(() => setLarge(true), HOVER_DELAY);
      }}
      onMouseLeave={() => {
        window.clearTimeout(timer.current);
        setLarge(false);
      }}
    >
      <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-md bg-[#0d0e12]">
        {preview ? (
          <img
            src={scanPreviewUrl(entry.path)}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <KindIcon entry={entry} />
        )}
      </span>
      {large && <LargePreview path={entry.path} />}
    </span>
  );
}
