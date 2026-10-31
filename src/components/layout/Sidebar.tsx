// Barre latérale de la bibliothèque (apparence v8) : recherche par tags (SRCH-01 à SRCH-07)
// et tags des médias de la page affichée (SRCH-10 à SRCH-14).
// Hauteur MAXIMALE (pas fixe) : avec peu de contenu, le pied de page reste visible en bas
// (GEN-05). La recherche reste en haut ; seule la liste des tags défile.

import { PageTags } from "@/components/search/PageTags";
import { SearchBox } from "@/components/search/SearchBox";
import type { MediaItem } from "@/lib/api";

export function Sidebar({ items }: { items: MediaItem[] }) {
  return (
    <aside
      data-zone="barre-laterale"
      // Hauteur disponible : fenêtre moins la barre de titre (NAV-04) et l'en-tête (57 px, bordure comprise :
      // à 56 px, elle sautait d'1 px au premier défilement et dépassait d'1 px en bas, retour T3, point AUT.20).
      // Au-dessus de la grille : la liste des suggestions, élargie pour les noms longs, déborde sur elle (SRCH-22) ;
      // au-dessus aussi de son haut fixe (z-30, GRID-14 : retour T3, point AUT.26), sous l'en-tête (z-40).
      className="sticky top-[57px] z-[35] hidden max-h-[calc(100vh-var(--titlebar-h)-57px)] w-72 shrink-0 flex-col border-r border-border bg-card/40 px-4 py-5 md:flex"
    >
      <SearchBox />
      <PageTags items={items} />
    </aside>
  );
}
