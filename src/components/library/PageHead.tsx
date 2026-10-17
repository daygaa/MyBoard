// Ligne sous la barre des filtres (PAGE-05) : toujours là, même sans autre page, pour que la grille
// reste à la même distance des filtres. Elle porte la pagination du haut (s'il y a plusieurs pages,
// centrée sur la fenêtre, PAGE-04) et, dans les favoris et les dossiers, la ligne de titre à gauche
// (FAV-04) : coupée par « … » avant d'atteindre la pagination, nom complet dans une bulle au survol.

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import type { ListPage } from "@/lib/api";
import { formatNumber, plural } from "@/lib/format";
import { titleIfCut } from "@/lib/utils";
import { Pagination } from "./Pagination";

/** Écart gardé entre la fin du titre et la pagination. */
const GAP = 16;

export function PageHead({ data, title }: { data: ListPage | undefined; title: ReactNode }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState<number | undefined>(undefined);

  // Place du titre : jusqu'au premier bouton de la pagination (centrée par ses propres marges, d'où
  // une deuxième mesure à l'image suivante).
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || !title) return;
    const measure = () => {
      const first = row.querySelector('[data-zone="grille.pagination-haut"] button');
      const next = first ? Math.max(0, Math.floor(first.getBoundingClientRect().left - row.getBoundingClientRect().left - GAP)) : undefined;
      setRoom((r) => (r === next ? r : next));
    };
    measure();
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  });

  return (
    <div ref={rowRef} data-zone="grille.entete" className="relative mb-4 h-8">
      {title && (
        <div data-zone="grille.titre" className="absolute inset-y-0 left-0 flex min-w-0 items-center" style={{ maxWidth: room }}>
          {title}
        </div>
      )}
      {data && data.total > 0 && <Pagination zone="grille.pagination-haut" page={data.page} pageCount={data.pageCount} total={data.total} />}
    </div>
  );
}

/** Titre d'une vue : icône dans un carré doré (comme le dossier de la v8), nom, nombre de médias. */
export function ViewTitle({ icon, name, count }: { icon: ReactNode; name: string; count: number | undefined }) {
  return (
    <>
      <span className="mr-2.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[#d9a94e] text-[#1a1408]">{icon}</span>
      <span onMouseEnter={(e) => titleIfCut(e.currentTarget)} className="min-w-0 truncate text-[15px] font-semibold text-foreground">
        {name}
      </span>
      {count !== undefined && (
        <span className="ml-2 shrink-0 text-xs text-muted-foreground">
          · {formatNumber(count)} {plural(count, "média")}
        </span>
      )}
    </>
  );
}
