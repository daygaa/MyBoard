// Liste d'entrées d'un menu du clic droit (CTX-01) : menu principal ou sous-menu, et leur placement
// dans la fenêtre. Apparence du menu de tri (dropdown-menu.tsx), sans icônes ; case cochée et
// pastille de couleur seulement si l'entrée en a ; « ▸ » pour un sous-menu ; séparateurs comme
// ceux de Firefox (trait à 16 px du bord intérieur, 3 px vides au-dessus et en dessous).

import type { CSSProperties, RefObject } from "react";
import { Check, ChevronRight } from "lucide-react";

import type { MenuEntry, MenuItem } from "@/lib/contextMenu";
import { cn } from "@/lib/utils";
import { MENU_ITEM, MENU_ITEM_ACTIVE, MENU_SURFACE } from "./dropdown-menu";

/** Écart minimal entre le menu et le bord de la fenêtre. */
const EDGE = 4;

/** Entrée qui fait quelque chose (ni séparateur, ni grisée, ni fonction à venir). */
export const usable = (entry: MenuEntry | undefined): entry is MenuItem =>
  entry !== undefined && entry !== "separator" && !entry.disabled && (entry.run !== undefined || entry.submenu !== undefined);

/** Entrée utilisable suivante dans le sens `step` (en boucle), ou `null`. */
export function nextUsable(entries: MenuEntry[], from: number | null, step: number): number | null {
  for (let i = 1; i <= entries.length; i++) {
    const index = (((from ?? (step > 0 ? -1 : 0)) + step * i) % entries.length + entries.length) % entries.length;
    if (usable(entries[index])) return index;
  }
  return null;
}

type ListProps = {
  entries: MenuEntry[];
  active: number | null;
  listRef: RefObject<HTMLDivElement | null>;
  style: CSSProperties;
  zone: string;
  onHover: (index: number) => void;
  onLeave: () => void;
  onPick: (index: number) => void;
};

export function MenuList({ entries, active, listRef, style, zone, onHover, onLeave, onPick }: ListProps) {
  const checks = entries.some((e) => e !== "separator" && e.checked !== undefined);
  return (
    <div
      ref={listRef}
      role="menu"
      data-zone={zone}
      className={cn(MENU_SURFACE, "fixed animate-in fade-in-0 zoom-in-95")}
      style={style}
      // Le menu ne prend ni le focus ni la sélection : un champ de saisie garde les siens.
      onMouseDown={(e) => e.preventDefault()}
    >
      {entries.map((entry, i) => {
        if (entry === "separator") {
          return (
            <div key={i} role="separator" className="py-[3px]">
              <div className="mx-3 h-px bg-[#43464f]" />
            </div>
          );
        }
        const disabled = !usable(entry);
        const on = active === i;
        return (
          <div
            key={i}
            role="menuitem"
            data-index={i}
            aria-disabled={disabled || undefined}
            aria-haspopup={entry.submenu ? "menu" : undefined}
            onPointerMove={() => onHover(i)}
            onPointerLeave={onLeave}
            onClick={() => onPick(i)}
            className={cn(
              MENU_ITEM,
              disabled && "cursor-not-allowed opacity-50",
              on && (entry.danger ? "bg-destructive text-white" : MENU_ITEM_ACTIVE),
              entry.danger && !on && "text-destructive",
            )}
          >
            {checks && <span className="grid w-4 shrink-0 place-items-center">{entry.checked && <Check className="h-3.5 w-3.5" />}</span>}
            {entry.color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />}
            <span className="flex-1 whitespace-nowrap">{entry.label}</span>
            {entry.shortcut && (
              <span className={cn("ml-6 text-xs whitespace-nowrap", on ? "opacity-70" : "text-muted-foreground")}>{entry.shortcut}</span>
            )}
            {entry.submenu && <ChevronRight className="-mr-1 ml-4 h-4 w-4 shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

/** Position d'un menu de taille `w` × `h` ouvert au point (`x`, `y`), dans la fenêtre ; `flipX` :
 *  abscisse s'il n'y a pas la place à droite. */
export function fit(x: number, y: number, w: number, h: number, flipX = x - w, flipY = y - h) {
  const left = x + w > window.innerWidth - EDGE ? flipX : x;
  const top = y + h > window.innerHeight - EDGE ? flipY : y;
  return {
    left: Math.max(EDGE, Math.min(left, window.innerWidth - EDGE - w)),
    top: Math.max(EDGE, Math.min(top, window.innerHeight - EDGE - h)),
  };
}
