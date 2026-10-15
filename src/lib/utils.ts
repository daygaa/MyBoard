import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Assemble des classes Tailwind en résolvant les conflits (ex. deux couleurs de fond). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Au survol d'un texte coupé par « … » : bulle de Windows (`title`) avec le texte complet (SRCH-22).
 *  Pas coupé : aucune bulle propre (un `title` vide cacherait aussi celle d'un parent). */
export function titleIfCut(el: HTMLElement) {
  if (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) el.title = el.textContent ?? "";
  else el.removeAttribute("title");
}
