// Badge bref des ajouts (SEL-08) : « 3 ajoutés au dossier « Vacances » »… Plus grand que les badges du
// lecteur vidéo, bordure dorée, centré dans la fenêtre sur la ligne des filtres de la grille (SEL-08.2) ;
// sans cette ligne (gestionnaire de tags) ou quand elle a défilé hors de vue : en haut de la page. Toujours au premier
// plan (visionneuse, pop-ins, menus, barre de titre ; retour du 05/11) ; il ne capte aucun clic.
// GEN-33 (16/11) : jamais par-dessus l'en-tête (logo et nom de MyBoard) : sans ligne des filtres visible SOUS l'en-tête,
// il se place juste sous l'en-tête ; visionneuse ouverte (pas d'en-tête visible) : en haut, comme avant.

import { scroller } from "@/lib/scroller";
import { useGridBadge } from "@/stores/badge";
import { useViewer } from "@/stores/viewer";

/** Centre du badge sous le haut de la zone qui défile, visionneuse ouverte. */
const TOP_GAP = 40;
/** Centre du badge sous le bas de l'en-tête (un écart, puis la moitié de sa hauteur). */
const BELOW_HEADER = 32;

/** Centre vertical des badges brefs, dans la fenêtre. */
export function badgeTop(): number {
  const area = scroller().getBoundingClientRect();
  const header = useViewer.getState().open ? null : document.querySelector('[data-zone="entete"]')?.getBoundingClientRect();
  const top = header?.bottom ?? area.top;
  const row = document.querySelector('[data-zone="grille.filtres"]')?.getBoundingClientRect();
  const onRow = row && row.bottom > top && row.top < area.bottom ? row.top + row.height / 2 : null;
  if (!header) return onRow ?? area.top + TOP_GAP;
  return Math.max(onRow ?? 0, header.bottom + BELOW_HEADER);
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
