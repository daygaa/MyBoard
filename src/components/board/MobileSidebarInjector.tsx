"use client";

// MyBoard — Injecteur client pour le contenu de la sidebar mobile.
// La page (server) rend ce composant avec query + tags (données sérialisables),
// et au montage il pousse le JSX correspondant dans le store UI.
// Le Header lit ensuite ce contenu pour le rendre dans le Sheet mobile.

import { useEffect } from "react";
import { useBoardUI } from "./store";
import { TagList } from "./TagList";
import { SearchBar } from "./SearchBar";
import type { TagDTO } from "@/lib/types";

export function MobileSidebarInjector({
  query,
  tags,
}: {
  query: string;
  tags: TagDTO[];
}) {
  const setMobileSidebarContent = useBoardUI((s) => s.setMobileSidebarContent);
  useEffect(() => {
    setMobileSidebarContent(
      <div className="space-y-4">
        <SearchBar />
        <div>
          <h4 className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tags sur cette page
            <span className="ml-2 font-normal text-muted-foreground/60">
              {tags.length}
            </span>
          </h4>
          <TagList tags={tags} query={query} />
        </div>
      </div>
    );
    return () => setMobileSidebarContent(null);
  }, [query, tags, setMobileSidebarContent]);

  return null;
}
