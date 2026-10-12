// Emplacement des commandes vidéo dans la barre du bas, utilisé en plein écran (VIEW-18) :
// les commandes apparaissent alors au survol avec la barre, au lieu d'être cachées dessous.

import { createContext } from "react";

export const ControlsSlot = createContext<HTMLElement | null>(null);
