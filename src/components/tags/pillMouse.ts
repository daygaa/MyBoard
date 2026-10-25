// Souris dans un champ à pastilles (SEL-12) : un clic place le curseur (sur une pastille : à sa droite),
// Maj + clic étend la sélection, un cliquer-glisser sélectionne textes et pastilles jusqu'au relâchement,
// même hors du champ (depuis une pastille : depuis son bord le plus proche) ; double-clic : le texte ou la
// pastille ; triple-clic : tout le champ.

import type { MouseEvent as ReactMouseEvent, RefObject } from "react";

import type { Pills } from "@/hooks/usePills";
import { caretAt } from "@/lib/pillText";
import type { pillCommands } from "./pillCommands";
import { posAtPoint } from "./pillDom";

type Context<T> = {
  pills: Pills<T>;
  cmd: ReturnType<typeof pillCommands<T>>;
  /** Glisser en cours : la sélection du navigateur ne doit pas être relue pendant ce temps. */
  dragging: RefObject<boolean>;
  /** Dernier état du champ (le glisser dure plusieurs affichages). */
  latest: () => Pills<T>;
};

export function pillMouseDown<T>(e: ReactMouseEvent, el: HTMLElement, { pills, cmd, dragging, latest }: Context<T>) {
  if (e.button !== 0 || !(e.target instanceof Element) || e.target.closest("ul")) return; // liste : elle garde le focus
  e.preventDefault();
  if (document.activeElement !== el) el.focus({ preventScroll: true });
  if (e.target.closest("[data-pastille] button")) return; // croix : elle agit au clic
  const { doc, sel } = pills;
  const { pos, pill } = posAtPoint(el, doc, e.clientX, e.clientY);
  if (e.detail >= 3) return cmd.selectAll();
  if (e.detail === 2) {
    if (pill !== null) return cmd.selectPill(pill);
    const length = doc.texts[pos.t].length;
    return pills.select(length ? { anchor: { t: pos.t, o: 0 }, focus: { t: pos.t, o: length } } : caretAt(pos));
  }
  const anchor = e.shiftKey ? sel.anchor : pos;
  pills.select(e.shiftKey ? { anchor, focus: pos } : caretAt(pill !== null ? { t: pill + 1, o: 0 } : pos));
  const start = { x: e.clientX, y: e.clientY };
  const onMove = (m: MouseEvent) => {
    if (!dragging.current && Math.hypot(m.clientX - start.x, m.clientY - start.y) < 4) return;
    dragging.current = true;
    const now = latest();
    now.select({ anchor, focus: posAtPoint(el, now.doc, m.clientX, m.clientY).pos });
  };
  const onUp = () => {
    dragging.current = false;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}
