// MyBoard — Page browse principale (server component).
// B1 refactor : filtres (kind), tri (sort), favoris (favorites) sont des
// paramètres URL SÉPARÉS, indépendants du système de tags.

import Link from "next/link";
import { db } from "@/lib/db";
import { searchMedia } from "@/lib/search";
import type { SearchOptions } from "@/lib/search";
import {
  PAGE_SIZE,
  pageSizeForDensity,
  mediaFileUrl,
  mediaThumbUrl,
} from "@/lib/shared";
import type { MediaListItem, TagDTO } from "@/lib/types";
import { SearchBar } from "@/components/board/SearchBar";
import { TagList } from "@/components/board/TagList";
import { MediaGrid } from "@/components/board/MediaGrid";
import { FiltersBar } from "@/components/board/FiltersBar";
import { Pagination } from "@/components/board/Pagination";
import { LightboxViewer } from "@/components/board/LightboxViewer";
import { MobileSidebarInjector } from "@/components/board/MobileSidebarInjector";

export const dynamic = "force-dynamic";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{
    tags?: string;
    page?: string;
    density?: string;
    kind?: string;
    sort?: string;
    favorites?: string;
  }>;
}) {
  const sp = await searchParams;
  const query = (sp.tags ?? "").trim().replace(/\s+/g, " ");
  const page = Math.max(1, Number(sp.page) || 1);
  const density = Number(sp.density) || 7;
  const pageSize = pageSizeForDensity(density);

  // B1 : kind, sort, favorites sont des params URL séparés
  const opts: SearchOptions = {
    kind: sp.kind || undefined,
    sort: sp.sort || undefined,
    favorites: sp.favorites === "1" || sp.favorites === "true",
  };

  // Recherche (server-side direct, pas de fetch HTTP)
  const { items: rawItems, total } = await searchMedia(db, query, page, pageSize, opts);

  // Compteur total de médias en DB (pour distinguer "DB vide" d'"aucun résultat")
  const dbTotal = await db.media.count();
  const dbIsEmpty = dbTotal === 0;

  // Mappe vers les DTO MediaListItem
  const items: MediaListItem[] = rawItems.map((m: any) => {
    const storage = m.storage as string;
    const remoteUrl = m.remoteUrl as string | null;
    const remoteThumbUrl = m.remoteThumbUrl as string | null;
    const hasThumb = !!m.hasThumb;
    return {
      id: m.id,
      kind: m.kind,
      ext: m.ext,
      mime: m.mime,
      originalName: m.originalName,
      size: m.size,
      width: m.width,
      height: m.height,
      duration: m.duration,
      hasThumb,
      thumbUrl: mediaThumbUrl({
        id: m.id,
        storage,
        remoteThumbUrl,
        hasThumb,
      }),
      fileUrl: mediaFileUrl({ id: m.id, storage, remoteUrl }),
      tags: (m.tags ?? [])
        .map((mt: any) => ({
          id: mt.tag.id,
          name: mt.tag.name,
          category: mt.tag.category,
        }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name)),
      tagCount: m.tagCount,
      favorite: !!m.favorite,
      score: m.score,
      views: m.views,
      importedAt: m.importedAt instanceof Date
        ? m.importedAt.toISOString()
        : String(m.importedAt ?? ""),
    };
  });

  // D8 : sidebar tags = postCount GLOBAL (tous les tags de la DB, pas juste de la page)
  // Comportement original restauré selon modifUI-UX4.txt
  const allTags = await db.tag.findMany({
    orderBy: { postCount: "desc" },
    take: 500, // limite pour éviter une sidebar trop longue
  });
  const pageTags: TagDTO[] = allTags.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    postCount: t.postCount,
  }));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-1">
      {/* Sidebar desktop */}
      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-72 shrink-0 overflow-y-auto border-r border-border bg-card/40 px-4 py-5 md:block">
        <section>
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recherche
          </h3>
          <SearchBar />
        </section>

        <section className="mt-6">
          <h3 className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tags
            <span className="font-normal normal-case tracking-normal text-muted-foreground/60">
              {pageTags.length} au total
            </span>
          </h3>
          <TagList tags={pageTags} query={query} />
        </section>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1 px-4 py-5 lg:px-6">
        {/* SearchBar mobile (au-dessus de la grille) */}
        <div className="mb-4 md:hidden">
          <SearchBar />
        </div>

        {/* Filtres + tri + compteur — B1 : kind/sort passés séparément */}
        <FiltersBar
          query={query}
          kind={opts.kind ?? ""}
          sort={opts.sort ?? ""}
          favorites={opts.favorites}
          total={total}
        />

        {/* Grille ou empty state */}
        {items.length > 0 ? (
          <MediaGrid items={items} query={query} />
        ) : dbIsEmpty ? (
          // DB totalement vide → message d'accueil dédié
          <div className="grid place-items-center rounded-2xl border border-dashed border-border py-24 text-center">
            <p className="text-lg font-medium text-foreground">
              Bienvenue sur MyBoard
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Votre bibliothèque est vide. Commencez par importer vos premiers médias.
            </p>
            <Link
              href="/import"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#d9a94e] px-4 py-2 text-sm font-medium text-[#1a1408] transition hover:bg-[#e3b75f]"
            >
              Importer des médias
            </Link>
          </div>
        ) : (
          // DB non vide mais recherche sans résultat
          <div className="grid place-items-center rounded-2xl border border-dashed border-border py-24 text-center">
            <p className="text-lg font-medium text-foreground">
              Aucun média trouvé
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {query ? "Aucun média ne correspond à votre recherche. Essayez de retirer des tags." : "Aucun média dans cette catégorie."}
            </p>
            {query && (
              <Link
                href="/"
                className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary"
              >
                Réinitialiser la recherche
              </Link>
            )}
          </div>
        )}

        {/* Pagination */}
        <Pagination
          page={page}
          totalPages={totalPages}
          query={query}
          total={total}
        />
      </main>

      {/* Injecteur pour la sidebar mobile (Sheet) */}
      <MobileSidebarInjector query={query} tags={pageTags} />

      {/* Visionneuse plein écran (montée si store.lightbox != null) */}
      <LightboxViewer />
    </div>
  );
}
