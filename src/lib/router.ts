// Navigation minimale entre les pages, par l'adresse « #/… ».
// Elle passe par l'historique : le bouton « retour » de la souris pourra s'en servir (VIEW-03).
// Vue Favoris « #/favoris » (FAV-02) et page d'un dossier « #/dossier/<id> » (FOLD-04) : la page de
// la bibliothèque, limitée à leurs médias.

import { useSyncExternalStore } from "react";

import { scrollToTop } from "./scroller";

export type Route = "library" | "import" | "favorites" | "folder";

const PATHS: Record<Exclude<Route, "folder">, string> = { library: "#/", import: "#/import", favorites: "#/favoris" };

function routeOf(hash: string): Route {
  if (hash.startsWith("#/import")) return "import";
  if (hash.startsWith("#/favoris")) return "favorites";
  if (folderIdOf(hash) !== null) return "folder";
  return "library";
}

/** Dossier affiché par l'adresse, ou `null`. */
export function folderIdOf(hash: string): number | null {
  const found = /^#\/dossier\/(\d+)/.exec(hash);
  return found ? Number(found[1]) : null;
}

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => routeOf(window.location.hash));
}

export function useFolderId(): number | null {
  return useSyncExternalStore(subscribe, () => folderIdOf(window.location.hash));
}

/** Vue de la grille selon l'adresse (la page Importer n'en a pas : bibliothèque). */
export type ViewScope = { favorites: boolean; folder: number | null };

export function scopeOf(hash: string): ViewScope {
  return { favorites: routeOf(hash) === "favorites", folder: folderIdOf(hash) };
}

export function navigate(route: Route, folderId?: number) {
  const target = route === "folder" ? `#/dossier/${folderId}` : PATHS[route];
  if (window.location.hash !== target && !(route === "library" && routeOf(window.location.hash) === "library")) window.location.hash = target;
  scrollToTop();
}
