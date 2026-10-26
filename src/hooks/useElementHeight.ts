// Hauteur d'un élément, suivie quand elle change (fenêtre plus étroite, boutons sur deux lignes…).

import { useLayoutEffect, useState, type RefObject } from "react";

export function useElementHeight(ref: RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setHeight(el.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}
