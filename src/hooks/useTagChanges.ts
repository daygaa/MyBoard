// Après l'ajout ou le retrait d'un tag : tout ce qui en dépend est relu aussitôt — pastilles
// de la visionneuse, barre latérale et ses compteurs (SRCH-14), grille (tri par nombre de
// tags, recherche), statistiques de l'en-tête, suggestions (TAGM-07).

import { useQueryClient } from "@tanstack/react-query";

import { api, type MediaKind, type NewTag } from "@/lib/api";
import { offerChainRemoval, previewChain } from "@/lib/chainRemoval";

const DEPENDENT = [["page-tags"], ["media"], ["stats"], ["autocomplete"], ["tag"]];

export function useTagChanges() {
  const queryClient = useQueryClient();
  const refresh = (mediaId: number) => {
    void queryClient.invalidateQueries({ queryKey: ["media-detail", mediaId] });
    for (const queryKey of DEPENDENT) void queryClient.invalidateQueries({ queryKey });
  };
  return {
    add: async (mediaId: number, tag: NewTag) => {
      await api.addMediaTag(mediaId, tag);
      refresh(mediaId);
    },
    /** Puis, si sa chaîne de règles avait posé des parents sur ce média, pop-in pour les retirer aussi (TAGM-22). */
    remove: async (mediaId: number, tagId: number, kind: MediaKind) => {
      const chain = await previewChain([mediaId], [tagId]);
      await api.removeMediaTag(mediaId, tagId);
      refresh(mediaId);
      await offerChainRemoval(chain, [mediaId], [tagId], kind);
    },
  };
}
