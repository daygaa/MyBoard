"use client";

// MyBoard — Injecteur client pour le contenu de la sidebar mobile DANS LE
// CONTEXTE D'UN GROUPE (P6). Variante de MobileSidebarInjector mais avec les
// composants GroupSidebar (qui préservent /groups/[id] dans l'URL).
//
// La page (server) rend ce composant avec query + tags + groupId, et au montage
// il pousse le JSX correspondant dans le store UI. Le Header lit ensuite ce
// contenu pour le rendre dans le Sheet mobile.

import { Suspense, useEffect } from "react";
import { useBoardUI } from "@/components/board/store";
import { GroupSearchBar, GroupTagList } from "./GroupSidebar";
import type { TagDTO } from "@/lib/types";

export function MobileGroupSidebarInjector({
  groupId,
  query,
  tags,
}: {
  groupId: number;
  query: string;
  tags: TagDTO[];
}) {
  const setMobileSidebarContent = useBoardUI((s) => s.setMobileSidebarContent);

  useEffect(() => {
    setMobileSidebarContent(
      <div className="space-y-4">
        <Suspense
          fallback={<div className="h-9 rounded-md bg-card/60" />}
        >
          <GroupSearchBar groupId={groupId} />
        </Suspense>
        <div>
          <h4 className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tags de ce dossier
            <span className="ml-2 font-normal text-muted-foreground/60">
              {tags.length}
            </span>
          </h4>
          <GroupTagList tags={tags} query={query} groupId={groupId} />
        </div>
      </div>
    );
    return () => setMobileSidebarContent(null);
  }, [groupId, query, tags, setMobileSidebarContent]);

  return null;
}
