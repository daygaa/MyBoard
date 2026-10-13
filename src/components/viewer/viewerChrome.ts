// Ce que les éléments flottants de la visionneuse doivent savoir de leur cadre :
// - `bottomInset` : hauteur à laisser libre en bas de la scène. En plein écran, la barre du bas
//   passe par-dessus la scène ; la barre de lecture et le bouton plein écran des images restent
//   juste au-dessus d'elle, à la même hauteur qu'hors plein écran (VIEW-32).
// - `idle` : vidéo en plein écran, souris immobile depuis 3 s : les commandes se cachent (VIEW-33).

import { createContext } from "react";

export const ViewerChrome = createContext({ bottomInset: 0, idle: false });

/** Classes d'un élément qui se cache quand la souris est immobile (VIEW-33). */
export function idleClass(idle: boolean): string {
  return idle ? "pointer-events-none opacity-0" : "opacity-100";
}
