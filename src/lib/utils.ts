import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Assemble des classes Tailwind en résolvant les conflits (ex. deux couleurs de fond). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
