// Pastilles en trop repliées derrière un « +N », dépliées par-dessus ce qui est dessous quand la souris
// approche (SRCH-18 : termes de la recherche ; retouches de R3 : champ « Synonymes » du formulaire des
// groupes), repliées quand elle s'éloigne. Même principe que la barre du bas en plein écran (VIEW-18).
// Un menu du clic droit ouvert (celui d'une pastille dépliée, plus grand que la zone) les garde dépliées
// jusqu'à sa fermeture (retour T3, point AUT.9.1) ; à sa fermeture, la position de la souris décide.

import { useEffect, useState } from "react";

import { isContextMenuOpen, useContextMenu } from "@/lib/contextMenu";

/** Distance d'approche pour déplier, et marge autour des pastilles dépliées avant de les replier (choix du
 *  15/10), à gauche, à droite et en dessous seulement : au-dessus, rien ne doit déplier (16/10). */
export const UNFOLD_BUFFER = 16;
const ALWAYS = () => true;

/** Vrai quand les pastilles en trop sont dépliées : la souris est arrivée près de la zone (`rectOf` : la zone
 *  repliée, puis dépliée), et ne s'en est pas encore éloignée. `covered` : la souris est sur un élément posé
 *  par-dessus (liste de suggestions, menu…) : rien ne se déplie dessous. `buffer` : marge autour de la zone ;
 *  `canStart` faux : rien ne se déplie, ce qui est déjà déplié le reste. Fonctions stables (sinon tout se replie
 *  à chaque affichage). */
export function useUnfolded(
  rectOf: () => DOMRect | undefined,
  active: boolean,
  covered: (target: EventTarget | null) => boolean,
  buffer = UNFOLD_BUFFER,
  canStart: () => boolean = ALWAYS,
) {
  const [unfolded, setUnfolded] = useState(false);
  useEffect(() => {
    if (!active) return;
    let was = false;
    const update = (next: boolean) => {
      if (next === was) return;
      was = next;
      setUnfolded(next);
    };
    let last: MouseEvent | null = null;
    const onMove = (e: MouseEvent) => {
      last = e;
      if (was && isContextMenuOpen()) return;
      const r = rectOf();
      const near = !!r && e.clientX >= r.left - buffer && e.clientX <= r.right + buffer && e.clientY >= r.top && e.clientY <= r.bottom + buffer;
      update(near && (was || (canStart() && !covered(e.target))));
    };
    const onLeave = () => !isContextMenuOpen() && update(false);
    // Menu fermé : décision avec la dernière position de la souris, sans attendre qu'elle bouge.
    const unsubscribe = useContextMenu.subscribe((st, prev) => {
      if (prev.menu && !st.menu && last) onMove(last);
    });
    window.addEventListener("mousemove", onMove);
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      unsubscribe();
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      setUnfolded(false);
    };
  }, [rectOf, active, covered, buffer, canStart]);
  return unfolded;
}
