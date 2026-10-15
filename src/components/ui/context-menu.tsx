// Menu du clic droit (CTX-01), apparence du menu de tri de la grille, sans icônes ; un seul ouvert
// à la fois (lib/contextMenu.ts). Comme le menu de Windows :
// - ouvert au point du clic, décalé pour rester dans la fenêtre (à gauche / au-dessus du point
//   s'il n'y a pas la place) ; sous-menus « ▸ » au survol, à droite (à gauche sans la place) ;
// - fermé par un clic ailleurs (qui ne fait rien d'autre), Échap, le bouton 4 de la souris, la
//   molette, un changement de page ou le passage à une autre fenêtre ; un clic droit ailleurs
//   ouvre le menu du nouvel endroit ;
// - clavier : flèches, Entrée, Échap. Le menu ne prend jamais le focus : un champ de saisie garde
//   sa sélection (menu d'édition, CTX-03) ;
// - séparateurs : trait de 1 px en retrait des bords, 3 px vides au-dessus et en dessous ; ces
//   7 px ne réagissent ni au survol ni au clic (comme Firefox) ;
// - action dangereuse en rouge ; confirmation (CTX-02) : Échap ou le bouton 4 ferment la pop-in
//   et laissent le menu ouvert, « Oui » agit et ferme tout.

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight } from "lucide-react";

import { closeContextMenu, isContextMenuOpen, useContextMenu, type MenuEntry, type MenuItem, type OpenMenu } from "@/lib/contextMenu";
import { useEscape } from "@/lib/escape";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { MENU_ITEM, MENU_ITEM_ACTIVE, MENU_SURFACE } from "./dropdown-menu";
import { Modal } from "./modal";

/** Écart minimal entre le menu et le bord de la fenêtre. */
const EDGE = 4;
/** Délai avant de fermer un sous-menu quand la souris passe sur une autre entrée : on peut
 *  rejoindre le sous-menu en diagonale. */
const SUB_DELAY = 250;
const ZONE = '[data-zone^="menu-contextuel"]';

const usable = (entry: MenuEntry | undefined): entry is MenuItem =>
  entry !== undefined && entry !== "separator" && !entry.disabled && (entry.run !== undefined || entry.submenu !== undefined);

/** Entrée utilisable suivante dans le sens `step` (en boucle), ou `null`. */
function nextUsable(entries: MenuEntry[], from: number | null, step: number): number | null {
  for (let i = 1; i <= entries.length; i++) {
    const index = (((from ?? (step > 0 ? -1 : 0)) + step * i) % entries.length + entries.length) % entries.length;
    if (usable(entries[index])) return index;
  }
  return null;
}

/** Le menu ouvert est-il au premier plan (pas de pop-in de confirmation par-dessus) ? */
let menuOnTop: () => boolean = () => false;
const inMenu = (target: EventTarget | null) => target instanceof Element && target.closest(ZONE) !== null;

const swallow = (e: Event) => {
  e.preventDefault();
  e.stopImmediatePropagation();
};

// Inscrits avant tous les composants : un clic ailleurs ferme le menu et ne fait rien d'autre.
window.addEventListener(
  "pointerdown",
  (e) => {
    // Boutons 4 et 5 : pile d'Échap (escape.ts). Clic droit : il ouvrira le menu du nouvel endroit.
    if (!isContextMenuOpen() || !menuOnTop() || inMenu(e.target) || e.button > 2) return;
    closeContextMenu();
    if (e.button === 2) return;
    swallow(e);
    const click = e.button === 1 ? "auxclick" : "click";
    window.addEventListener(click, swallow, { capture: true, once: true });
    // Pas de clic à la fin (souris relâchée hors de la fenêtre…) : rien à avaler ensuite.
    window.addEventListener("pointerup", () => setTimeout(() => window.removeEventListener(click, swallow, true)), { capture: true, once: true });
  },
  true,
);
window.addEventListener(
  "wheel",
  (e) => {
    if (!isContextMenuOpen() || !menuOnTop() || inMenu(e.target)) return;
    closeContextMenu();
    swallow(e); // ni défilement ni zoom en même temps
  },
  { capture: true, passive: false },
);
for (const name of ["blur", "resize", "hashchange"]) window.addEventListener(name, closeContextMenu);

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

