// Petite liste ouverte par un bouton (colonnes « Synonymes » et « Parents » du gestionnaire de tags) :
// posée sur la page (la liste virtualisée ne la coupe pas), sous le bouton, ou au-dessus s'il n'y a
// pas la place en dessous ; Échap ou un clic en dehors la ferment.

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import { useEscape } from "@/lib/escape";
import { useOutsideClose } from "./useOutsideClose";

const GAP = 4;

export function usePopover(width: number) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  useEscape(open, close);
  useOutsideClose(open, [panelRef, buttonRef], close);

  // Placée une fois sa hauteur connue ; replacée quand son contenu change de taille.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const button = buttonRef.current;
    if (!open || !panel || !button) return;
    const place = () => {
      const r = button.getBoundingClientRect();
      const h = panel.offsetHeight;
      const below = r.bottom + GAP + h <= window.innerHeight - 8 || r.top - GAP - h < 8;
      const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
      setStyle({ left, top: below ? r.bottom + GAP : r.top - GAP - h, width });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [open, width]);

  const toggle = () => {
    setStyle({ visibility: "hidden", width });
    setOpen((o) => !o);
  };
  return { open, toggle, close, buttonRef, panelRef, style };
}
