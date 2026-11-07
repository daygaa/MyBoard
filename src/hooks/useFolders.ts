// Liste des dossiers (FOLD-01), lue une fois puis relue après chaque changement (`refreshFolders`) ; aussi dans
// l'ordre choisi par l'utilisateur (FOLD-10).

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { api, type Folder } from "@/lib/api";
import { sortFolders } from "@/lib/folders";
import { useFolderSort } from "@/stores/folderSort";

export function useFolders() {
  return useQuery({ queryKey: ["folders"], queryFn: api.listFolders });
}

/** Dossiers dans l'ordre choisi (menu burger). */
export function useSortedFolders(): Folder[] {
  const { data } = useFolders();
  const key = useFolderSort((s) => s.key);
  const direction = useFolderSort((s) => s.dirs[s.key]);
  return useMemo(() => sortFolders(data ?? [], key, direction), [data, key, direction]);
}
