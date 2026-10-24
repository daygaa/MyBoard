// Rectangle de sélection (SEL-06), comme dans l'Explorateur Windows, en mode sélection seulement :
// glisser depuis n'importe quel point de la fenêtre (vignettes comprises, SEL-06.2) trace un rectangle ; les
// vignettes qu'il touche paraissent cochées pendant le geste et sont AJOUTÉES à la sélection au
// relâchement (Ctrl : elles sont décochées). Près du haut ou du bas de la zone qui défile, la grille
// défile toute seule. Un simple clic reste un clic (5 px de mouvement avant de tracer).
//
// Performance (D-008) : le rectangle est dessiné directement (style de son élément), sans redessiner
// la grille ; les vignettes ne changent que quand l'ensemble touché change.

import type { RefObject } from "react";
import { useCallback, useRef } from "react";

import type { MediaItem } from "@/lib/api";
import { hasEscapeLayer } from "@/lib/escape";
import { GRID_GAP } from "@/lib/grid";
import { scroller } from "@/lib/scroller";
import { swallow } from "@/lib/swallowClick";
import { commitSelectionPreview, setSelectionPreview } from "@/stores/selection";

/** Mouvement avant de commencer un rectangle : en dessous, c'est un clic. */
const THRESHOLD = 5;
/** Bande près du bord de la zone qui défile où la grille défile toute seule, et vitesse maximale. */
const EDGE = 48;
const MAX_SPEED = 20;

type Geometry = { tile: number; density: number; items: MediaItem[] };

/** Commandes sur lesquelles un appui garde son rôle (pas de rectangle) ; la barre de titre déplace la
 *  fenêtre ; un champ à pastilles place son curseur (SEL-12). */
const CONTROLS =
  'button, a[href], input, textarea, select, label, [role="button"], [role="checkbox"], [role="radio"], [role="slider"], [role="menuitem"], [role="tab"], [role="switch"], [role="dialog"], [data-zone="barre-titre"], [data-champ-pastilles]';

/** Un rectangle peut-il démarrer à cet appui (SEL-06.2) : n'importe où dans la fenêtre, sauf sur une
 *  commande, une barre de défilement, ou quand quelque chose est ouvert par-dessus (visionneuse,
 *  pop-in, menu burger) ? */
export function canStartRectangle(e: PointerEvent): boolean {
  if (e.button !== 0 || hasEscapeLayer() || !(e.target instanceof Element) || e.target.closest(CONTROLS)) return false;
  const area = scroller();
  return !(e.target === area && e.clientX >= area.getBoundingClientRect().left + area.clientWidth);
}
type Box = { left: number; top: number; right: number; bottom: number };

/** Première et dernière colonne (ou rangée) touchées par l'intervalle [from, to] (pixels de la grille). */
function span(from: number, to: number, tile: number, last: number): [number, number] {
  const step = tile + GRID_GAP;
  let first = Math.floor(Math.max(0, from) / step);
  if (Math.max(0, from) - first * step > tile) first++; // départ dans l'écart après une vignette
  return [first, Math.min(last, Math.floor(Math.max(0, to) / step))];
}

/** Médias des vignettes touchées par le rectangle. */
function hits(box: Box, { tile, density, items }: Geometry): Set<number> {
  const found = new Set<number>();
  const rows = Math.ceil(items.length / density);
  const [c0, c1] = span(box.left, box.right, tile, density - 1);
  const [r0, r1] = span(box.top, box.bottom, tile, rows - 1);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const item = items[r * density + c];
      if (item) found.add(item.id);
    }
  }
  return found;
}

export function useRectangleSelection(gridRef: RefObject<HTMLDivElement | null>, overlayRef: RefObject<HTMLDivElement | null>, geometry: Geometry) {
  const geo = useRef(geometry);
  geo.current = geometry;

  return useCallback((e: PointerEvent) => {
    const grid = gridRef.current;
    const overlay = overlayRef.current;
    if (!grid || !overlay) return;
    const origin = { x: e.clientX, y: e.clientY };
    const box0 = grid.getBoundingClientRect();
    const start = { x: e.clientX - box0.left, y: e.clientY - box0.top };
    const remove = e.ctrlKey;
    let pointer = origin;
    let dragging = false;
    let frame = 0;
    let lastKey = "";

    const update = () => {
      const box = grid.getBoundingClientRect();
      const x = pointer.x - box.left;
      const y = pointer.y - box.top;
      const rect = { left: Math.min(start.x, x), top: Math.min(start.y, y), right: Math.max(start.x, x), bottom: Math.max(start.y, y) };
      // Dessiné depuis le point de départ, même hors de la grille (SEL-06.2), dans la zone qui défile
      // (jamais sur la barre de titre).
      const area = scroller().getBoundingClientRect();
      const left = Math.max(area.left, box.left + rect.left);
      const top = Math.max(area.top, box.top + rect.top);
      Object.assign(overlay.style, {
        display: "block",
        left: `${left}px`,
        top: `${top}px`,
        width: `${Math.max(0, Math.min(area.right, box.left + rect.right) - left)}px`,
        height: `${Math.max(0, Math.min(area.bottom, box.top + rect.bottom) - top)}px`,
      });
      const found = hits(rect, geo.current);
      const key = [...found].join(",");
      if (key !== lastKey) {
        lastKey = key;
        setSelectionPreview({ ids: found, remove });
      }
    };

    // Défilement automatique près des bords, plus rapide à mesure qu'on s'en approche.
    const autoScroll = () => {
      const area = scroller();
      const a = area.getBoundingClientRect();
      let dy = 0;
      if (pointer.y < a.top + EDGE) dy = -MAX_SPEED * Math.min(1, (a.top + EDGE - pointer.y) / EDGE);
      else if (pointer.y > a.bottom - EDGE) dy = MAX_SPEED * Math.min(1, (pointer.y - (a.bottom - EDGE)) / EDGE);
      if (dy !== 0) {
        area.scrollTop += dy;
        update();
      }
      frame = requestAnimationFrame(autoScroll);
    };

    const move = (ev: PointerEvent) => {
      pointer = { x: ev.clientX, y: ev.clientY };
      if (!dragging) {
        if (Math.hypot(pointer.x - origin.x, pointer.y - origin.y) < THRESHOLD) return;
        dragging = true;
        // Un texte d'information sous l'appui a pu commencer à se surligner : le rectangle l'emporte.
        window.getSelection()?.removeAllRanges();
        document.documentElement.classList.add("rectangle-selection");
        frame = requestAnimationFrame(autoScroll);
      }
      update();
    };

    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      if (!dragging) return;
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove("rectangle-selection");
      overlay.style.display = "none";
      commitSelectionPreview();
      // Le clic qui suit le relâchement ne coche ni ne décoche la vignette sous la souris.
      window.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", swallow, true));
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }, [gridRef, overlayRef]);
}
