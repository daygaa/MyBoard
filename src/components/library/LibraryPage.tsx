// Page d'accueil : barre latérale + filtres + pagination (haut et bas) + grille.

import { useEffect } from "react";

import { Sidebar } from "@/components/layout/Sidebar";
import { useGridShortcuts } from "@/hooks/useGridShortcuts";
import { useMediaPage, useStats } from "@/hooks/useLibraryData";
import { scrollToTop } from "@/lib/scroller";
import { useLibrary } from "@/stores/library";
import { EmptyLibrary, NoResults } from "./EmptyState";
import { FiltersBar } from "./FiltersBar";
import { MediaGrid } from "./MediaGrid";
import { Pagination } from "./Pagination";

export function LibraryPage() {
  const { data } = useMediaPage();
  const { data: stats } = useStats();
  const density = useLibrary((s) => s.density);
  const page = useLibrary((s) => s.page);
  useGridShortcuts(data?.pageCount ?? 1);

  // Nouvelle page : retour en haut de la grille.
  useEffect(() => {
    scrollToTop();
  }, [page]);

  let content = null;
  if (stats && stats.total === 0) content = <EmptyLibrary />;
  else if (data && data.total === 0) content = <NoResults />;
  else if (data) {
    content = (
      <MediaGrid items={data.items} density={density} firstIndex={(data.page - 1) * data.pageSize} pageSize={data.pageSize} />
    );
  }

  return (
    <div className="flex flex-1">
      <Sidebar items={data?.items ?? []} />
      <main data-zone="grille" className="min-w-0 flex-1 px-4 py-5 lg:px-6">
        <FiltersBar total={data?.total ?? 0} />
        {data && data.total > 0 && (
          <div className="mb-4">
            <Pagination zone="grille.pagination-haut" page={data.page} pageCount={data.pageCount} total={data.total} />
          </div>
        )}
        {content}
        {data && data.total > 0 && (
          <div className="mt-6">
            <Pagination
              zone="grille.pagination-bas"
              page={data.page}
              pageCount={data.pageCount}
              total={data.total}
              showSummary
            />
          </div>
        )}
      </main>
    </div>
  );
}
