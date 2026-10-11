// Navigation minimale entre les pages, par l'adresse « #/… ».
// Elle passe par l'historique : le bouton « retour » de la souris pourra s'en servir (VIEW-03).

import { useSyncExternalStore } from "react";

export type Route = "library" | "import";

const PATHS: Record<Route, string> = { library: "#/", import: "#/import" };

function current(): Route {
  return window.location.hash.startsWith("#/import") ? "import" : "library";
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, current);
}

export function navigate(route: Route) {
  if (current() !== route) window.location.hash = PATHS[route];
  window.scrollTo(0, 0);
}
