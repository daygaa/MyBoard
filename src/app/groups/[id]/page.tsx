// MyBoard — Page dédiée à un groupe (collection manuelle de médias).
//
// Route : /groups/[id]
// Server component — accès direct à la DB via Prisma (pas de boucle HTTP).
// Réutilise <MediaGrid/> (sélection multiple, lightbox, densité grille) pour
// rester cohérent avec la page browse principale.
//
// Pagination simplifiée (Prev/Next + numéros) — la <Pagination/> partagée
// est hardcodée vers /?tags=...&page=N, donc non réutilisable ici.

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  ArrowLeft,
} from "lucide-react";
import { db } from "@/lib/db";
import { getGroup, mediaForGroup } from "@/lib/group-helpers";
import { PAGE_SIZE } from "@/lib/shared";
import type { MediaListItem } from "@/lib/types";
import { MediaGrid } from "@/components/board/MediaGrid";
import { LightboxViewer } from "@/components/board/LightboxViewer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Ctx) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) return { title: "Groupe — MyBoard" };
  const g = await getGroup(db, id);
  if (!g) return { title: "Groupe introuvable — MyBoard" };
  return { title: `${g.name} — MyBoard` };
}

export default async function GroupPage(
  { searchParams, params }: {
    searchParams: Promise<{ page?: string }>;
    params: Promise<{ id: string }>;
  }
) {
  const { id: idStr } = await params;
  const groupId = Number(idStr);
  if (!Number.isInteger(groupId) || groupId <= 0) notFound();

  const group = await getGroup(db, groupId);
  if (!group) notFound();

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const { items, total } = await mediaForGroup(db, groupId, page, PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Helper pour construire les liens de pagination de cette page
  const pageHref = (p: number) =>
    p === 1 ? `/groups/${groupId}` : `/groups/${groupId}?page=${p}`;

  // Cast sûr : mediaForGroup renvoie déjà des MediaListItem complets
  const gridItems = items as MediaListItem[];

  return (
    <div className="flex flex-1 flex-col">
      <main className="min-w-0 flex-1 px-4 py-5 lg:px-6">
        {/* En-tête de page : retour + nom du groupe + compteur */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-secondary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md ring-1 ring-black/40"
              style={{ background: group.color }}
              aria-hidden
            >
              <Folder className="h-4 w-4 text-black/80" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-foreground">
                {group.name}
              </h1>
              <p className="text-xs text-muted-foreground">
                {total.toLocaleString("fr-FR")} média{total > 1 ? "s" : ""} dans
                ce groupe
              </p>
            </div>
          </div>
        </div>

        {/* Grille ou empty state */}
        {gridItems.length > 0 ? (
          <MediaGrid items={gridItems} query="" />
        ) : (
          <div className="grid place-items-center rounded-2xl border border-dashed border-border py-24 text-center">
            <p className="text-lg font-medium text-foreground">
              Groupe vide
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ce groupe ne contient encore aucun média.
              <br />
              Sélectionnez des médias sur la page d&apos;accueil et utilisez le
              menu 3 points pour les ajouter.
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
            >
              Parcourir la bibliothèque
            </Link>
          </div>
        )}

        {/* Pagination simplifiée (Prev/Next + numéros) */}
        {totalPages > 1 && (
          <nav
            className="mt-6 flex flex-col items-center gap-2"
            aria-label="Pagination"
          >
            <div className="flex flex-wrap items-center justify-center gap-1">
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1)}
                  aria-label="Page précédente"
                  className="grid h-8 min-w-8 place-items-center rounded-md px-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              ) : (
                <span className="grid h-8 min-w-8 place-items-center rounded-md px-2 text-sm text-muted-foreground/40">
                  <ChevronLeft className="h-4 w-4" />
                </span>
              )}

              {(() => {
                // Calcule l'ensemble des pages à afficher : 1, totalPages, ±3 autour de page.
                const set = new Set<number>([1, totalPages]);
                for (let p = page - 3; p <= page + 3; p++) {
                  if (p >= 1 && p <= totalPages) set.add(p);
                }
                const sorted = [...set].sort((a, b) => a - b);
                const cls =
                  "grid h-8 min-w-8 place-items-center rounded-md px-2 text-sm tabular-nums transition";
                return sorted.map((p, i) => {
                  const prev = sorted[i - 1];
                  const gap = i > 0 && prev !== p - 1;
                  return (
                    <span key={p} className="flex items-center gap-1">
                      {gap && (
                        <span className="px-1 text-muted-foreground/60">…</span>
                      )}
                      {p === page ? (
                        <span
                          className={`${cls} bg-[#d9a94e] font-semibold text-[#1a1408]`}
                          aria-current="page"
                        >
                          {p}
                        </span>
                      ) : (
                        <Link
                          href={pageHref(p)}
                          className={`${cls} text-muted-foreground hover:bg-secondary hover:text-foreground`}
                        >
                          {p}
                        </Link>
                      )}
                    </span>
                  );
                });
              })()}

              {page < totalPages ? (
                <Link
                  href={pageHref(page + 1)}
                  aria-label="Page suivante"
                  className="grid h-8 min-w-8 place-items-center rounded-md px-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span className="grid h-8 min-w-8 place-items-center rounded-md px-2 text-sm text-muted-foreground/40">
                  <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Page {page} / {totalPages} · {total.toLocaleString("fr-FR")} média
              {total > 1 ? "s" : ""}
            </div>
          </nav>
        )}
      </main>

      {/* Visionneuse plein écran (montée si store.lightbox != null) */}
      <LightboxViewer />
    </div>
  );
}