function MenuList({ entries, active, listRef, style, zone, onHover, onLeave, onPick }: ListProps) {
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
            aria-disabled={disabled || undefined}
            aria-haspopup={entry.submenu ? "menu" : undefined}
            onPointerMove={() => !disabled && onHover(i)}
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
function fit(x: number, y: number, w: number, h: number, flipX = x - w, flipY = y - h) {
  const left = x + w > window.innerWidth - EDGE ? flipX : x;
  const top = y + h > window.innerHeight - EDGE ? flipY : y;
  return {
    left: Math.max(EDGE, Math.min(left, window.innerWidth - EDGE - w)),
    top: Math.max(EDGE, Math.min(top, window.innerHeight - EDGE - h)),
  };
}

function MenuLayer({ menu }: { menu: OpenMenu }) {
  const { entries } = menu;
  const [active, setActive] = useState<number | null>(menu.keyboard ? nextUsable(entries, null, 1) : null);
  /** Entrée dont le sous-menu est ouvert, et entrée choisie dans ce sous-menu. */
  const [sub, setSub] = useState<number | null>(null);
  const [subActive, setSubActive] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<MenuItem | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const [rootPos, setRootPos] = useState<CSSProperties>({ left: menu.x, top: menu.y, visibility: "hidden" });
  const [subPos, setSubPos] = useState<CSSProperties>({ visibility: "hidden" });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const subEntries = sub === null ? null : ((entries[sub] as MenuItem).submenu ?? null);

  const openSub = (index: number | null, keyboard = false) => {
    clearTimeout(timer.current);
    if (index !== sub) setSubPos({ visibility: "hidden" });
    setSub(index);
    const list = index === null ? null : (entries[index] as MenuItem).submenu;
    setSubActive(keyboard && list ? nextUsable(list, null, 1) : null);
  };
  const pick = (item: MenuItem, index: number) => {
    if (!usable(item)) return;
    if (item.submenu) return openSub(index, true);
    if (item.confirm) return setConfirming(item);
    closeContextMenu();
    item.run?.();
  };

  // Échap et bouton 4 : d'abord le sous-menu, puis le menu.
  const isTop = useEscape(true, () => (sub !== null ? openSub(null) : closeContextMenu()));
  useEffect(() => {
    menuOnTop = isTop;
    return () => {
      menuOnTop = () => false;
      clearTimeout(timer.current);
    };
  }, [isTop]);

  // Placement, avant l'affichage : au point du clic, dans la fenêtre.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const { left, top } = fit(menu.x, menu.y, el.offsetWidth, el.offsetHeight);
    setRootPos({ left, top, transformOrigin: `${left < menu.x ? "right" : "left"} ${top < menu.y ? "bottom" : "top"}` });
  }, [menu]);
  useLayoutEffect(() => {
    const list = subRef.current;
    const parent = rootRef.current;
    const item = sub === null ? null : parent?.querySelectorAll('[role="menuitem"]')[sub - entries.slice(0, sub).filter((e) => e === "separator").length];
    if (!list || !parent || !item || subPos.visibility !== "hidden") return;
    const box = parent.getBoundingClientRect();
    const row = item.getBoundingClientRect();
    // Première entrée du sous-menu à la hauteur de l'entrée « ▸ » (bord + marge intérieure : 5 px).
    setSubPos(fit(box.right - 4, row.top - 5, list.offsetWidth, list.offsetHeight, box.left - list.offsetWidth + 4, window.innerHeight));
  });

  // Clavier, tant que le menu est au premier plan : aucune touche n'atteint la page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isTop() || e.key === "Escape") return; // Échap : pile d'Échap
      swallow(e);
      const inSub = subEntries !== null && (subActive !== null || e.key === "ArrowLeft");
      const list = inSub ? subEntries : entries;
      const current = inSub ? subActive : active;
      const move = (index: number | null) => (inSub ? setSubActive(index) : setActive(index));
      if (e.key === "ArrowDown") move(nextUsable(list, current, 1));
      else if (e.key === "ArrowUp") move(nextUsable(list, current, -1));
      else if (e.key === "Home") move(nextUsable(list, null, 1));
      else if (e.key === "End") move(nextUsable(list, null, -1));
      else if (e.key === "ArrowLeft" && inSub) openSub(null);
      else if (e.key === "ArrowRight" && !inSub && current !== null && (entries[current] as MenuItem).submenu) openSub(current, true);
      else if ((e.key === "Enter" || e.key === " ") && current !== null) pick(list[current] as MenuItem, current);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  return createPortal(
    // Sous la pop-in de confirmation (z 120) tant qu'elle est ouverte, sinon au-dessus de tout,
    // barre de titre comprise (z 130).
    <div data-zone="menu-contextuel.calque" className="relative" style={{ zIndex: confirming ? 110 : 140 }}>
      <MenuList
        entries={entries}
        active={active}
        listRef={rootRef}
        style={rootPos}
        zone="menu-contextuel"
        onHover={(i) => {
          setActive(i);
          clearTimeout(timer.current);
          const item = entries[i] as MenuItem;
          // Entrée « ▸ » : son sous-menu tout de suite ; une autre entrée : le sous-menu ouvert se
          // ferme après un court délai (passage en diagonale vers lui).
          if (item.submenu) openSub(i);
          else if (sub !== null) timer.current = setTimeout(() => openSub(null), SUB_DELAY);
        }}
        onLeave={() => setActive(sub)}
        onPick={(i) => pick(entries[i] as MenuItem, i)}
      />
      {subEntries && (
        <MenuList
          entries={subEntries}
          active={subActive}
          listRef={subRef}
          style={subPos}
          zone="menu-contextuel.sous-menu"
          onHover={(i) => {
            clearTimeout(timer.current);
            setActive(sub);
            setSubActive(i);
          }}
          onLeave={() => setSubActive(null)}
          onPick={(i) => {
            const item = subEntries[i] as MenuItem;
            if (usable(item) && !item.submenu) pick(item, i);
          }}
        />
      )}
      {confirming?.confirm && (
        <Modal
          open
          onClose={() => setConfirming(null)}
          zone="menu-contextuel.confirmation"
          title={confirming.confirm.title}
          description={confirming.confirm.message}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirming(null)} className="text-foreground hover:bg-secondary hover:text-foreground">
                Annuler
              </Button>
              <Button
                onClick={() => {
                  closeContextMenu();
                  confirming.run?.();
                }}
                className={
                  confirming.confirm.danger
                    ? "bg-destructive text-white hover:bg-destructive/90"
                    : "bg-[#d9a94e] text-[#1a1408] hover:bg-[#e3b75f]"
                }
              >
                Oui
              </Button>
            </>
          }
        />
      )}
    </div>,
    document.body,
  );
}

/** À poser une fois, dans App. */
export function ContextMenuHost() {
  const menu = useContextMenu((s) => s.menu);
  return menu ? <MenuLayer key={menu.id} menu={menu} /> : null;
}
