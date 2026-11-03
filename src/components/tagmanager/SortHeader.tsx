// Titre de colonne triable du gestionnaire (TAGM-04 ; onglet « Synonymes et parents », retour T3, point
// TAGM-15.10) : un clic trie, un 2e clic inverse ; le titre du tri en cours est doré, avec la flèche du sens.

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";

export type ColumnSort<K extends string> = { key: K; desc: boolean };

export function SortHeader<K extends string>({ label, sortKey, sort, onSort, className, zone }: {
  label: ReactNode;
  sortKey: K;
  sort: ColumnSort<K>;
  onSort: (key: K) => void;
  className?: string;
  zone?: string;
}) {
  const on = sort.key === sortKey;
  const Arrow = sort.desc ? ArrowDown : ArrowUp;
  return (
    <button
      type="button"
      data-zone={zone}
      onClick={() => onSort(sortKey)}
      title="Trier"
      className={cn("flex items-center gap-1 hover:text-foreground", on && "text-[#d9a94e]", className)}
    >
      {label}
      {on && <Arrow className="h-3 w-3 shrink-0" />}
    </button>
  );
}
