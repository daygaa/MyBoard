// Zoom de la visionneuse façon wikifeet (ZOOM-01 à ZOOM-07), repris de la v8 validée (v8 ✓).
// Sert aussi aux vidéos (ZOOM-08) : seul le clic sur le contenu change (lecture / pause).
//
// Échelle absolue : 1 = taille réelle (1 pixel de l'image = 1 pixel de l'écran).
// `tx`, `ty` = décalage du centre de l'image par rapport au centre de la scène, en pixels.
// Non zoomé : image « ajustée » et centrée. Zoomé : l'échelle et le décalage sont gardés, et
// toujours bornés pour ne jamais sortir de l'image (recalculés si la fenêtre change de taille).

import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

/** Zoom maximal ×4 (ZOOM-02). */
export const MAX_ZOOM = 4;
/** Molette : échelle + delta / 600 (ZOOM-03, valeur de wikifeet). */
const WHEEL_DIVISOR = 600;
/** Une encoche de molette en « lignes » vaut environ 33 pixels. */
const LINE_HEIGHT = 33;
/** Au-delà de 3 px de mouvement, c'est un glisser et non un clic (ZOOM-05). */
const CLICK_THRESHOLD = 3;
/** Animation réservée au clic (ZOOM-07). */
export const ANIM_MS = 200;
const EPS = 0.0001;

export type Size = { w: number; h: number };
export type View = { scale: number; tx: number; ty: number };
type Zoom = { zoomed: false } | { zoomed: true; scale: number; tx: number; ty: number };

/** Niveau « ajusté » (ZOOM-01), plafonné à 1 : une petite image reste en taille réelle. */
export function fitScale(img: Size, stage: Size): number {
  if (!img.w || !img.h || !stage.w || !stage.h) return 1;
  return Math.min(1, stage.w / img.w, stage.h / img.h);
}

/** ZOOM-04 : tant que l'image tient dans l'écran sur un axe, elle y reste centrée ; sinon le
 *  décalage est borné pour que le bord de l'image ne dépasse jamais le bord de l'écran. */
function clampAxis(t: number, rendered: number, viewport: number): number {
  if (rendered <= viewport) return 0;
  const max = (rendered - viewport) / 2;
  return Math.max(-max, Math.min(max, t));
}

function useStageSize(ref: RefObject<HTMLDivElement | null>): Size {
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** `onContentClick` : action d'un clic sur le contenu à la place du zoom (vidéos : lecture / pause). */
export function useZoom(
  stageRef: RefObject<HTMLDivElement | null>,
  img: Size,
  onBackgroundClose: () => void,
  onContentClick?: () => void,
) {
  const stage = useStageSize(stageRef);
  const minScale = fitScale(img, stage);
  const [zoom, setZoom] = useState<Zoom>({ zoomed: false });
  const [animate, setAnimate] = useState(false);

  const view: View = zoom.zoomed
    ? {
        scale: zoom.scale,
        tx: clampAxis(zoom.tx, img.w * zoom.scale, stage.w),
        ty: clampAxis(zoom.ty, img.h * zoom.scale, stage.h),
      }
    : { scale: minScale, tx: 0, ty: 0 };

  // Valeurs à jour lues par les gestionnaires d'événements (molette regroupée par image affichée).
  const live = useRef({ view, img, stage, minScale, onBackgroundClose, onContentClick });
  useLayoutEffect(() => {
    live.current = { view, img, stage, minScale, onBackgroundClose, onContentClick };
  });

  /** Nouvelle échelle et nouveau décalage, bornés ; revenir à « ajusté » recentre l'image. */
  const commit = (scale: number, tx: number, ty: number, animated: boolean) => {
    const { img: i, stage: s, minScale: min } = live.current;
    setAnimate(animated);
    if (scale <= min + EPS) setZoom({ zoomed: false });
    else setZoom({ zoomed: true, scale, tx: clampAxis(tx, i.w * scale, s.w), ty: clampAxis(ty, i.h * scale, s.h) });
  };

  /** Position du pointeur par rapport au centre de la scène. */
  const fromCenter = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { cx: 0, cy: 0 };
    return { cx: clientX - (rect.left + rect.width / 2), cy: clientY - (rect.top + rect.height / 2) };
  };

  // Molette (ZOOM-03) : zoom continu, ancré sous le curseur, une mise à jour par image affichée.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const pending = { delta: 0, cx: 0, cy: 0, frame: 0 };
    const apply = () => {
      pending.frame = 0;
      const { view: v, img: i, minScale: min } = live.current;
      if (!i.w || !i.h) return;
      const next = Math.max(min, Math.min(MAX_ZOOM, v.scale + pending.delta / WHEEL_DIVISOR));
      pending.delta = 0;
      if (Math.abs(next - v.scale) < EPS) return;
      // Le point de l'image sous le curseur reste sous le curseur.
      const ax = (pending.cx - v.tx) / v.scale;
      const ay = (pending.cy - v.ty) / v.scale;
      commit(next, pending.cx - ax * next, pending.cy - ay * next, false);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { cx, cy } = fromCenter(e.clientX, e.clientY);
      pending.delta -= e.deltaMode === 1 ? e.deltaY * LINE_HEIGHT : e.deltaY;
      pending.cx = cx;
      pending.cy = cy;
      if (!pending.frame) pending.frame = requestAnimationFrame(apply);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      cancelAnimationFrame(pending.frame);
    };
    // `commit` et `fromCenter` ne lisent que des références : inutile de les suivre.
  }, [stageRef]);

  // Clic et glisser (ZOOM-05, ZOOM-06).
  const drag = useRef<{ id: number; x0: number; y0: number; x: number; y: number; moved: boolean } | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: false };
    if (zoom.zoomed) e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > CLICK_THRESHOLD) d.moved = true;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    // Déplacement uniquement si zoomé (ZOOM-06), sans animation.
    if (!d.moved || !zoom.zoomed) return;
    const v = live.current.view;
    commit(v.scale, v.tx + dx, v.ty + dy, false);
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.moved || (e.target as HTMLElement).closest("button")) return;
    const { view: v, img: i, minScale: min } = live.current;
    const { cx, cy } = fromCenter(e.clientX, e.clientY);
    const onImage = Math.abs(cx - v.tx) <= (i.w * v.scale) / 2 && Math.abs(cy - v.ty) <= (i.h * v.scale) / 2;
    if (!onImage) {
      // Fond : zoomé → retour à « ajusté » ; sinon → fermer la visionneuse.
      if (zoom.zoomed) commit(min, 0, 0, true);
      else live.current.onBackgroundClose();
    } else if (live.current.onContentClick) {
      live.current.onContentClick();
    } else if (zoom.zoomed) {
      commit(min, 0, 0, true); // zoomé → « ajusté », centré
    } else if (min < 1 - EPS) {
      // « Ajusté » → taille réelle, centrée sur le point cliqué.
      commit(1, -cx / min, -cy / min, true);
    }
  };

  return {
    view,
    zoomed: zoom.zoomed,
    animate,
    /** Retour à « ajusté », centré, avec l'animation du clic. */
    reset: () => commit(live.current.minScale, 0, 0, true),
    // Geste interrompu (fenêtre qui perd le focus…) : ni clic ni déplacement.
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: () => (drag.current = null) },
  };
}
