// Navigation minimale entre les pages, par l'adresse « #/… ».
// Elle passe par l'historique : le bouton « retour » de la souris pourra s'en servir (VIEW-03).
// Vue Favoris « #/favoris » (FAV-02) et page d'un dossier « #/dossier/<id> » (FOLD-04) : la page de
// la bibliothèque, limitée à leurs médias. Gestionnaire de tags « #/tags » (TAGM-04), et son onglet
// « Synonymes et parents » « #/tags/regles » (TAGM-15, TAGM-16).

import { useSyncExternalStore } from "react";

import { scrollToTop } from "./scroller";

export type Route = "library" | "import" | "favorites" | "folder" | "tags";

const PATHS: Record<Exclude<Route, "folder">, string> = { library: "#/", import: "#/import", favorites: "#/favoris", tags: "#/tags" };

function routeOf(hash: string): Route {
  if (hash.startsWith("#/import")) return "import";
  if (hash.startsWith("#/favoris")) return "favorites";
  if (hash.startsWith("#/tags")) return "tags";
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

/** Onglet du gestionnaire de tags. Chacun compte comme une page dans l'historique (Q2-1). */
export type TagTab = "tags" | "rules";
const RULES = "#/tags/regles";

export function useTagTab(): TagTab {
  return useSyncExternalStore(subscribe, () => (window.location.hash.startsWith(RULES) ? "rules" : "tags"));
}

/** Changement de page par un clic (onglet, lien, menu), pas par un retour arrière / avant : ce qui doit
 *  repartir à neuf s'y abonne (onglet « Synonymes et parents », retour T3, point TAGM-15.20). */
const clickListeners = new Set<() => void>();
export function onClickNavigation(listener: () => void) {
  clickListeners.add(listener);
}
const go = (target: string) => {
  clickListeners.forEach((listener) => listener());
  window.location.hash = target;
};

export function openTagTab(tab: TagTab) {
  const target = tab === "rules" ? RULES : PATHS.tags;
  if (window.location.hash !== target) go(target);
  scrollToTop();
}

/** Vue de la grille selon l'adresse (la page Importer n'en a pas : bibliothèque). */
export type ViewScope = { favorites: boolean; folder: number | null };

export function scopeOf(hash: string): ViewScope {
  return { favorites: routeOf(hash) === "favorites", folder: folderIdOf(hash) };
}

export function navigate(route: Route, folderId?: number) {
  const target = route === "folder" ? `#/dossier/${folderId}` : PATHS[route];
  if (window.location.hash !== target && !(route === "library" && routeOf(window.location.hash) === "library")) go(target);
  scrollToTop();
}
