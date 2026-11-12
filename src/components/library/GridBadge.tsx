// Badge bref des ajouts (SEL-08) : « 3 ajoutés au dossier « Vacances » »… Plus grand que les badges du
// lecteur vidéo, bordure dorée, centré dans la fenêtre sur la ligne des filtres de la grille (SEL-08.2) ;
// sans cette ligne (gestionnaire de tags) ou quand elle a défilé hors de vue : en haut de la page. Toujours au premier
// plan (visionneuse, pop-ins, menus, barre de titre ; retour du 05/11) ; il ne capte aucun clic.

import { scroller } from "@/lib/scroller";
import { useGridBadge } from "@/stores/badge";

/** Hauteur du badge au-dessus du haut de la zone qui défile, sans ligne des filtres visible. */
const TOP_GAP = 40;

export function badgeTop(): number {
  const area = scroller().getBoundingClientRect();
  const row = document.querySelector('[data-zone="grille.filtres"]')?.getBoundingClientRect();
  return row && row.bottom > area.top && row.top < area.bottom ? row.top + row.height / 2 : area.top + TOP_GAP;
}

/** Apparence commune aux badges (aussi celui du travail sur les tags, TAGM-23). */
export const BADGE =
  "pointer-events-none fixed left-1/2 z-[200] -translate-x-1/2 -translate-y-1/2 rounded-md border border-[#d9a94e] bg-black/80 px-4 py-2 text-sm font-medium whitespace-nowrap text-white shadow-lg";

export function GridBadge() {
  const text = useGridBadge((s) => s.text);
  if (text === null) return null;
  return (
    <div
      data-zone="grille.badge"
      className={BADGE}
      style={{ top: badgeTop() }}
    >
      {text}
    </div>
  );
}
