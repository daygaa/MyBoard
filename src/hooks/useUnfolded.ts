// Pastilles en trop repliées derrière un « +N », dépliées par-dessus ce qui est dessous quand la souris
// approche (SRCH-18 : termes de la recherche ; retouches de R3 : champ « Synonymes » du formulaire des
// groupes), repliées quand elle s'éloigne. Même principe que la barre du bas en plein écran (VIEW-18).

import { useEffect, useState } from "react";

/** Distance d'approche pour déplier, et marge autour des pastilles dépliées avant de les replier (choix du
 *  15/10), à gauche, à droite et en dessous seulement : au-dessus, rien ne doit déplier (16/10). */
export const UNFOLD_BUFFER = 16;

/** Vrai quand les pastilles en trop sont dépliées : la souris est arrivée près de la zone (`rectOf` : la zone
 *  repliée, puis dépliée), et ne s'en est pas encore éloignée. `covered` : la souris est sur un élément posé
 *  par-dessus (liste de suggestions, menu…) : rien ne se déplie dessous. */
export function useUnfolded(rectOf: () => DOMRect | undefined, active: boolean, covered: (target: EventTarget | null) => boolean) {
  const [unfolded, setUnfolded] = useState(false);
  useEffect(() => {
    if (!active) return;
    let was = false;
    const update = (next: boolean) => {
      if (next === was) return;
      was = next;
      setUnfolded(next);
    };
    const onMove = (e: MouseEvent) => {
      const r = rectOf();
      const near = !!r && e.clientX >= r.left - UNFOLD_BUFFER && e.clientX <= r.right + UNFOLD_BUFFER && e.clientY >= r.top && e.clientY <= r.bottom + UNFOLD_BUFFER;
      update(near && (was || !covered(e.target)));
    };
    const onLeave = () => update(false);
    window.addEventListener("mousemove", onMove);
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      setUnfolded(false);
    };
  }, [rectOf, active, covered]);
  return unfolded;
}
