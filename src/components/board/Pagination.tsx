"use client";

// MyBoard — Pagination.
// Précédent / Suivant + numéros (max 7 visibles, ellipsis).
// Raccourcis clavier : Ctrl+← / Ctrl+→ (si pas dans un input).

import Link from "next/link";
import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { searchHref } from "@/lib/shared";

type Props = {
  page: number;
  totalPages: number;
  query: string;
  total: number;
};

export function Pagination({ page, totalPages, query, total }: Props) {
  const router = useRouter();
  const hrefFor = (p: number) => searchHref(query, p);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === "ArrowLeft" && page > 1) {
        e.preventDefault();
        router.push(hrefFor(page - 1));
      } else if (e.key === "ArrowRight" && page < totalPages) {
        e.preventDefault();
        router.push(hrefFor(page + 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, totalPages, router, hrefFor]);

  if (totalPages <= 1) {
    return (
      <div className="mt-6 text-center text-xs text-muted-foreground">
        Page 1 / 1 · {total.toLocaleString("fr-FR")} média{total > 1 ? "s" : ""}
      </div>
    );
  }

  // Calcule l'ensemble des pages à afficher : 1, totalPages, et ±3 autour de page.
  const pagesSet = new Set<number>([1, totalPages]);
  for (let p = page - 3; p <= page + 3; p++) {
    if (p >= 1 && p <= totalPages) pagesSet.add(p);
  }
  const sorted = [...pagesSet].sort((a, b) => a - b);

  const cls =
    "grid h-8 min-w-8 place-items-center rounded-md px-2 text-sm tabular-nums transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9a94e]";

  return (
    <nav
      className="mt-6 flex flex-col items-center gap-2"
      aria-label="Pagination"
    >
      <div className="flex flex-wrap items-center justify-center gap-1">
        {page > 1 ? (
          <Link
            href={hrefFor(page - 1)}
            className={`${cls} text-muted-foreground hover:bg-secondary hover:text-foreground`}
            aria-label="Page précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span className={`${cls} text-muted-foreground/40`}>
            <ChevronLeft className="h-4 w-4" />
          </span>
        )}

        {sorted.map((p, i) => {
          const prev = sorted[i - 1];
          const gap = i > 0 && prev !== p - 1;
          return (
            <span key={p} className="flex items-center gap-1">
              {gap && <span className="px-1 text-muted-foreground/60">…</span>}
              {p === page ? (
                <span
                  className={`${cls} bg-[#d9a94e] font-semibold text-[#1a1408]`}
                  aria-current="page"
                >
                  {p}
                </span>
              ) : (
                <Link
                  href={hrefFor(p)}
                  className={`${cls} text-muted-foreground hover:bg-secondary hover:text-foreground`}
                >
                  {p}
                </Link>
              )}
            </span>
          );
        })}

        {page < totalPages ? (
          <Link
            href={hrefFor(page + 1)}
            className={`${cls} text-muted-foreground hover:bg-secondary hover:text-foreground`}
            aria-label="Page suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className={`${cls} text-muted-foreground/40`}>
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        Page {page} / {totalPages} · {total.toLocaleString("fr-FR")} média
        {total > 1 ? "s" : ""}
      </div>
    </nav>
  );
}
