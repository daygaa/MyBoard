// Page d'accueil : barre latérale + filtres + pagination (haut et bas) + grille. Même page pour la
// vue Favoris (FAV-02) et la page d'un dossier (FOLD-04), avec leur ligne de titre (FAV-04) dans la
// ligne de la pagination du haut, toujours réservée (PAGE-05).

import { useEffect } from "react";
import { Folder as FolderIcon, Star } from "lucide-react";

import { Sidebar } from "@/components/layout/Sidebar";
import { useFolders } from "@/hooks/useFolders";
import { useGridShortcuts } from "@/hooks/useGridShortcuts";
import { useMediaPage, useStats } from "@/hooks/useLibraryData";
import { useBusy } from "@/lib/busy";
import { navigate, useFolderId, useRoute } from "@/lib/router";
import { scrollToTop } from "@/lib/scroller";
import { useLibrary } from "@/stores/library";
import { useSearch } from "@/stores/search";
import { EmptyFolder, EmptyLibrary, NoFavorites, NoFileMatch, NoResults } from "./EmptyState";
import { FiltersBar } from "./FiltersBar";
import { GridBadge } from "./GridBadge";
import { MediaGrid } from "./MediaGrid";
import { PageHead, ViewTitle } from "./PageHead";
import { Pagination } from "./Pagination";
import { SelectionBar } from "./SelectionBar";

export function LibraryPage() {
  const { data, isPlaceholderData } = useMediaPage();
  const { data: stats } = useStats();
  const density = useLibrary((s) => s.density);
  const page = useLibrary((s) => s.page);
  const filtered = useLibrary((s) => s.kinds.length > 0);
  const searching = useSearch((s) => s.terms.length > 0);
  const file = useSearch((s) => s.file);
  const route = useRoute();
  const folderId = useFolderId();
  const { data: folders } = useFolders();
  const folder = route === "folder" ? folders?.find((f) => f.id === folderId) : undefined;
  useGridShortcuts(data?.pageCount ?? 1);
  // Dossier inexistant (supprimé entre-temps…) : retour à la bibliothèque.
  useEffect(() => {
    if (route === "folder" && folders && !folder) navigate("library");
  }, [route, folders, folder]);
  // Autre page, filtre, tri ou recherche qui tarde : curseur d'attente passé 0,3 s (GEN-13).
  useBusy(isPlaceholderData, 300);

  // Nouvelle page : retour en haut de la grille.
  useEffect(() => {
    scrollToTop();
  }, [page]);

  let content = null;
  if (route === "library" && stats && stats.total === 0) content = <EmptyLibrary />;
  else if (data && data.total === 0) {
    const where = route === "favorites" ? "dans les favoris" : route === "folder" ? "dans ce dossier" : "dans la bibliothèque";
    if (file) content = <NoFileMatch file={file} where={where} typed={filtered} />;
    else if (searching || filtered) content = <NoResults />;
    else if (route === "favorites") content = <NoFavorites />;
    else if (route === "folder") content = <EmptyFolder />;
    else content = <NoResults />;
  }
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
        <PageHead
          data={data}
          title={
            route === "favorites" ? (
              <ViewTitle icon={<Star className="h-4 w-4 fill-current" />} name="Favoris" count={stats?.favorites} />
            ) : folder ? (
              <ViewTitle icon={<FolderIcon className="h-4 w-4" />} name={folder.name} count={folder.mediaCount} />
            ) : null
          }
        />
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
        <SelectionBar />
        <GridBadge />
      </main>
    </div>
  );
}
