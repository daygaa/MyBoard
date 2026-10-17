// Liste des dossiers (FOLD-01), lue une fois puis relue après chaque changement (`refreshFolders`).

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export function useFolders() {
  return useQuery({ queryKey: ["folders"], queryFn: api.listFolders });
}
